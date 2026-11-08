#!/usr/bin/env node
// Melete 分享：把 share.json 填进 assets/share.html，检查后导出长图（PNG）和/或 HTML。
// 只在本机运行：长图由本机已安装的 Chrome / Edge / Chromium 在无界面模式下渲染，不联网、不下载任何东西。
//
// 用法：
//   node render-share.mjs share.json --out <目录> --png          只出长图
//   node render-share.mjs share.json --out <目录> --html         只出 HTML
//   node render-share.mjs share.json --out <目录> --png --html   两样都出
//   可选：--name <文件名前缀>   默认 melete-share
//         --browser <路径>      指定浏览器
//
// 需要 Node 22 以上（用到内置 WebSocket）。

import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkShare } from './check-share.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const LABELS = {
  zh: { mark: 'Melete · 我的 AI 复盘', mirrors: '几面镜子', ai: 'AI 这一侧', question: '一个问题', experiment: '小实验', signature: 'Melete · 我的 AI 复盘' },
  en: { mark: 'Melete · My AI Debrief', mirrors: 'A few mirrors', ai: 'The AI side', question: 'One question', experiment: 'A small experiment', signature: 'Melete · My AI Debrief' },
  ja: { mark: 'Melete · わたしの AI 感想戦', mirrors: 'いくつかの鏡', ai: 'AI の側', question: 'ひとつの問い', experiment: '小さな実験', signature: 'Melete · わたしの AI 感想戦' },
};
const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function present(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'boolean') return v;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

export function fill(tpl, data) {
  const labels = { ...(LABELS[data.lang] || LABELS.en), ...(data.labels || {}) };
  let html = tpl.replace(/^<!doctype html>\s*<!--[\s\S]*?-->\s*/i, '<!doctype html>\n');
  html = html.replace(/<!--each:(\w+)-->([\s\S]*?)<!--\/each:\1-->/g, (_, key, body) =>
    (data[key] || []).map((item, i) =>
      body.replace(/\{\{\.n\}\}/g, ROMAN[i] || String(i + 1))
        .replace(/\{\{\.(\w+)\}\}/g, (_m, f) => esc(item[f]))).join(''));
  html = html.replace(/<!--if:(\w+)-->([\s\S]*?)<!--\/if:\1-->/g, (_, key, body) => (present(data[key]) ? body : ''));
  html = html.replace(/\{\{label\.(\w+)\}\}/g, (_, k) => esc(labels[k] || ''));
  html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => esc(data[k]));
  return html;
}

