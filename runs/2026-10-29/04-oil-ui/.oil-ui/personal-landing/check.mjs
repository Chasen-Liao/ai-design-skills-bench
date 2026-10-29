import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const chromePath = '/usr/bin/google-chrome';
const port = 9334;
const profile = '/tmp/chasen-cdp-check';
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
const events = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  } else if (m.method === 'Runtime.exceptionThrown' || m.method === 'Log.entryAdded') {
    events.push(m);
  }
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id; pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

const url = `file://${process.cwd()}/index.html`;
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(2600);

const out = {};
out.initial = await evaluate(`(() => {
  const wm = document.querySelector('.wordmark');
  const r = wm.getBoundingClientRect();
  const letters = [...document.querySelectorAll('.hero .letter-in')].map(el => getComputedStyle(el).transform);
  return {
    anim: document.documentElement.classList.contains('anim'),
    wordmarkWidth: +r.width.toFixed(1), wordmarkFont: getComputedStyle(wm).fontSize,
    wordmarkRight: +r.right.toFixed(1), viewport: innerWidth,
    letterTransforms: letters.slice(0, 2),
    metaOpacity: getComputedStyle(document.querySelector('.hero-meta')).opacity,
    docH: document.documentElement.scrollHeight,
    images: [...document.images].map(i => ({src: i.getAttribute('src'), nw: i.naturalWidth, nh: i.naturalHeight})),
  };
})()`);

out.todo = await evaluate(`(async () => {
  const y0 = scrollY;
  const a = document.querySelector('[data-todo]');
  a.click();
  await new Promise(r => setTimeout(r, 80));
  const toast = document.getElementById('toast');
  return {toastText: toast.textContent, toastShown: toast.classList.contains('show'), scrollMoved: scrollY !== y0};
})()`);

out.pin = await evaluate(`(async () => {
  const stage = document.querySelector('.name-stage');
  const top = stage.getBoundingClientRect().top + scrollY;
  window.scrollTo(0, top + 200);
  await new Promise(r => setTimeout(r, 600));
  const yMid = document.querySelector('.name-stage').getBoundingClientRect().top;
  const letters = [...document.querySelectorAll('.stage-word .letter')].map(el => +el.getBoundingClientRect().x.toFixed(1));
  window.scrollTo(0, top + 1215);
  await new Promise(r => setTimeout(r, 600));
  const yEnd = document.querySelector('.name-stage').getBoundingClientRect().top;
  const lettersEnd = [...document.querySelectorAll('.stage-word .letter')].map(el => +el.getBoundingClientRect().x.toFixed(1));
  const lineOpacity = getComputedStyle(document.querySelector('.stage-line')).opacity;
  return {yMid: +yMid.toFixed(1), yEnd: +yEnd.toFixed(1), letters, lettersEnd, lineOpacity};
})()`);

out.nav = await evaluate(`(async () => {
  document.querySelector('#work').scrollIntoView();
  await new Promise(r => setTimeout(r, 900));
  return {
    active: [...document.querySelectorAll('.nav a.is-active')].map(a => a.dataset.nav),
    scrolledBar: document.getElementById('topbar').classList.contains('is-scrolled'),
    railScale: getComputedStyle(document.getElementById('railFill')).transform,
  };
})()`);

out.menu = await evaluate(`(async () => {
  return {desktopMenuBtnDisplay: getComputedStyle(document.getElementById('menuBtn')).display};
})()`);

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await sleep(800);
out.mobile = await evaluate(`(async () => {
  window.scrollTo(0,0);
  await new Promise(r => setTimeout(r, 300));
  const btn = document.getElementById('menuBtn');
  btn.click();
  await new Promise(r => setTimeout(r, 300));
  const panel = document.getElementById('menuPanel');
  const open = {expanded: btn.getAttribute('aria-expanded'), hidden: panel.hidden, bodyOverflow: document.body.style.overflow, height: panel.getBoundingClientRect().height};
  document.querySelector('#menuPanel a[href="#work"]').click();
  await new Promise(r => setTimeout(r, 900));
  const closed = {expanded: btn.getAttribute('aria-expanded'), hidden: panel.hidden, bodyOverflow: document.body.style.overflow, scrollY: Math.round(scrollY)};
  return {open, closed, wordmarkWidth: +document.querySelector('.wordmark').getBoundingClientRect().width.toFixed(1), scrollW: document.documentElement.scrollWidth, innerW: innerWidth};
})()`);

out.zoom200 = await evaluate(`(() => {
  const wide = [...document.querySelectorAll('body *')].filter(el => {
    const r = el.getBoundingClientRect();
    if (el.closest('.ticker') || el.classList.contains('skip')) return false;
    return r.right > innerWidth + 1.5 || r.left < -1.5;
  }).map(el => ({tag: el.tagName, cls: String(el.className).slice(0,30), r: +el.getBoundingClientRect().right.toFixed(1)})).slice(0, 8);
  return {wide, docH: document.documentElement.scrollHeight};
})()`);

out.errors = events.length;
console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
