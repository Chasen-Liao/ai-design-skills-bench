import { spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

const port = 9339;
const profile = '/tmp/chasen-cdp-full';
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
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
await send('Page.enable');
await send('Runtime.enable');

for (const [label, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 800 });
  await send('Page.navigate', { url: `file://${process.cwd()}/index.html` });
  await sleep(2600);
  const docH = await ev('document.documentElement.scrollHeight');
  for (let y = 0; y < docH; y += Math.round(h * 0.7)) {
    await ev(`window.scrollTo(0, ${y})`);
    await sleep(220);
  }
  await ev('window.scrollTo(0, document.documentElement.scrollHeight)');
  await sleep(900);
  await ev('window.scrollTo(0, 0)');
  await sleep(700);
  const height = await ev('document.documentElement.scrollHeight');
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height, scale: 1 } });
  writeFileSync(`.oil-ui/personal-landing/revealed-${label}.png`, Buffer.from(shot.data, 'base64'));
  // check the rows are visible now
  const rows = await ev(`[...document.querySelectorAll('.work-row')].map(el => getComputedStyle(el).opacity)`);
  console.log(label, { height, rows });
}
ws.close();
proc.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
