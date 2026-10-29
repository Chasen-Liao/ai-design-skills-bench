import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const chromePath = '/usr/bin/google-chrome';
const port = 9333;
const profile = '/tmp/chasen-cdp-profile';
rmSync(profile, { recursive: true, force: true });

const proc = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitPort() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return;
    } catch {}
    await sleep(150);
  }
  throw new Error('chrome did not start');
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  return {
    ready,
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    }),
    close: () => ws.close(),
  };
}

const url = process.argv[2] || 'index.html';
const width = Number(process.argv[3] || 1440);
const height = Number(process.argv[4] || 900);
const scrollTo = Number(process.argv[5] || 0);

await waitPort();
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const client = cdp(target.webSocketDebuggerUrl);
await client.ready;
await client.send('Page.enable');
await client.send('Runtime.enable');
await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
await client.send('Page.navigate', { url: `file://${process.cwd()}/${url}` });
await sleep(3500);
if (scrollTo) {
  await client.send('Runtime.evaluate', { expression: `window.scrollTo(0, ${scrollTo})` });
  await sleep(1200);
}

const expr = `(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      rect: {x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1)},
      opacity: cs.opacity, fontSize: cs.fontSize, lineHeight: cs.lineHeight,
      color: cs.color, bg: cs.backgroundColor,
      text: (el.textContent || '').trim().slice(0, 40),
    };
  };
  const all = [...document.querySelectorAll('body *')];
  const overflow = all.filter(el => {
    const r = el.getBoundingClientRect();
    return r.right > innerWidth + 1.5 || r.left < -1.5;
  }).slice(0, 12).map(el => ({
    tag: el.tagName, cls: el.className && String(el.className).slice(0, 40),
    left: +el.getBoundingClientRect().left.toFixed(1),
    right: +el.getBoundingClientRect().right.toFixed(1),
    text: (el.textContent || '').trim().slice(0, 30),
  }));
  const fonts = [...document.fonts].map(f => f.family + ' ' + f.weight + ' ' + f.status);
  return {
    viewport: {w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight},
    scrollY,
    fontsLoaded: document.fonts.status,
    families: [...new Set(fonts)],
    wordmark: box('.wordmark'),
    stageWord: box('.stage-word'),
    hero: box('.hero'),
    heroMeta: box('.hero-meta'),
    lede: box('.lede'),
    cta: box('.cta-group'),
    ticker: box('.ticker'),
    about: box('#about'),
    portrait: box('.portrait img'),
    stage: box('.name-stage'),
    feature: box('.feature'),
    desk: box('.desk'),
    contact: box('.contact'),
    channels: box('.channels'),
    rail: box('.rail'),
    stageLetters: [...document.querySelectorAll('.stage-word .letter')].map(el => ({
      x: +el.getBoundingClientRect().x.toFixed(1),
      w: +el.getBoundingClientRect().width.toFixed(1),
      t: getComputedStyle(el).transform,
    })),
    stageN: box('.stage-n .letter-in'),
    stageLine: box('.stage-line'),
    rows: [...document.querySelectorAll('.work-row')].map(el => ({op: getComputedStyle(el).opacity, y: +el.getBoundingClientRect().y.toFixed(0)})),
    stageCopy: box('.stage-copy'),
    skills: box('#skills'),
    workRows: box('.work-list'),
    now: box('.now'),
    contactLede: box('.contact-lede'),
    contactSub: box('.contact-sub'),
    roles: box('.roles'),
    contactCta: box('.contact-cta'),
    idCard: box('.id-card'),
    footer: box('.footer'),
    headerY: (() => { const h = document.querySelector('.topbar'); return h ? h.getBoundingClientRect().y : null; })(),
    overflow,
  };
})()`;

const res = await client.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
console.log(JSON.stringify(res.result.value, null, 2));
client.close();
proc.kill();
rmSync(profile, { recursive: true, force: true });
