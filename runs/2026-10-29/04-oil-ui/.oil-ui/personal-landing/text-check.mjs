import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const port = 9337;
const profile = '/tmp/chasen-cdp-text';
rmSync(profile, { recursive: true, force: true });
const proc = spawn('/usr/bin/google-chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) {
  try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {}
  await sleep(150);
}
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id; pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: `file://${process.cwd()}/index.html` });
await sleep(2800);

const expr = `(() => {
  const out = [];
  document.querySelectorAll('p, figcaption').forEach(el => {
    if (el.closest('.menu-panel')) return;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter(r => r.width > 0.5);
    if (rects.length < 2) return;
    const last = rects[rects.length - 1];
    const lines = {};
    rects.forEach(r => { const k = Math.round(r.top); lines[k] = Math.max(lines[k] || 0, r.width); });
    const widths = Object.values(lines);
    const lastW = widths[widths.length - 1];
    if (lastW < fs * 2.2) {
      out.push({cls: String(el.className).slice(0,20), text: el.textContent.trim().slice(0,36), lines: widths.length, lastLineWidth: +lastW.toFixed(1), fs});
    }
  });
  return out;
})()`;

const res = {};
for (const [label, w, h] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844], ['small', 320, 640]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 800 });
  await sleep(700);
  res[label] = await evaluate(expr);
}
console.log(JSON.stringify(res, null, 2));
ws.close();
proc.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
