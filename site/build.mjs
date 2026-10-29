#!/usr/bin/env node
// Zero-dependency static site builder for the A1 design-skills benchmark.
// Usage: node site/build.mjs   ->   site/dist/
//
// 数据来源：runs/<RUN_DATE>/_metrics.json（会话 jsonl 精确统计）+ 各轮 meta.json。
// 旧版按 ZenMux 时间段估算的 site/data/_tokens.md 已弃用，构建不再读取。

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { SKILL_LABEL, NOTE_ZH } from './data/zh.mjs';

const RUN_DATE = '2026-10-29-r2';
const HERE = import.meta.dirname;
const REPO_ROOT = resolve(HERE, '..');
const RUNS_DIR = join(REPO_ROOT, 'runs', RUN_DATE);
const THUMBS_SRC = join(HERE, 'thumbs');
const DIST = join(HERE, 'dist');
const REPO_URL = 'https://github.com/Chasen-Liao/ai-design-skills-bench';

const MODEL_NAME = 'DeepSeek V4.1 Flash 1017';
const MODEL_LABEL = `${MODEL_NAME}（ZenMux / deepseek/deepseek-v4.1-flash）`;
const MODEL_ID = 'deepseek/deepseek-v4.1-flash';
const ROUND_LABEL = '2026-10-29 · r2';
const VERSION_LABEL = '未约束版 / V2';

// ---------------------------------------------------------------- utilities

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const readText = (path) => readFileSync(path, 'utf8');

const fmtInt = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '暂无';
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const hasNumber = (value) => Number.isFinite(Number(value)) && value !== null;

function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total)) return '暂无';
  const whole = Math.max(0, Math.round(total));
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins} 分 ${secs} 秒`;
}

const cstToZh = (value) => String(value ?? '').replace(/\s*CST$/, '（上海时间）');

function isPlainFile(dir, name) {
  if (name.startsWith('.')) return false;
  try {
    return statSync(join(dir, name)).isFile();
  } catch {
    return false;
  }
}

const zhNote = (raw) => {
  if (!raw) return '';
  if (Object.prototype.hasOwnProperty.call(NOTE_ZH, raw)) return NOTE_ZH[raw];
  console.warn(`warning: no Chinese note for: ${raw}`);
  return raw;
};

// ------------------------------------------------------------------ data load

function loadRuns() {
  const metricsPath = join(RUNS_DIR, '_metrics.json');
  if (!existsSync(metricsPath)) throw new Error(`missing ${metricsPath}`);
  const metrics = JSON.parse(readText(metricsPath));

  const dirs = readdirSync(RUNS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d\d/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  return dirs.map((name) => {
    const dir = join(RUNS_DIR, name);
    const meta = JSON.parse(readText(join(dir, 'meta.json')));
    const m = metrics[name];
    if (!m) console.warn(`warning: ${name} missing from _metrics.json`);
    const mm = m?.meta ?? {};

    const reviewPath = join(dir, 'review.md');
    const review = existsSync(reviewPath) ? readText(reviewPath).trim() : '';
    const rawNote = mm.note ?? meta.note ?? '';
    const tokens = m?.tokens ?? null;

    return {
      id: name,
      dir,
      meta,
      skill: SKILL_LABEL[name] ?? (meta.skill && meta.skill !== 'none' ? meta.skill : '无（裸 Pi 对照）'),
      start: mm.start ?? meta.start,
      end: mm.end ?? meta.end,
      duration: mm.duration_s ?? meta.duration_s,
      exit: mm.exit ?? null,
      bytes: mm.bytes ?? meta.bytes,
      llmCalls: m?.llm_calls ?? null,
      tokens,
      toolCalls: m?.tool_calls_total ?? null,
      readSkill: m?.read_skill === true,
      interrupted: /interrupted-but-html-ok/.test(rawNote) || mm.exit === null,
      note: zhNote(rawNote),
      review,
    };
  });
}

const sum = (runs, pick) =>
  runs.reduce((total, run) => {
    const value = pick(run);
    return Number.isFinite(Number(value)) ? total + Number(value) : total;
  }, 0);

// --------------------------------------------------------------- page helpers

const pageShell = ({ title, description, body, depth }) => {
  const css = depth === 0 ? 'style.css' : `${'../'.repeat(depth)}style.css`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#F4EFE6">
<link rel="stylesheet" href="${css}">
</head>
<body>
<a class="skip-link" href="#main">跳到主要内容</a>
${body}
</body>
</html>
`;
};

