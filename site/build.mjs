#!/usr/bin/env node
// Zero-dependency static site builder for the A1 design-skills benchmark.
// Usage: node site/build.mjs   ->   site/dist/
//
// 支持多版并列（V2 / V3）：总览可切换；详情为 runs/<id>/detail.html 左右栏对比。
// 数据来源：runs/<RUN_DATE>/_metrics.json + 各轮 meta.json。原始产出仅复制，不改写。

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { SKILL_LABEL, NOTE_ZH } from './data/zh.mjs';

const HERE = import.meta.dirname;
const REPO_ROOT = resolve(HERE, '..');
const THUMBS_SRC = join(HERE, 'thumbs');
const DIST = join(HERE, 'dist');
const REPO_URL = 'https://github.com/Chasen-Liao/ai-design-skills-bench';

const MODEL_NAME = 'DeepSeek V4.1 Flash 1017';
const MODEL_LABEL = `${MODEL_NAME}（ZenMux / deepseek/deepseek-v4.1-flash）`;
const MODEL_ID = 'deepseek/deepseek-v4.1-flash';

/** @type {Array<{
 *   key: string,
 *   runDate: string,
 *   versionShort: string,
 *   versionLabel: string,
 *   badgeClass: string,
 *   roundLabel: string,
 *   constraintTitle: string,
 *   constraintBlurb: string,
 *   constraintPoints: string[],
 *   eyebrow: string,
 *   heroLede: string,
 * }>} */
const EDITIONS = [
  {
    key: 'v2',
    runDate: '2026-10-29-r2',
    versionShort: 'V2',
    versionLabel: '未约束版（会过度自检）',
    badgeClass: 'badge-v2',
    roundLabel: '2026-10-29 · r2',
    constraintTitle: '未约束：会过度自检',
    constraintBlurb:
      '提示词只要求用上 skill，没有禁止自检，也没有要求一次成版。实测：多数跑次写完后反复截图、lint、DOM 探测、CSS 微调。',
    constraintPoints: [
      '每个目录只装一个被测 skill，00-bare 为不装 skill 的对照。',
      '提示词只要求「用上这个 skill」，没有禁止自检，也没有要求一次成版。',
      '多数跑次写完后反复自检——多轮截图、lint、DOM 探测、CSS 微调。',
    ],
    eyebrow: 'A1 个人介绍落地页 · 第二轮实测 · 10 组',
    heroLede:
      '只差「给不给 skill」和「给哪一个」。这一版是未约束版：提示词只要求用 skill，没有限制模型自检多少轮，于是它写了又测、测了又改。',
  },
  {
    key: 'v3',
    runDate: '2026-10-29-r3',
    versionShort: 'V3',
    versionLabel: '一次成版 + thinking high',
    badgeClass: 'badge-v3',
    roundLabel: '2026-10-29 · r3',
    constraintTitle: '一次成版 + thinking high',
    constraintBlurb:
      '同一提示词族追加硬约束：禁止反复自检与无头浏览器验证，最多一次小幅修正；模型侧开启 thinking high。',
    constraintPoints: [
      '提示词追加「一次性成版交付」：禁止反复自检、截图循环与多轮大改，最多一次小幅修正。',
      '模型参数：`--thinking high`（ZenMux / deepseek/deepseek-v4.1-flash）。',
      '其余设定与 V2 相同：同一 A1 资料、同一极简 Pi 四工具、每目录只装一个 skill。',
    ],
    eyebrow: 'A1 个人介绍落地页 · 第三轮实测 · 10 组',
    heroLede:
      '与 V2 同一提示词族、同一模型。差别只在约束：要求一次成版，并打开 thinking high，用来对照「限制自检」本身值多少时间与 token。',
  },
];

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

const sum = (runs, pick) =>
  runs.reduce((total, run) => {
    const value = pick(run);
    return Number.isFinite(Number(value)) ? total + Number(value) : total;
  }, 0);

