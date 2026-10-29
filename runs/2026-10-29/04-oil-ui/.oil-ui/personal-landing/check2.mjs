import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const port = 9336;
const profile = '/tmp/chasen-cdp-check2';
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
const url = `file://${process.cwd()}/index.html`;

async function setSize(w, h, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
}
async function load(wait = 2600) {
  await send('Page.navigate', { url });
  await sleep(wait);
}
const probe = () => evaluate(`(() => {
  const wm = document.querySelector('.wordmark').getBoundingClientRect();
  const sw = document.querySelector('.stage-word').getBoundingClientRect();
  const overflow = [...document.querySelectorAll('body *')].filter(el => {
    if (el.closest('.ticker') || el.classList.contains('skip')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.right > innerWidth + 1.5 || r.left < -1.5);
  }).slice(0, 10).map(el => ({tag: el.tagName, cls: String(el.className).slice(0,30), left: +el.getBoundingClientRect().left.toFixed(1), right: +el.getBoundingClientRect().right.toFixed(1)}));
  return {
    w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight,
    wordmark: {w: +wm.width.toFixed(1), fs: getComputedStyle(document.querySelector('.wordmark')).fontSize},
    stageWord: {w: +sw.width.toFixed(1), fs: getComputedStyle(document.querySelector('.stage-word')).fontSize},
    overflow,
    avatar: (() => { const a = document.querySelector('.id-card img'); return a ? {nw: a.naturalWidth, nh: a.naturalHeight} : null; })(),
    navLinksVisible: getComputedStyle(document.querySelector('.nav')).display,
    menuBtnVisible: getComputedStyle(document.getElementById('menuBtn')).display,
  };
})()`);

const out = {};
for (const [label, w, h, mobile] of [['zoom200', 720, 450, false], ['large', 1920, 1080, false], ['tablet', 768, 1024, false], ['small', 320, 640, true]]) {
  await setSize(w, h, mobile);
  await load();
  out[label] = await probe();
}

await setSize(390, 844, true);
await load();
out.avatarAfterScroll = await evaluate(`(async () => {
  window.scrollTo(0, document.documentElement.scrollHeight);
  await new Promise(r => setTimeout(r, 1200));
  const a = document.querySelector('.id-card img');
  const r = a.getBoundingClientRect();
  return {nw: a.naturalWidth, nh: a.naturalHeight, complete: a.complete, rect: {w: +r.width.toFixed(1), h: +r.height.toFixed(1)}};
})()`);

await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await setSize(1440, 900, false);
await load(1800);
out.reducedMotion = await evaluate(`(() => {
  const stage = document.querySelector('.name-stage');
  const letters = [...document.querySelectorAll('.stage-word .letter')].map(el => +el.getBoundingClientRect().x.toFixed(1));
  return {
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    animClass: document.documentElement.classList.contains('anim'),
    stageTop: +stage.getBoundingClientRect().top.toFixed(1),
    stageHeight: +stage.getBoundingClientRect().height.toFixed(1),
    docH: document.documentElement.scrollHeight,
    letters,
    heroLetterTransform: getComputedStyle(document.querySelector('.hero .letter-in')).transform,
    heroMetaOpacity: getComputedStyle(document.querySelector('.hero-meta')).opacity,
  };
})()`);

console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