const topbar = ({ depth, right = '' }) => {
  const home = depth === 0 ? 'index.html' : `${'../'.repeat(depth)}index.html`;
  return `  <header class="topbar">
    <a class="brand" href="${home}">设计 Skill 横评</a>
    <span class="badge badge-v2">${esc(VERSION_LABEL)}</span>
    <span class="topbar-meta">${esc(ROUND_LABEL)}</span>
    <span class="spacer"></span>
    ${right}
    <a class="topbar-link repo-link" href="${esc(REPO_URL)}">GitHub</a>
  </header>`;
};

const flag = (kind, text) => `<span class="flag flag-${kind}">${esc(text)}</span>`;
const interruptedFlag = (run) => (run.interrupted ? flag('warn', '中途断过') : '');
const readSkillFlag = (run) => (run.readSkill ? flag('ok', '是') : flag('mute', '否'));

const exitCell = (run) => (hasNumber(run.exit) ? esc(run.exit) : flag('warn', '中断'));

const reviewBlock = (review) =>
  review
    ? review
        .split(/\n\s*\n/)
        .map((paragraph) => `      <p>${esc(paragraph.trim()).replace(/\n/g, '<br>')}</p>`)
        .join('\n')
  : '      <p class="placeholder">待 Chasen 填写</p>';

const tokenCells = (tokens, key) => (tokens && hasNumber(tokens[key]) ? fmtInt(tokens[key]) : '暂无');

// ------------------------------------------------------------------- overview

