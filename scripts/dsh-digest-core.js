// Melete 共享日志读取与出处回溯内核（独立 Skill 可携带，不依赖平台插件）
// 读取本机 DSH 会话日志，整理成供复盘/回顾用的摘要。纯本地运行，不联网。
// 只取用户亲手写的话（source.kind = user），不取系统、Skill 目录或插件注入的内容；
// 邮箱、电话、密钥一类的敏感字符串在本地替换脱敏。

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

const KNOWN_VERSIONS = new Set([0, 4])

export function sessionsRoot() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'sessions')
}

function decode(buf, compressed) {
  if (!compressed) return buf.toString('utf8')
  // 多段 zstd 帧首尾相接：按帧头 28 B5 2F FD 切开，逐段解压
  const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const starts = []
  for (let i = buf.indexOf(magic); i !== -1; i = buf.indexOf(magic, i + 1)) starts.push(i)
  const parts = []
  let pending = null
  for (let k = 0; k < starts.length; k++) {
    const chunk = buf.subarray(starts[k], k + 1 < starts.length ? starts[k + 1] : buf.length)
    const tryBuf = pending ? Buffer.concat([pending, chunk]) : chunk
    try {
      parts.push(zstdDecompressSync(tryBuf).toString('utf8'))
      pending = null
    } catch {
      pending = tryBuf
    }
  }
  return parts.join('')
}

function textOf(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(b => (typeof b === 'string' ? b : b?.type === 'text' ? (b.text ?? '') : '')).join('\n')
  }
  return ''
}

export function redact(s) {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[邮箱]')
    .replace(/\b(sk|pk|ghp|gho|xox[abp])[-_][A-Za-z0-9_-]{10,}/g, '[密钥]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[长串]')
    .replace(/(?<!\d)(\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g, '[电话]')
    .replace(/\s+/g, ' ')
    .trim()
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n)}……` : s)

export function findLogs(since) {
  const root = sessionsRoot()
  const out = []
  if (!existsSync(root)) return out
  for (const proj of readdirSync(root)) {
    const p = join(root, proj)
    if (!statSync(p).isDirectory()) continue
    for (const sess of readdirSync(p)) {
      const s = join(p, sess)
      if (!statSync(s).isDirectory()) continue
      let best = null
      for (const f of readdirSync(s)) {
        const m = /^session(?:\.v(\d+))?\.jsonl(\.zstd)?$/.exec(f)
        if (!m) continue
        const v = m[1] ? Number(m[1]) : 0
        if (!best || v > best.version) best = { file: join(s, f), version: v }
      }
      if (best && statSync(best.file).mtimeMs >= since) out.push(best)
    }
  }
  return out
}

export function readSession(file, skipped) {
  const bump = key => { skipped[key] = (skipped[key] ?? 0) + 1 }
  let text
  try {
    text = decode(readFileSync(file), file.endsWith('.zstd'))
  } catch {
    bump('unreadable')
    return null
  }
  const lines = text.split('\n').filter(Boolean)
  let header
  try {
    header = JSON.parse(lines[0])
  } catch {
    bump('no-header')
    return null
  }
  if (header?.type !== 'session') { bump('no-header'); return null }
  if (!KNOWN_VERSIONS.has(header.version)) { bump(`unknown-version-${header.version}`); return null }
  const s = {
    id: String(header.id), project: basename(String(header.cwd ?? '')) || '?', created: Number(header.createdAt) || 0,
    version: header.version, user: [], ai: [], tools: {}, toolErrors: 0, sources: 0, aborts: 0, turns: 0,
    models: new Set(), approval: new Set(), sandbox: new Set(), deliverables: 0, changes: 0, subagents: 0,
  }
  for (let i = 1; i < lines.length; i++) {
    let o
    try { o = JSON.parse(lines[i]) } catch { continue }
    const d = o.data ?? {}
    const seq = Number(o.seq) || i
    switch (o.type) {
      case 'user/message':
        if (d.source?.kind === 'user' || (!d.source && d.role === 'user')) {
          const txt = redact(textOf(d.content))
          if (txt) s.user.push({ seq, text: txt })
        }
        break
      case 'assistant/message': {
        const txt = redact(textOf(d.message?.content))
        if (txt) s.ai.push({ seq, text: txt })
        break
      }
      case 'tool/call': if (d.name) s.tools[d.name] = (s.tools[d.name] ?? 0) + 1; break
      case 'tool/result':
        if (d.error) s.toolErrors++
        if (Array.isArray(d.meta?.sources)) s.sources += d.meta.sources.length
        break
      case 'turn/end': s.turns++; if (d.reason?.kind === 'aborted') s.aborts++; break
      case 'request/context': if (d.model) s.models.add(`${d.provider ?? ''}/${d.model}`); break
      case 'approval/policy': if (d.policy) s.approval.add(String(d.policy)); break
      case 'sandbox/mode': if (d.mode) s.sandbox.add(String(d.mode)); break
      case 'deliverables/presented': s.deliverables += Array.isArray(d.files) ? d.files.length : 1; break
      case 'workspace/changes': s.changes++; break
      case 'subagent/descriptor': s.subagents++; break
    }
  }
  return s
}

const fmtTime = ms => {
  const d = new Date(ms)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function render(real, label, skipped, userClip, aiClip, perSession, note, auto) {
  const out = [
    `# DSH 复盘摘要 · ${label}`,
    '',
    `> 共 ${real.length} 段有用户亲手输入的会话；另有 ${auto} 段没有用户输入（自动或子 Agent），只计数。`,
    note ? `> ${note}` : '',
    '> 只含用户亲手写的话。邮箱、电话、密钥已在本地替换。长消息已截断。出处写法：「项目 · 会话编号前 8 位 #事件序号」。',
    Object.keys(skipped).length ? `> 跳过的日志：${JSON.stringify(skipped)}` : '',
    '',
  ]
  for (const s of real.sort((a, b) => a.created - b.created)) {
    const tools = Object.entries(s.tools).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join('、') || '无'
    out.push(
      `## ${fmtTime(s.created)} · ${s.project} · ${s.id.slice(0, 8)}`,
      `- 模型：${[...s.models].join('、') || '未记录'}；审批：${[...s.approval].join('、') || '未记录'}；沙箱：${[...s.sandbox].join('、') || '未记录'}`,
      `- 轮次 ${s.turns}，用户中止 ${s.aborts} 次；工具：${tools}；工具报错 ${s.toolErrors}；搜索来源 ${s.sources} 条；交出成品 ${s.deliverables}；改动工作区 ${s.changes} 次；子 Agent ${s.subagents}`,
    )
    const items = [...s.user.map(u => ({ ...u, who: '用户' })), ...s.ai.map(a => ({ ...a, who: 'AI' }))].sort((a, b) => a.seq - b.seq)
    const keep = items.length > perSession
      ? [...items.slice(0, Math.ceil(perSession / 2)), null, ...items.slice(items.length - Math.floor(perSession / 2))]
      : items
    for (const it of keep) {
      if (!it) { out.push(`- ……（中间略去 ${items.length - perSession} 条）`); continue }
      out.push(`- ${it.who}（#${it.seq}）：${clip(it.text, it.who === '用户' ? userClip : aiClip)}`)
    }
    out.push('')
  }
  return out.join('\n')
}

