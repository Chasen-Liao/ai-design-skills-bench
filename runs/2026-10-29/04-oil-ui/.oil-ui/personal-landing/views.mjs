import { spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

const chromePath = '/usr/bin/google-chrome';
const port = 9335;
const profile = '/tmp/chasen-cdp-views';
rmSync(profile, { recursive: true, force: true });
const proc = spawn(chromePath, [
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

const width = Number(process.argv[2] || 390);
const height = Number(process.argv[3] || 844);
const label = process.argv[4] || 'm';
const scrolls = (process.argv[5] || '0').split(',').map(Number);
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 800 });
await send('Page.navigate', { url: `file://${process.cwd()}/index.html` });
await sleep(2800);

for (const y of scrolls) {
  await evaluate(`window.scrollTo(0, ${y})`);
  await sleep(900);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`.oil-ui/personal-landing/views/${label}-${y}.png`, Buffer.from(shot.data, 'base64'));
  console.log('saved', y);
}
ws.close();
proc.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
