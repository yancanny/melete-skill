#!/usr/bin/env node
// Melete 分享内容检查：把 share-spec 的红线从"模型自觉"变成确定性兜底。
// 只在本机运行，不联网。
//
// 用法：
//   node check-share.mjs <share.json | share.html>
// 退出码：1 = 有 ERROR，不能交付；0 = 通过（可能有 WARNING）。

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function wordList(kind) {
  try {
    const md = readFileSync(join(here, '..', 'references', 'report-template.md'), 'utf8');
    const m = md.match(new RegExp('```' + kind + '\\n([\\s\\S]*?)```'));
    return m ? m[1].split('\n').map((s) => s.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

const LIMITS = { year: { numbers: 3, mirrors: 3 }, short: { numbers: 2, mirrors: 2 } };
const TEXT_LIMITS = { title: 24, ai: 60, question: 40, experiment: 60 };

// 写给你自己的信（域四"自己"）的痕迹：分享里一律不能出现
const SELF = /本心|写给你自己的信|写给自己的信|心声|心绪|信封/;
// 情绪与健康的猜测、病名、诊断：只能留在信里，不进分享
const HEALTH = /诊断|疑似|病名|医生|抑郁|焦虑症|双相|多动症|ADHD|失眠症|强迫症/i;

const PRIVATE = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, '邮箱'],
  [/(?<!\d)1[3-9]\d{9}(?!\d)/, '手机号'],
  [/\+\d[\d\s-]{8,}\d/, '电话号码'],
  [/\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}/, '密钥'],
  [/\b(ghp|gho|github_pat|xox[abp]|AKIA)[A-Za-z0-9_]{10,}/, '令牌'],
  [/(\/Users\/|\/home\/|[A-Z]:\\)/, '文件路径'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, '会话编号'],
];

const JUDGE = [
  [/\d+(\.\d+)?\s*分(?![钟之享析类开别布散工])/, '分数'],
  [/(前|超过了?|击败了?)\s*\d+(\.\d+)?\s*%/, '百分位或和他人比较'],
  [/\b[IE][NS][TF][JP](-[AT])?\b/, '人格类型'],
  [/[A-E]\s*[级等]|Lv\.?\s*\d|段位|等级/, '等级'],
  [/比\s*(大多数|多数|其他|别)(人|用户)/, '和他人比较'],
];

function textOf(input, isHtml) {
  if (!isHtml) return input;
  return input
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

export function checkShare(raw, { isHtml = false, data = null } = {}) {
  const errors = [];
  const warns = [];

  if (isHtml) {
    if (/<script[\s>]/i.test(raw)) errors.push('含有 <script>：分享文件里不能有脚本');
    if (/<link[\s>]/i.test(raw) || /@import/i.test(raw)) errors.push('含有外部样式或字体');
    if (/(src|href)\s*=\s*["']?\s*(https?:)?\/\//i.test(raw) || /url\(\s*["']?\s*(https?:)?\/\//i.test(raw)) {
      errors.push('引用了外部资源（http/https）');
    }
    if (/\{\{[^}]+\}\}/.test(raw)) errors.push('还有没填的占位符 {{…}}');
  }

  if (data) {
    const lim = LIMITS[data.kind] || LIMITS.year;
    if ((data.numbers || []).length > lim.numbers) errors.push(`数字超过上限：${data.numbers.length} > ${lim.numbers}`);
    if ((data.mirrors || []).length > lim.mirrors) errors.push(`镜子超过上限：${data.mirrors.length} > ${lim.mirrors}`);
    if (!(data.mirrors || []).length) errors.push('至少要有一面镜子');
    for (const [k, n] of Object.entries(TEXT_LIMITS)) {
      const v = String(data[k] || '');
      if ([...v].length > n) warns.push(`${k} 有 ${[...v].length} 字，建议不超过 ${n} 字`);
    }
  }

  const text = textOf(raw, isHtml);

  if (SELF.test(text)) errors.push('出现了写给你自己的信的内容：这封信永远不进分享');
  if (HEALTH.test(text)) errors.push(`出现了健康猜测或诊断：${text.match(HEALTH)[0]}（只能留在写给你自己的信里）`);
  for (const [re, what] of PRIVATE) if (re.test(text)) errors.push(`可能含有${what}：${text.match(re)[0]}`);
  for (const [re, what] of JUDGE) if (re.test(text)) errors.push(`出现${what}：${text.match(re)[0]}`);
  for (const w of wordList('banned')) if (text.includes(w)) errors.push(`禁用词：${w}`);
  // 慎用词只查内容本身（JSON），不查模板里的版块标题（例如"一个问题"）
  if (!isHtml) {
    for (const w of wordList('caution')) {
      if (w.length >= 2 && text.includes(w)) warns.push(`慎用词：${w}（用来评价人时要改）`);
    }
  }
  if (/\d+(\.\d+)?\s*%/.test(text)) warns.push('出现百分比：分享里尽量用"几次、哪几次"');
  if (/[「“"][^」”"]{12,}[」”"]/.test(text)) warns.push('疑似引用了较长的原话：分享默认不放原话');

  return { errors, warns };
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('用法：node check-share.mjs <share.json | share.html>');
    process.exit(2);
  }
  const raw = readFileSync(file, 'utf8');
  let res;
  if (/\.json$/i.test(file)) {
    const data = JSON.parse(raw);
    const flat = [data.title, data.range, data.by, data.ai, data.question, data.experiment, data.name,
      ...(data.numbers || []).flatMap((x) => [x.value, x.label]),
      ...(data.mirrors || []).flatMap((x) => [x.title, x.line])].filter(Boolean).join('\n');
    res = checkShare(flat, { data });
  } else {
    res = checkShare(raw, { isHtml: true });
  }
  for (const e of res.errors) console.log('ERROR  ' + e);
  for (const w of res.warns) console.log('WARN   ' + w);
  if (!res.errors.length) console.log(res.warns.length ? '✓ 通过（有提醒，请看一眼）' : '✓ 通过');
  process.exit(res.errors.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