function buildIndex(runs, prompt) {
  const totals = {
    llmCalls: sum(runs, (run) => run.llmCalls),
    toolCalls: sum(runs, (run) => run.toolCalls),
    input: sum(runs, (run) => run.tokens?.input),
    output: sum(runs, (run) => run.tokens?.output),
    cacheRead: sum(runs, (run) => run.tokens?.cacheRead),
    readSkill: runs.filter((run) => run.readSkill).length,
    withPage: runs.filter((run) => hasNumber(run.bytes) && Number(run.bytes) > 0).length,
  };

  const cards = runs
    .map((run, index) => {
      const thumbPath = join(DIST, 'thumbs', `${run.id}.webp`);
      const thumb = existsSync(thumbPath)
        ? `<img src="thumbs/${esc(run.id)}.webp" alt="${esc(run.id)} 页面缩略图" loading="lazy" width="720" height="450">`
        : '<div class="thumb-missing">缩略图缺失</div>';
      return `      <a class="card" href="runs/${esc(run.id)}/detail.html">
        <div class="card-thumb">
          ${thumb}
          <span class="card-idx">${String(index).padStart(2, '0')}</span>
          <span class="card-flags">${interruptedFlag(run)}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${esc(run.skill)}</h3>
          <dl class="card-metrics">
            <div><dt>耗时</dt><dd>${esc(formatDuration(run.duration))}</dd></div>
            <div><dt>LLM 调用</dt><dd>${esc(fmtInt(run.llmCalls))}</dd></div>
            <div><dt>工具调用</dt><dd>${esc(fmtInt(run.toolCalls))}</dd></div>
          </dl>
          <p class="card-foot"><span>读了 skill ${readSkillFlag(run)}</span><span class="go">查看详情</span></p>
        </div>
      </a>`;
    })
    .join('\n');

  const tableRows = runs
    .map(
      (run) => `          <tr>
            <th scope="row" class="col-id"><a href="runs/${esc(run.id)}/detail.html">${esc(run.id)}</a></th>
            <td class="skill">${esc(run.skill)}</td>
            <td class="num">${esc(formatDuration(run.duration))}${interruptedFlag(run)}</td>
            <td class="num">${exitCell(run)}</td>
            <td class="num">${esc(fmtInt(run.bytes))}</td>
            <td class="num">${esc(fmtInt(run.llmCalls))}</td>
            <td class="num">${tokenCells(run.tokens, 'input')}</td>
            <td class="num">${tokenCells(run.tokens, 'output')}</td>
            <td class="num">${tokenCells(run.tokens, 'cacheRead')}</td>
            <td class="num">${esc(fmtInt(run.toolCalls))}</td>
            <td>${readSkillFlag(run)}</td>
            <td class="na">暂无</td>
          </tr>`,
    )
    .join('\n');

  const body = `${topbar({ depth: 0 })}
  <main class="wrap" id="main">
    <header class="hero">
      <p class="eyebrow">A1 个人介绍落地页 · 第二轮实测 · 10 组</p>
      <h1>10 个设计 skill，同一段提示词、同一个模型</h1>
      <p class="lede">只差「给不给 skill」和「给哪一个」。这一版是未约束版：提示词只要求用 skill，没有限制模型自检多少轮，于是它写了又测、测了又改。</p>
      <ul class="hero-tags">
        <li>${esc(VERSION_LABEL)}</li>
        <li>${esc(MODEL_NAME)}</li>
        <li>极简 Pi 四工具</li>
        <li>不排名 · 不打分</li>
      </ul>
    </header>

    <section class="callout" aria-labelledby="v2-title">
      <div class="callout-head">
        <span class="badge badge-v2">${esc(VERSION_LABEL)}</span>
        <h2 id="v2-title">这一版故意不约束模型</h2>
      </div>
      <div class="callout-cols">
        <div>
          <h3>三同设定</h3>
          <ul>
            <li><strong>同一提示词</strong>：A1 个人介绍落地页（原文见下方）。</li>
            <li><strong>同一模型</strong>：${esc(MODEL_NAME)}，<code>${esc(MODEL_ID)}</code>。</li>
            <li><strong>同一运行框架</strong>：极简 Pi，只有 read / bash / edit / write 四个工具，<code>--no-session</code>。</li>
          </ul>
        </div>
        <div>
          <h3>未约束在哪</h3>
          <ul>
            <li>每个目录只装一个被测 skill，00-bare 为不装 skill 的对照。</li>
            <li>提示词只要求「用上这个 skill」，<strong>没有禁止自检</strong>，也没有要求一次成版。</li>
            <li>实测：多数跑次写完后反复自检——多轮截图、lint、DOM 探测、CSS 微调，出现明显的过度思考与重复验证。</li>
          </ul>
        </div>
      </div>
      <p class="soon"><strong>V3（一次成版）即将并列</strong>：会限制自检轮次、要求一次成型，届时与本站数据并排对照，才能看出约束本身值多少时间与 token。</p>
    </section>

    <section aria-labelledby="stats-title">
      <h2 id="stats-title">会话总量</h2>
      <p class="section-note">按 _metrics.json 逐轮累加，仅描述这一轮的实测开销，不作为排名依据。</p>
      <dl class="stats">
        <div class="stat"><span class="label">跑次</span><span class="value">${runs.length}<small>组</small></span></div>
        <div class="stat"><span class="label">产出页面</span><span class="value">${totals.withPage}<small>/ ${runs.length}</small></span></div>
        <div class="stat"><span class="label">LLM 调用</span><span class="value">${esc(fmtInt(totals.llmCalls))}</span></div>
        <div class="stat"><span class="label">工具调用</span><span class="value">${esc(fmtInt(totals.toolCalls))}</span></div>
        <div class="stat"><span class="label">输入 token</span><span class="value">${esc(fmtInt(totals.input))}</span></div>
        <div class="stat"><span class="label">输出 token</span><span class="value">${esc(fmtInt(totals.output))}</span></div>
        <div class="stat"><span class="label">缓存读取</span><span class="value">${esc(fmtInt(totals.cacheRead))}</span></div>
        <div class="stat"><span class="label">读了 skill</span><span class="value">${totals.readSkill}<small>/ ${runs.length}</small></span></div>
      </dl>
    </section>

    <section aria-labelledby="grid-title">
      <h2 id="grid-title">10 组实测</h2>
      <p class="section-note">缩略图取自各轮的 shot-hero.png；点开可看原页面、全页截图与数据明细。</p>
      <div class="grid">
${cards}
      </div>
    </section>

    <section aria-labelledby="data-title">
      <h2 id="data-title">实测数据</h2>
      <p class="section-note">向左滑动可看完整列。数字全部取自会话统计，未做四舍五入之外的加工。</p>
      <div class="table-wrap">
        <table class="dense">
          <thead>
            <tr class="groups">
              <th class="col-id" rowspan="2" scope="col">轮次</th>
              <th rowspan="2" scope="col" class="skill">被测 skill</th>
              <th colspan="3" scope="colgroup">产出</th>
              <th colspan="7" scope="colgroup">会话开销</th>
            </tr>
            <tr>
              <th scope="col">耗时</th>
              <th scope="col">退出码</th>
              <th scope="col">页面字节</th>
              <th scope="col">LLM 调用</th>
              <th scope="col">输入 token</th>
              <th scope="col">输出 token</th>
              <th scope="col">缓存读取</th>
              <th scope="col">工具调用</th>
              <th scope="col">读了 skill</th>
              <th scope="col">费用</th>
            </tr>
          </thead>
          <tbody>
${tableRows}
          </tbody>
        </table>
      </div>
      <div class="fine">
        <ul>
          <li>数字来源：<code>runs/${esc(RUN_DATE)}/_metrics.json</code>（按各轮 Pi 会话 jsonl 逐条累加），不再使用旧版按 ZenMux 时间段估算的 token 表。</li>
          <li>token 说明：输入 token 绝大部分是缓存命中，缓存读取单独成列；两者不要相加后当作「成本」比较。</li>
          <li>00-bare 是裸 Pi 对照，目录里不装 skill，所以「读了 skill」为「否」属预期。</li>
          <li>08-taste-skill 中途断过但有页面：会话在检查循环里中断，index.html 已在磁盘并完成截图；耗时与 token 仍取会话统计，退出码没有记录。</li>
          <li>费用没有取得实际账单，统一记为「暂无」，不做估算。</li>
          <li>窄屏下表格会隐藏「被测 skill」列以留出数字空间，轮次与上方卡片一一对应。</li>
          <li>不排名、不打分；评价位由 Chasen 手写。</li>
        </ul>
      </div>
    </section>

    <section aria-labelledby="prompt-title">
      <details class="prompt" open>
        <summary id="prompt-title">统一提示词原文</summary>
        <pre>${esc(prompt)}</pre>
      </details>
    </section>

    <footer class="footer">
      <p class="repo"><a href="${esc(REPO_URL)}">${esc(REPO_URL)}</a></p>
      <p>数据：runs/${esc(RUN_DATE)}/_metrics.json、各轮 meta.json 与会话日志。站点构建：node site/build.mjs。</p>
    </footer>
  </main>`;

  return pageShell({
    title: `设计 Skill 横评 · ${VERSION_LABEL}`,
    description: '10 个设计 skill 在同一提示词、同一模型下的 A1 个人介绍落地页实测记录：未约束版 V2。',
    body,
    depth: 0,
  });
}