const tokenCells = (tokens, key) => (tokens && hasNumber(tokens[key]) ? fmtInt(tokens[key]) : '暂无');

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

function findThumb(editionKey, runId) {
  const candidates = [
    join(THUMBS_SRC, editionKey, `${runId}.webp`),
    join(THUMBS_SRC, `${editionKey}-${runId}.webp`),
    join(THUMBS_SRC, `${runId}.webp`),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

// ------------------------------------------------------------------ data load

function loadRuns(edition) {
  const runsDir = join(REPO_ROOT, 'runs', edition.runDate);
  const metricsPath = join(runsDir, '_metrics.json');
  if (!existsSync(metricsPath)) throw new Error(`missing ${metricsPath}`);
  const metrics = JSON.parse(readText(metricsPath));

  const dirs = readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d\d/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  return dirs.map((name) => {
    const dir = join(runsDir, name);
    const meta = JSON.parse(readText(join(dir, 'meta.json')));
    const m = metrics[name];
    if (!m) console.warn(`warning: ${name} missing from _metrics.json (${edition.key})`);
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

function loadPrompt(edition) {
  const runsDir = join(REPO_ROOT, 'runs', edition.runDate);
  const candidates = [join(runsDir, '_prompt-a1.txt'), join(runsDir, '00-bare', 'prompt.txt')];
  for (const path of candidates) {
    if (existsSync(path)) return readText(path);
  }
  return '（提示词原文缺失）';
}

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

const topbar = ({ depth, edition = null, right = '' }) => {
  const home = depth === 0 ? 'index.html' : `${'../'.repeat(depth)}index.html`;
  const badge = edition
    ? `<span class="badge ${esc(edition.badgeClass)}">${esc(edition.versionShort)} · ${esc(edition.versionLabel)}</span>
    <span class="topbar-meta">${esc(edition.roundLabel)}</span>`
    : `<span class="badge badge-outline">V2 · V3 并列</span>
    <span class="topbar-meta">2026-10-29 · r2 / r3</span>`;
  return `  <header class="topbar">
    <a class="brand" href="${home}">设计 Skill 横评</a>
    ${badge}
    <span class="spacer"></span>
    ${right}
    <a class="topbar-link repo-link" href="${esc(REPO_URL)}">GitHub</a>
  </header>`;
};

function editionTotals(runs) {
  return {
    llmCalls: sum(runs, (run) => run.llmCalls),
    toolCalls: sum(runs, (run) => run.toolCalls),
    input: sum(runs, (run) => run.tokens?.input),
    output: sum(runs, (run) => run.tokens?.output),
    cacheRead: sum(runs, (run) => run.tokens?.cacheRead),
    readSkill: runs.filter((run) => run.readSkill).length,
    withPage: runs.filter((run) => hasNumber(run.bytes) && Number(run.bytes) > 0).length,
    duration: sum(runs, (run) => run.duration),
  };
}

function buildEditionPanel(edition, runs) {
  const totals = editionTotals(runs);
  const cards = runs
    .map((run, index) => {
      const thumbRel = `thumbs/${edition.key}/${run.id}.webp`;
      const thumbPath = join(DIST, 'thumbs', edition.key, `${run.id}.webp`);
      const thumb = existsSync(thumbPath)
        ? `<img src="${esc(thumbRel)}" alt="${esc(run.id)} 页面缩略图" loading="lazy" width="720" height="450">`
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
          <p class="card-foot"><span>读了 skill ${readSkillFlag(run)}</span><span class="go">左右对比</span></p>
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

  const points = edition.constraintPoints.map((item) => `            <li>${item}</li>`).join('\n');

  return `    <section class="edition-panel" id="${esc(edition.key)}" data-edition="${esc(edition.key)}" hidden>
      <header class="edition-head">
        <div class="edition-head-text">
          <p class="eyebrow">${esc(edition.eyebrow)}</p>
          <h2><span class="badge ${esc(edition.badgeClass)}">${esc(edition.versionShort)}</span> ${esc(edition.versionLabel)}</h2>
          <p class="lede">${esc(edition.heroLede)}</p>
        </div>
        <ul class="hero-tags">
          <li>${esc(edition.versionShort)} · ${esc(edition.versionLabel)}</li>
          <li>${esc(MODEL_NAME)}</li>
          <li>${esc(edition.roundLabel)}</li>
          <li>不排名 · 不打分</li>
        </ul>
      </header>

      <div class="callout" aria-labelledby="${esc(edition.key)}-constraint">
        <div class="callout-head">
          <span class="badge ${esc(edition.badgeClass)}">${esc(edition.versionShort)}</span>
          <h3 id="${esc(edition.key)}-constraint">${esc(edition.constraintTitle)}</h3>
        </div>
        <p>${esc(edition.constraintBlurb)}</p>
        <ul>
${points}
        </ul>
      </div>

      <div class="edition-block" aria-labelledby="${esc(edition.key)}-stats">
        <h3 id="${esc(edition.key)}-stats">会话总量</h3>
        <p class="section-note">按 _metrics.json 逐轮累加，仅描述这一版的实测开销，不作为排名依据。</p>
        <dl class="stats">
          <div class="stat"><span class="label">跑次</span><span class="value">${runs.length}<small>组</small></span></div>
          <div class="stat"><span class="label">产出页面</span><span class="value">${totals.withPage}<small>/ ${runs.length}</small></span></div>
          <div class="stat"><span class="label">总耗时</span><span class="value">${esc(formatDuration(totals.duration))}</span></div>
          <div class="stat"><span class="label">LLM 调用</span><span class="value">${esc(fmtInt(totals.llmCalls))}</span></div>
          <div class="stat"><span class="label">工具调用</span><span class="value">${esc(fmtInt(totals.toolCalls))}</span></div>
          <div class="stat"><span class="label">输入 token</span><span class="value">${esc(fmtInt(totals.input))}</span></div>
          <div class="stat"><span class="label">输出 token</span><span class="value">${esc(fmtInt(totals.output))}</span></div>
          <div class="stat"><span class="label">读了 skill</span><span class="value">${totals.readSkill}<small>/ ${runs.length}</small></span></div>
        </dl>
      </div>

      <div class="edition-block" aria-labelledby="${esc(edition.key)}-grid">
        <h3 id="${esc(edition.key)}-grid">10 组实测</h3>
        <p class="section-note">缩略图取自各轮的 shot-hero.png；点开进入同一 skill 的 V2 / V3 左右栏对比（原页面、截图、指标与评价位分列）。</p>
        <div class="grid">
${cards}
        </div>
      </div>

      <div class="edition-block" aria-labelledby="${esc(edition.key)}-data">
        <h3 id="${esc(edition.key)}-data">实测数据</h3>
        <p class="section-note">向左滑动可看完整列。数字全部取自会话统计，未做四舍五入之外的加工。费用没有实际账单，统一「暂无」。</p>
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
            <li>数字来源：<code>runs/${esc(edition.runDate)}/_metrics.json</code>（按各轮 Pi 会话 jsonl 逐条累加）。</li>
            <li>token 说明：输入 token 绝大部分是缓存命中，缓存读取单独成列；两者不要相加后当作「成本」比较。</li>
            <li>00-bare 是裸 Pi 对照，目录里不装 skill；「读了 skill」以会话统计为准。</li>
            <li>费用没有取得实际账单，统一记为「暂无」，不做估算。</li>
            <li>不排名、不打分；评价位由 Chasen 手写。</li>
          </ul>
        </div>
      </div>
    </section>`;
}

function buildIndex(editionsData) {
  const switchButtons = editionsData
    .map(
      ({ edition }, index) =>
        `        <button type="button" class="edition-tab${index === 0 ? ' is-active' : ''}" data-edition-tab="${esc(edition.key)}" aria-pressed="${index === 0 ? 'true' : 'false'}">
          <span class="badge ${esc(edition.badgeClass)}">${esc(edition.versionShort)}</span>
          <span class="edition-tab-label">${esc(edition.versionLabel)}</span>
          <span class="edition-tab-meta">${esc(edition.roundLabel)}</span>
        </button>`,
    )
    .join('\n');

  const panels = editionsData.map(({ edition, runs }) => buildEditionPanel(edition, runs)).join('\n\n');

  const promptBlocks = editionsData
    .map(({ edition, prompt }) => {
      const open = edition.key === 'v2' ? ' open' : '';
      return `      <details class="prompt"${open}>
        <summary>${esc(edition.versionShort)} 提示词原文 · ${esc(edition.runDate)}</summary>
        <pre>${esc(prompt)}</pre>
      </details>`;
    })
    .join('\n');

  const body = `${topbar({ depth: 0 })}
  <main class="wrap" id="main">
    <header class="hero">
      <p class="eyebrow">A1 个人介绍落地页 · V2 / V3 并列实测</p>
      <h1>10 个设计 skill，同一提示词族、同一个模型</h1>
      <p class="lede">两版共用 A1 个人介绍资料与 DeepSeek V4.1 Flash 1017（ZenMux）。差别只在约束：V2 未限制自检；V3 要求一次成版并开启 thinking high。不排名、不打分。</p>
      <ul class="hero-tags">
        <li>同一提示词族</li>
        <li>${esc(MODEL_NAME)}</li>
        <li>极简 Pi 四工具</li>
        <li>不排名 · 不打分</li>
      </ul>
    </header>

    <section class="callout shared-callout" aria-labelledby="shared-title">
      <div class="callout-head">
        <span class="badge badge-outline">对照设定</span>
        <h2 id="shared-title">三同 + 一异</h2>
      </div>
      <div class="callout-cols">
        <div>
          <h3>相同</h3>
          <ul>
            <li><strong>同一提示词族</strong>：A1 个人介绍落地页（资料与任务相同；V3 在文末追加一次成版约束）。</li>
            <li><strong>同一模型</strong>：${esc(MODEL_NAME)}，<code>${esc(MODEL_ID)}</code>。</li>
            <li><strong>同一运行框架</strong>：极简 Pi，只有 read / bash / edit / write，<code>--no-session</code>。</li>
          </ul>
        </div>
        <div>
          <h3>不同</h3>
          <ul>
            <li><strong>V2</strong>：未约束版（会过度自检）· 数据 <code>2026-10-29-r2</code>。</li>
            <li><strong>V3</strong>：一次成版 + thinking high · 数据 <code>2026-10-29-r3</code>。</li>
            <li>评价位仍空着，由 Chasen 手写；本站不做排名打分。</li>
          </ul>
        </div>
      </div>
    </section>

    <nav class="edition-switch" aria-label="版本切换">
${switchButtons}
    </nav>

${panels}

    <section aria-labelledby="prompt-title">
      <h2 id="prompt-title">统一提示词原文</h2>
      <p class="section-note">两版同属 A1 提示词族；V3 在文末多了一次成版约束段。点开可看全文。</p>
${promptBlocks}
    </section>

    <footer class="footer">
      <p class="repo"><a href="${esc(REPO_URL)}">${esc(REPO_URL)}</a></p>
      <p>数据：runs/2026-10-29-r2、runs/2026-10-29-r3 的 _metrics.json、各轮 meta.json 与会话日志。站点构建：node site/build.mjs。</p>
    </footer>
  </main>
  <script>
  (function () {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-edition-tab]'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('[data-edition]'));
    if (!tabs.length || !panels.length) return;

    function show(key, pushHash) {
      tabs.forEach(function (tab) {
        var on = tab.getAttribute('data-edition-tab') === key;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      panels.forEach(function (panel) {
        var on = panel.getAttribute('data-edition') === key;
        if (on) panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
      });
      if (pushHash && history.replaceState) {
        history.replaceState(null, '', '#' + key);
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        show(tab.getAttribute('data-edition-tab'), true);
      });
    });

    var initial = (location.hash || '').replace(/^#/, '');
    if (!tabs.some(function (tab) { return tab.getAttribute('data-edition-tab') === initial; })) {
      initial = tabs[0].getAttribute('data-edition-tab');
    }
    show(initial, false);

    window.addEventListener('hashchange', function () {
      var key = (location.hash || '').replace(/^#/, '');
      if (tabs.some(function (tab) { return tab.getAttribute('data-edition-tab') === key; })) {
        show(key, false);
      }
    });
  })();
  </script>`;

  return pageShell({
    title: '设计 Skill 横评 · V2 / V3 并列',
    description:
      '10 个设计 skill 在同一提示词族、同一模型下的 A1 个人介绍落地页实测：V2 未约束版与 V3 一次成版 + thinking high 并列对照。',
    body,
    depth: 0,
  });
}

// --------------------------------------------------------------------- detail

function compactStats(run) {
  return [
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
        `          <div class="stat"><span class="label">${esc(label)}</span><span class="value">${esc(value)}</span></div>`,
    )
    .join('\n');
}

function factRowsFor(edition, run) {
  const facts = [
    ['数据目录', edition.runDate],
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
  return facts
    .map(([label, value]) => {
      const mono = /[\d]/.test(String(value)) && String(value).length < 24 ? ' class="mono"' : '';
      return `              <tr><th scope="row">${esc(label)}</th><td${mono}>${esc(value)}</td></tr>`;
    })
    .join('\n');
}

/** One side of the V2|V3 split detail column. assetBase is relative to runs/<id>/detail.html */
function buildCompareColumn(edition, run, assetBase, thumbRel) {
  const notice = run.interrupted
    ? `        <aside class="notice">
          ${flag('warn', '中途断过但有页面')}
          <span>本轮会话在检查循环里中断，没有正常收尾；index.html 已在磁盘并完成截图。</span>
        </aside>`
    : '';

  const thumb = thumbRel
    ? `        <div class="compare-thumb">
          <img src="${esc(thumbRel)}" alt="${esc(edition.versionShort)} ${esc(run.id)} 缩略图" loading="lazy" width="720" height="450">
        </div>`
    : `        <div class="compare-thumb thumb-missing">缩略图缺失</div>`;

  const reviewEmpty = run.review ? '' : ' is-empty';

  return `      <article class="compare-col" data-edition="${esc(edition.key)}" aria-labelledby="${esc(edition.key)}-col-title">
        <header class="compare-col-head">
          <p class="eyebrow">${esc(edition.roundLabel)}</p>
          <h2 id="${esc(edition.key)}-col-title">
            <span class="badge ${esc(edition.badgeClass)}">${esc(edition.versionShort)}</span>
            ${esc(edition.versionLabel)}
          </h2>
          <p class="compare-blurb">${esc(edition.constraintBlurb)}</p>
          <ul class="chip-row">
            <li>${esc(run.id)}</li>
            <li>${esc(edition.runDate)}</li>
            <li>读了 skill：${run.readSkill ? '是' : '否'}</li>
            <li>退出码：${hasNumber(run.exit) ? esc(run.exit) : '无记录'}</li>
          </ul>
        </header>
${notice}

        <section class="compare-block" aria-labelledby="${esc(edition.key)}-stats">
          <h3 id="${esc(edition.key)}-stats">关键数字</h3>
          <dl class="stats stats-compact">
${compactStats(run)}
          </dl>
        </section>

        <section class="compare-block" aria-labelledby="${esc(edition.key)}-thumb">
          <h3 id="${esc(edition.key)}-thumb">页面缩略</h3>
${thumb}
        </section>

        <section class="compare-block" aria-labelledby="${esc(edition.key)}-live">
          <h3 id="${esc(edition.key)}-live">真实页面</h3>
          <p class="section-note">直接渲染本轮产出的 index.html，未做任何修改。</p>
          <div class="browser">
            <div class="browser-bar">
              <span class="browser-path">runs/${esc(edition.runDate)}/${esc(run.id)}/index.html</span>
              <span class="spacer"></span>
              <a class="button" href="${esc(assetBase)}/index.html" target="_blank" rel="noopener">新窗口</a>
            </div>
            <iframe class="live-frame live-frame-compare" src="${esc(assetBase)}/index.html" loading="lazy" title="${esc(edition.versionShort)} ${esc(run.id)} 生成的页面"></iframe>
          </div>
        </section>

        <section class="compare-block" aria-labelledby="${esc(edition.key)}-shot">
          <h3 id="${esc(edition.key)}-shot">全页截图</h3>
          <div class="shot-frame shot-frame-compare">
            <a href="${esc(assetBase)}/shot-desktop.png" target="_blank" rel="noopener"><img src="${esc(assetBase)}/shot-desktop.png" loading="lazy" alt="${esc(edition.versionShort)} ${esc(run.id)} 全页截图"></a>
          </div>
        </section>

        <section class="compare-block" aria-labelledby="${esc(edition.key)}-facts">
          <h3 id="${esc(edition.key)}-facts">实测数据</h3>
          <div class="table-wrap">
            <table class="kv">
              <tbody>
${factRowsFor(edition, run)}
              </tbody>
            </table>
          </div>
          <p class="fine">数字取自 <code>runs/${esc(edition.runDate)}/_metrics.json</code>；费用记为「暂无」。不排名、不打分。</p>
        </section>

        <section class="compare-block" aria-labelledby="${esc(edition.key)}-review">
          <h3 id="${esc(edition.key)}-review">Chasen 的评价</h3>
          <div class="review${reviewEmpty}">
${reviewBlock(run.review)}
          </div>
          <p class="fine">编辑 runs/${esc(edition.runDate)}/${esc(run.id)}/review.md 后重新构建即可更新。</p>
        </section>
      </article>`;
}

function buildRedirect(targetRel, label) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url=${esc(targetRel)}">
<link rel="canonical" href="${esc(targetRel)}">
<title>跳转到并列对比</title>
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#F4EFE6">
<link rel="stylesheet" href="../../../style.css">
</head>
<body>
<main class="wrap" style="padding-top:48px">
  <p class="lede"><a href="${esc(targetRel)}">${esc(label)}</a></p>
</main>
</body>
</html>
`;
}

function buildCompareDetail({ id, skill, columns, prevId, nextId }) {
  const root = '../../';
  const nav = [
    `<a class="back" href="${root}index.html">← 返回总览</a>`,
    '<span class="pager">',
    prevId
      ? `<a href="../${esc(prevId)}/detail.html">← ${esc(prevId)}</a>`
      : '<span class="disabled">← 上一个</span>',
    nextId
      ? `<a href="../${esc(nextId)}/detail.html">${esc(nextId)} →</a>`
      : '<span class="disabled">下一个 →</span>',
    '</span>',
  ].join('\n      ');

  const colHtml = columns
    .map(({ edition, run }) => {
      const assetBase = `${root}${edition.key}/runs/${run.id}`;
      const thumbPath = join(DIST, 'thumbs', edition.key, `${run.id}.webp`);
      const thumbRel = existsSync(thumbPath) ? `${root}thumbs/${edition.key}/${run.id}.webp` : null;
      return buildCompareColumn(edition, run, assetBase, thumbRel);
    })
    .join('\n\n');

  const body = `${topbar({
    depth: 2,
    right: '',
  })}
  <main class="wrap wrap-compare" id="main">
    <nav class="topnav" aria-label="页面导航">
      ${nav}
    </nav>

    <header class="hero detail-head">
      <p class="eyebrow">V2 / V3 左右并列 · 第 ${esc(id.slice(0, 2))} 组</p>
      <h1><span class="idx">${esc(id.slice(0, 2))}</span>${esc(skill)}</h1>
      <p class="lede">同一 skill、同一提示词族、同一模型 ${esc(MODEL_LABEL)}。左栏 V2＝未约束版（会过度自检）；右栏 V3＝一次成版 + thinking high。本页直接对照，无需再跳转另一版。</p>
      <ul class="chip-row">
        <li>${esc(id)}</li>
        <li>不排名 · 不打分</li>
        <li>评价待 Chasen 填写</li>
      </ul>
    </header>

    <div class="compare-split" role="group" aria-label="V2 与 V3 左右对比">
${colHtml}
    </div>

    <footer class="footer">
      <p class="repo"><a href="${esc(REPO_URL)}">${esc(REPO_URL)}</a></p>
      <p>数据：runs/2026-10-29-r2、runs/2026-10-29-r3 的 _metrics.json 与各轮 meta.json。原始产出未改写。</p>
    </footer>
  </main>`;

  return pageShell({
    title: `${id} · ${skill} · V2 / V3 对比 · 设计 Skill 横评`,
    description: `${id}（${skill}）在 V2（未约束版）与 V3（一次成版 + thinking high）中的左右栏对照。`,
    body,
    depth: 2,
  });
}

// ----------------------------------------------------------------------- main

function main() {
  const editionsData = EDITIONS.map((edition) => ({
    edition,
    runs: loadRuns(edition),
    prompt: loadPrompt(edition),
  }));

  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  copyFileSync(join(HERE, 'style.css'), join(DIST, 'style.css'));

  for (const { edition, runs } of editionsData) {
    const thumbOutDir = join(DIST, 'thumbs', edition.key);
    mkdirSync(thumbOutDir, { recursive: true });

    for (const run of runs) {
      const src = findThumb(edition.key, run.id);
      if (src) {
        copyFileSync(src, join(thumbOutDir, `${run.id}.webp`));
      } else {
        console.warn(`warning: missing thumbnail for ${edition.key}/${run.id}`);
      }
    }

    for (const run of runs) {
      const outDir = join(DIST, edition.key, 'runs', run.id);
      mkdirSync(outDir, { recursive: true });

      for (const name of readdirSync(run.dir)) {
        if (!isPlainFile(run.dir, name)) continue;
        // Never overwrite generated detail.html with a source file of the same name.
        if (name === 'detail.html') continue;
        copyFileSync(join(run.dir, name), join(outDir, name));
      }
    }
  }

  // Pair runs by id across editions for side-by-side detail pages.
  const byId = new Map();
  for (const { edition, runs } of editionsData) {
    for (const run of runs) {
      if (!byId.has(run.id)) byId.set(run.id, []);
      byId.get(run.id).push({ edition, run });
    }
  }

  const ids = [...byId.keys()].sort();
  ids.forEach((id, index) => {
    const columns = byId.get(id);
    const skill = columns[0].run.skill;
    const prevId = index > 0 ? ids[index - 1] : null;
    const nextId = index < ids.length - 1 ? ids[index + 1] : null;

    const compareDir = join(DIST, 'runs', id);
    mkdirSync(compareDir, { recursive: true });
    writeFileSync(
      join(compareDir, 'detail.html'),
      buildCompareDetail({ id, skill, columns, prevId, nextId }),
      'utf8',
    );

    // Old per-edition detail URLs redirect to the shared compare page.
    for (const { edition } of columns) {
      const legacy = join(DIST, edition.key, 'runs', id, 'detail.html');
      writeFileSync(
        legacy,
        buildRedirect(`../../runs/${id}/detail.html`, `前往 ${id} 的 V2 / V3 左右栏对比`),
        'utf8',
      );
    }
  });

  writeFileSync(join(DIST, 'index.html'), buildIndex(editionsData), 'utf8');

  for (const { edition, runs } of editionsData) {
    console.log(`built ${edition.key} (${edition.runDate}): ${runs.length} runs`);
    for (const run of runs) console.log(`  ${edition.key}/runs/${run.id}/ (assets)`);
  }
  console.log(`compare pages -> ${DIST}/runs/<id>/detail.html (${ids.length})`);
  console.log(`overview -> ${DIST}/index.html`);
}

main();