/**
 * 生成摘要。
 * @param {{since?: number, until?: number, label?: string, maxChars?: number}} options
 *   since / until 是毫秒时间戳；since = 0 表示从最早的记录开始。
 * @returns {{text: string, stats: {sessions: number, withUserInput: number, userMessages: number, used: number, earliest: string}}}
 */
export function buildDigest({ since = 0, until = Date.now(), label = '', maxChars = 60000 } = {}) {
  const skipped = {}
  const sessions = findLogs(since)
    .map(l => readSession(l.file, skipped))
    .filter(s => s && s.created >= since && s.created <= until)
  const real = sessions.filter(s => s.user.length > 0).sort((a, b) => a.created - b.created)
  const auto = sessions.length - real.length
  const tiers = [[400, 300, 40], [250, 150, 30], [160, 100, 20], [100, 60, 12], [80, 40, 8]]
  let text = ''
  let used = real
  for (const [u, a, n] of tiers) {
    text = render(real, label, skipped, u, a, n, '', auto)
    if (text.length <= maxChars) break
  }
  if (text.length > maxChars) {
    // 会话太多时，沿时间均匀抽取，让前后各段都有代表，而不是只看到开头
    const [u, a, n] = tiers[tiers.length - 1]
    for (let k = 2; k <= real.length; k++) {
      used = real.filter((_, idx) => idx % k === 0)
      const note = `会话太多，沿时间均匀抽取了 ${used.length} 段（共 ${real.length} 段）。`
      text = render(used, label, skipped, u, a, n, note, auto)
      if (text.length <= maxChars) break
    }
  }
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}\n……（摘要过长，后面略去）`
  const first = real.length ? new Date(real[0].created) : null
  const pad = n => String(n).padStart(2, '0')

  // 本地无模型计算分享数据：十二时辰与统计指标
  const rhythm = new Array(12).fill(0)
  const allTools = {}
  let totalToolCalls = 0
  let maxTurns = 0
  let totalAborts = 0
  let totalDeliverables = 0
  let totalChanges = 0
  const allModels = new Set()

  for (const s of sessions) {
    if (s.created) {
      const h = new Date(s.created).getHours()
      const shichen = Math.floor(((h + 1) % 24) / 2)
      rhythm[shichen]++
    }
    if ((s.turns || 0) > maxTurns) maxTurns = s.turns
    totalAborts += (s.aborts || 0)
    totalDeliverables += (s.deliverables || 0)
    totalChanges += (s.changes || 0)
    if (s.models) s.models.forEach(m => allModels.add(m))
    if (s.tools) {
      Object.entries(s.tools).forEach(([k, v]) => {
        allTools[k] = (allTools[k] || 0) + v
        totalToolCalls += v
      })
    }
  }
  const topTools = Object.entries(allTools).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)

  const shareStats = {
    sessions: sessions.length,
    withUserInput: real.length,
    userMessages: real.reduce((n, x) => n + x.user.length, 0),
    toolCalls: totalToolCalls,
    topTools,
    modelsCount: allModels.size || 1,
    models: [...allModels],
    deliverables: totalDeliverables,
    changes: totalChanges,
    maxTurns,
    aborts: totalAborts,
  }

  return {
    text,
    stats: {
      sessions: sessions.length, withUserInput: real.length, userMessages: real.reduce((n, x) => n + x.user.length, 0),
      used: used.length, earliest: first ? `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}` : '',
      shareStats,
      rhythm,
    },
  }
}

/**
 * 根据出处标识（如 "2026-11-02 · 明明研究中心 · 9bf05e19 #1"）或 ID/序号查找上下文
 */
export function queryContext({ where = '', sessionId = '', seq = null } = {}) {
  let targetId = sessionId.trim().toLowerCase()
  let targetSeq = seq !== null ? Number(seq) : null

  if (!targetId && where) {
    const idMatch = /[0-9a-f]{8,}/i.exec(where)
    if (idMatch) targetId = idMatch[0].toLowerCase()
    const seqMatch = /#(\d+)/.exec(where)
    if (seqMatch) targetSeq = Number(seqMatch[1])
  }

  if (!targetId) return { found: false, reason: 'no-session-id' }

  const root = sessionsRoot()
  if (!existsSync(root)) return { found: false, reason: 'no-root' }

  let targetFile = null
  for (const proj of readdirSync(root)) {
    const p = join(root, proj)
    if (!statSync(p).isDirectory()) continue
    for (const sess of readdirSync(p)) {
      if (sess.toLowerCase().includes(targetId) || targetId.includes(sess.toLowerCase())) {
        const s = join(p, sess)
        if (!statSync(s).isDirectory()) continue
        for (const f of readdirSync(s)) {
          if (/^session(?:\.v\d+)?\.jsonl(\.zstd)?$/.test(f)) {
            targetFile = join(s, f)
            break
          }
        }
      }
      if (targetFile) break
    }
    if (targetFile) break
  }

  if (!targetFile) return { found: false, reason: 'file-not-found' }

  let text = ''
  try {
    text = decode(readFileSync(targetFile), targetFile.endsWith('.zstd'))
  } catch {
    return { found: false, reason: 'unreadable' }
  }

  const lines = text.split('\n').filter(Boolean)
  let header = null
  try { header = JSON.parse(lines[0]) } catch {}

  const allMessages = []
  for (let i = 1; i < lines.length; i++) {
    let o
    try { o = JSON.parse(lines[i]) } catch { continue }
    const d = o.data ?? {}
    const s = Number(o.seq) || i
    if (o.type === 'user/message') {
      if (d.source?.kind === 'user' || (!d.source && d.role === 'user')) {
        const txt = redact(textOf(d.content))
        if (txt) allMessages.push({ seq: s, who: '用户', text: txt })
      }
    } else if (o.type === 'assistant/message') {
      const txt = redact(textOf(d.message?.content))
      if (txt) allMessages.push({ seq: s, who: 'AI', text: txt })
    }
  }

  if (!allMessages.length) return { found: false, reason: 'no-messages' }

  let matchIndex = -1
  if (targetSeq !== null) {
    matchIndex = allMessages.findIndex(m => m.seq === targetSeq)
  }

  // 若没找到精确 seq，默认显示最贴近或前几条
  if (matchIndex < 0) {
    if (targetSeq !== null) {
      // 找 seq 最接近的
      let minDiff = Infinity
      allMessages.forEach((m, idx) => {
        const diff = Math.abs(m.seq - targetSeq)
        if (diff < minDiff) { minDiff = diff; matchIndex = idx }
      })
    } else {
      matchIndex = 0
    }
  }

  const start = Math.max(0, matchIndex - 2)
  const end = Math.min(allMessages.length, matchIndex + 3)
  const contextItems = allMessages.slice(start, end).map(item => ({
    ...item,
    isTarget: item.seq === (allMessages[matchIndex]?.seq ?? targetSeq),
  }))

  return {
    found: true,
    project: header?.cwd ? basename(header.cwd) : '未知项目',
    sessionId: header?.id || targetId,
    createdAt: header?.createdAt || 0,
    targetSeq: targetSeq ?? allMessages[matchIndex]?.seq,
    items: contextItems,
  }
}