// --------------------------------------------------------------------- detail

function buildDetail(run, prev, next) {
  const nav = [
    '<a class="back" href="../../index.html">← 返回总览</a>',
    '<span class="pager">',
    prev
      ? `<a href="../${esc(prev.id)}/detail.html">← ${esc(prev.id)}</a>`
      : '<span class="disabled">← 上一个</span>',
    next
      ? `<a href="../${esc(next.id)}/detail.html">${esc(next.id)} →</a>`
      : '<span class="disabled">下一个 →</span>',
    '</span>',
  ].join('\n      ');

  const facts = [
    ['开始', cstToZh(run.start) || '暂无'],
    ['结束', cstToZh(run.end) || '暂无'],
    ['耗时', formatDuration(run.duration)],
    ['退出码', hasNumber(run.exit) ? String(run.exit) : '无记录（会话中断）'],
    ['页面字节', fmtInt(run.bytes)],
    ['LLM 调用', fmtInt(run.llmCalls)],
    ['输入 token', tokenCells(run.tokens, 'input')],
    ['输出 token', tokenCells(run.tokens, 'output')],
    ['缓存读取 token', tokenCells(run.tokens, 'cacheRead')],
    ['工具调用总数', fmtInt(run.toolCalls)],
    ['读了 skill', run.readSkill ? '是' : '否'],
    ['费用', '暂无'],
    ['备注', run.note || '无异常记录'],
  ];

  const factRows = facts
    .map(([label, value]) => {
      const mono = /[\d]/.test(String(value)) && String(value).length < 24 ? ' class="mono"' : '';
      return `            <tr><th scope="row">${esc(label)}</th><td${mono}>${esc(value)}</td></tr>`;
    })
    .join('\n');

  const notice = run.interrupted
    ? `    <aside class="notice">
      ${flag('warn', '中途断过但有页面')}
      <span>本轮会话在检查循环里中断，没有正常收尾；index.html 已在磁盘并完成截图。耗时与 token 取会话统计，退出码没有记录。</span>
    </aside>`
    : '';

  const stats = [
    ['耗时', formatDuration(run.duration)],
    ['LLM 调用', fmtInt(run.llmCalls)],
    ['工具调用', fmtInt(run.toolCalls)],
    ['输入 token', tokenCells(run.tokens, 'input')],
    ['输出 token', tokenCells(run.tokens, 'output')],
    ['缓存读取', tokenCells(run.tokens, 'cacheRead')],
    ['读了 skill', run.readSkill ? '是' : '否'],
    ['费用', '暂无'],
  ]
    .map(
      ([label, value]) =>
        `        <div class="stat"><span class="label">${esc(label)}</span><span class="value">${esc(value)}</span></div>`,
    )
    .join('\n');

  const reviewEmpty = run.review ? '' : ' is-empty';

  const body = `${topbar({
    depth: 2,
    right: `<a class="topbar-link" href="index.html" target="_blank" rel="noopener">原页面</a>`,
  })}
  <main class="wrap" id="main">
    <nav class="topnav" aria-label="页面导航">
      ${nav}
    </nav>

    <header class="hero detail-head">
      <p class="eyebrow">${esc(VERSION_LABEL)} · 第 ${esc(run.id.slice(0, 2))} 组</p>
      <h1><span class="idx">${esc(run.id.slice(0, 2))}</span>${esc(run.skill)}</h1>
      <p class="lede">同一提示词 · 同一模型 ${esc(MODEL_LABEL)} · 极简 Pi 四工具 · 只装这一个 skill。</p>
      <ul class="chip-row">
        <li>${esc(run.id)}</li>
        <li>读了 skill：${run.readSkill ? '是' : '否'}</li>
        <li>退出码：${hasNumber(run.exit) ? esc(run.exit) : '无记录'}</li>
        <li>费用：暂无</li>
      </ul>
    </header>
${notice}

    <section aria-labelledby="stats-title">
      <h2 id="stats-title">关键数字</h2>
      <dl class="stats">
${stats}
      </dl>
    </section>

    <section aria-labelledby="facts-title">
      <h2 id="facts-title">实测数据</h2>
      <div class="table-wrap">
        <table class="kv">
          <tbody>
${factRows}
          </tbody>
        </table>
      </div>
      <p class="fine">数字取自 <code>runs/${esc(RUN_DATE)}/_metrics.json</code>；费用没有实际账单，记为「暂无」。不排名、不打分。</p>
    </section>

    <section aria-labelledby="live-title">
      <h2 id="live-title">真实页面</h2>
      <p class="section-note">直接渲染本轮产出的 index.html，未做任何修改。</p>
      <div class="browser">
        <div class="browser-bar">
          <span class="browser-path">runs/${esc(run.id)}/index.html</span>
          <span class="spacer"></span>
          <a class="button" href="index.html" target="_blank" rel="noopener">新窗口打开</a>
        </div>
        <iframe class="live-frame" src="index.html" loading="lazy" title="${esc(run.id)} 生成的页面"></iframe>
      </div>
    </section>

    <section aria-labelledby="shot-title">
      <h2 id="shot-title">全页截图</h2>
      <div class="shot-frame">
        <a href="shot-desktop.png" target="_blank" rel="noopener"><img src="shot-desktop.png" loading="lazy" alt="${esc(run.id)} 全页截图"></a>
      </div>
    </section>

    <section aria-labelledby="review-title">
      <h2 id="review-title">Chasen 的评价</h2>
      <div class="review${reviewEmpty}">
${reviewBlock(run.review)}
      </div>
      <p class="fine">编辑 runs/${esc(RUN_DATE)}/${esc(run.id)}/review.md 后重新构建即可更新。</p>
    </section>

    <footer class="footer">
      <p class="repo"><a href="${esc(REPO_URL)}">${esc(REPO_URL)}</a></p>
      <p>数据：runs/${esc(RUN_DATE)}/_metrics.json · runs/${esc(RUN_DATE)}/${esc(run.id)}/meta.json</p>
    </footer>
  </main>`;

  return pageShell({
    title: `${run.id} · ${run.skill} · 设计 Skill 横评`,
    description: `${run.id}（${run.skill}）在未约束版 V2 中的实测数据与页面。`,
    body,
    depth: 2,
  });
}

