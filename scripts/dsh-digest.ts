// 读取本机 DSH 会话日志，生成一份供回顾用的摘要（只在本地运行，不联网）。
//
// 用法：
//   node melete/scripts/dsh-digest.ts                 最近 14 天，摘要输出到屏幕
//   node melete/scripts/dsh-digest.ts --days 30       最近 30 天
//   node melete/scripts/dsh-digest.ts --since 2026-01-01 --until 2026-12-31   指定起止日期（含当天）
//   node melete/scripts/dsh-digest.ts --all           全部记录
//   node melete/scripts/dsh-digest.ts --out 文件.md    同时写入文件
//   node melete/scripts/dsh-digest.ts --stats         只输出统计数字，不输出任何对话内容（用于自测）
//
// 独立 Skill 脚本：依赖同目录下的 dsh-digest-core.js，完全独立于任何外部插件。

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  sessionsRoot,
  findLogs,
  readSession,
  render,
  buildDigest,
} from './dsh-digest-core.js';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DAYS = Number(opt('--days') ?? 14);
const OUT = opt('--out');
const STATS_ONLY = args.includes('--stats');
const SINCE_OPT = opt('--since');
const UNTIL_OPT = opt('--until');
const ALL = args.includes('--all');
const SINCE = ALL ? 0 : SINCE_OPT ? new Date(SINCE_OPT + 'T00:00:00').getTime() : Date.now() - DAYS * 86400_000;
const UNTIL = UNTIL_OPT ? new Date(UNTIL_OPT + 'T23:59:59.999').getTime() : Date.now();
const LABEL = ALL ? '全部记录' : SINCE_OPT ? `${SINCE_OPT} 至 ${UNTIL_OPT ?? '今天'}` : `最近 ${DAYS} 天`;
const MAX_TOTAL = 90_000;

const ROOT = sessionsRoot();
const skipped: Record<string, number> = {};
const sessions = findLogs(SINCE)
  .map((l: { file: string; version: number }) => readSession(l.file, skipped))
  .filter((s: any) => !!s && s.created >= SINCE - 86400_000 && s.created <= UNTIL);

if (STATS_ONLY) {
  const real = sessions.filter((s: any) => s.user.length > 0);
  console.log(JSON.stringify({
    range: LABEL, sessions: sessions.length, withUserInput: real.length,
    userMessages: real.reduce((n: number, s: any) => n + s.user.length, 0),
    aiMessages: real.reduce((n: number, s: any) => n + s.ai.length, 0),
    toolCalls: real.reduce((n: number, s: any) => n + Object.values(s.tools as Record<string, number>).reduce((a: number, b: number) => a + b, 0), 0),
    aborts: real.reduce((n: number, s: any) => n + s.aborts, 0),
    versions: [...new Set(sessions.map((s: any) => s.version))],
    skipped,
    digestChars: render(real, LABEL, skipped, 400, 300, 40, '', sessions.length - real.length).length,
  }, null, 2));
  process.exit(0);
}

const res = buildDigest({ since: SINCE, until: UNTIL, label: LABEL, maxChars: MAX_TOTAL });
const digest = res.text;

if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, digest);
}
console.log(digest);