function findBrowser(explicit) {
  if (explicit) return existsSync(explicit) ? explicit : null;
  const os = platform();
  const cands = os === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ] : os === 'win32' ? [
    `${process.env['PROGRAMFILES']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['LOCALAPPDATA']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env['PROGRAMFILES']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ] : [];
  for (const c of cands) if (c && existsSync(c)) return c;
  if (os !== 'win32') {
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      try { return execFileSync('which', [name], { encoding: 'utf8' }).trim() || null; } catch {}
    }
  }
  return null;
}

async function screenshot(browser, htmlFile, pngFile, width = 1080) {
  if (typeof WebSocket === 'undefined') throw new Error('需要 Node 22 以上（内置 WebSocket）');
  const profile = mkdtempSync(join(tmpdir(), 'melete-share-'));
  const proc = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-sync',
    '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  try {
    const wsUrl = await new Promise((ok, fail) => {
      let buf = '';
      const t = setTimeout(() => fail(new Error('浏览器没有启动')), 15000);
      proc.stderr.on('data', (d) => {
        buf += d;
        const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) { clearTimeout(t); ok(m[1]); }
      });
      proc.on('exit', () => fail(new Error('浏览器提前退出')));
    });

    const ws = new WebSocket(wsUrl);
    await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error('连不上浏览器')); });
    let id = 0;
    const pending = new Map();
    const waiters = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { ok, fail } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
      } else if (msg.method) {
        for (const w of waiters) if (w.method === msg.method) w.ok(msg.params);
      }
    };
    const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
      const mid = ++id;
      pending.set(mid, { ok, fail });
      ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const once = (method) => new Promise((ok) => waiters.push({ method, ok }));

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1200, deviceScaleFactor: 2, mobile: false }, sessionId);
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: pathToFileURL(htmlFile).href }, sessionId);
    await loaded;
    const { result } = await send('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(() => Math.ceil(document.documentElement.scrollHeight))',
      awaitPromise: true, returnByValue: true,
    }, sessionId);
    const height = Math.max(600, Number(result.value) || 1600);
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false }, sessionId);
    const shot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 },
    }, sessionId);
    writeFileSync(pngFile, Buffer.from(shot.data, 'base64'));
    try { await send('Browser.close'); } catch {}
    ws.close();
  } finally {
    try { proc.kill(); } catch {}
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const input = args.find((a) => !a.startsWith('--') && a !== opt('--out') && a !== opt('--name') && a !== opt('--browser'));
  if (!input) {
    console.error('用法：node render-share.mjs share.json --out <目录> [--png] [--html]');
    process.exit(2);
  }
  const wantPng = args.includes('--png');
  const wantHtml = args.includes('--html') || !wantPng;
  const outDir = resolve(opt('--out') || '.');
  const base = opt('--name') || 'melete-share';

  const data = JSON.parse(readFileSync(input, 'utf8'));
  data.lang ||= 'zh';
  data.kind ||= 'year';
  if (data.signature === undefined) data.signature = true;

  const tpl = readFileSync(join(here, '..', 'assets', 'share.html'), 'utf8');
  const html = fill(tpl, data);

  // 先查内容（含上限与慎用词），再查成品（脚本、外部资源、占位符）
  const flat = [data.title, data.range, data.by, data.ai, data.question, data.experiment, data.name,
    ...(data.numbers || []).flatMap((x) => [x.value, x.label]),
    ...(data.mirrors || []).flatMap((x) => [x.title, x.line])].filter(Boolean).join('\n');
  const a = checkShare(flat, { data });
  const b = checkShare(html, { isHtml: true });
  const errors = [...new Set([...a.errors, ...b.errors])];
  const warns = [...new Set([...a.warns, ...b.warns])];
  for (const w of warns) console.log('WARN   ' + w);
  if (errors.length) {
    for (const e of errors) console.log('ERROR  ' + e);
    console.log('✗ 没有导出：请先改好 share.json 再运行。');
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const htmlOut = join(outDir, base + '.html');
  let tmpHtml = htmlOut;
  if (!wantHtml) {
    const d = mkdtempSync(join(tmpdir(), 'melete-html-'));
    tmpHtml = join(d, base + '.html');
  }
  writeFileSync(tmpHtml, html);

  if (wantPng) {
    const browser = findBrowser(opt('--browser'));
    const pngOut = join(outDir, base + '.png');
    if (!browser) {
      if (!wantHtml) writeFileSync(htmlOut, html);
      console.log('NOBROWSER 本机没找到 Chrome / Edge / Chromium，长图没有生成。');
      console.log(`  已写出 HTML：${htmlOut}`);
      console.log('  可以用你自己的浏览器或截图工具把它截成长图；都没有的话，请用户在浏览器里打开后截长图。');
      process.exit(3);
    }
    try {
      await screenshot(browser, tmpHtml, pngOut);
      console.log(`✓ 长图：${pngOut}`);
    } catch (e) {
      if (!wantHtml) writeFileSync(htmlOut, html);
      console.log(`NOBROWSER 长图渲染失败：${e.message}`);
      console.log(`  已写出 HTML：${htmlOut}`);
      process.exit(3);
    }
  }
  if (wantHtml) console.log(`✓ HTML：${htmlOut}`);
  else rmSync(dirname(tmpHtml), { recursive: true, force: true });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