// ----------------------------------------------------------------------- main

function main() {
  const runs = loadRuns();
  const promptPath = join(RUNS_DIR, '_prompt-a1.txt');
  const prompt = existsSync(promptPath) ? readText(promptPath) : '（提示词原文缺失）';

  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  mkdirSync(join(DIST, 'thumbs'), { recursive: true });

  // style
  copyFileSync(join(HERE, 'style.css'), join(DIST, 'style.css'));

  // thumbs
  for (const run of runs) {
    const src = join(THUMBS_SRC, `${run.id}.webp`);
    if (existsSync(src)) {
      copyFileSync(src, join(DIST, 'thumbs', `${run.id}.webp`));
    } else {
      console.warn(`warning: missing thumbnail ${src}`);
    }
  }

  // run assets + detail pages
  runs.forEach((run, index) => {
    const outDir = join(DIST, 'runs', run.id);
    mkdirSync(outDir, { recursive: true });

    for (const name of readdirSync(run.dir)) {
      if (!isPlainFile(run.dir, name)) continue;
      copyFileSync(join(run.dir, name), join(outDir, name));
    }

    const prev = index > 0 ? runs[index - 1] : null;
    const next = index < runs.length - 1 ? runs[index + 1] : null;
    writeFileSync(join(outDir, 'detail.html'), buildDetail(run, prev, next), 'utf8');
  });

  // overview
  writeFileSync(join(DIST, 'index.html'), buildIndex(runs, prompt), 'utf8');

  console.log(`built ${runs.length} runs -> ${DIST}`);
  for (const run of runs) console.log(`  runs/${run.id}/ (${basename(run.dir)})`);
}

main();
