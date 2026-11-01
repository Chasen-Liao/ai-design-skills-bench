#!/usr/bin/env node
// Zero-dependency static site builder for the A1 design-skills benchmark.
// Usage: node site/build.mjs   ->   site/dist/
//
// 支持多版并列（V2 / V3）：总览可切换；详情为 runs/<id>/detail.html 左右栏对比。
// 数据来源：runs/<RUN_DATE>/_metrics.json + 各轮 meta.json。原始产出仅复制，不改写。

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync, cpSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import {
  SKILL_LABEL,
  NOTE_ZH,
  TASK_LABELS,
  TASK_DESCRIPTIONS,
  PROVENANCE_TAGS,
  METRIC_LABELS,
  BENCHMARK_COPY,
} from './data/zh.mjs';
import { PROJECTS, PROJECT_BY_ID } from './data/projects.mjs';

const HERE = import.meta.dirname;
const REPO_ROOT = resolve(HERE, '..');
const THUMBS_SRC = join(HERE, 'thumbs');
const DIST = join(HERE, 'dist');
const REPO_URL = 'https://github.com/Chasen-Liao/ai-design-skills-bench';

const MODEL_NAME = 'DeepSeek V4.1 Flash 1017';
const MODEL_LABEL = `${MODEL_NAME}（ZenMux / deepseek/deepseek-v4.1-flash）`;
const MODEL_ID = 'deepseek/deepseek-v4.1-flash';

const TASK_KEYS = ['all', 'portfolio', 'landing', 'admin', 'prototype', 'style-ref'];
const TASK_DISPLAY_NAMES = {
  all: '全部任务',
  portfolio: '个人站/作品集',
  landing: '营销落地页',
  admin: '后台与产品界面',
  prototype: '原型与演示',
  'style-ref': '已有风格参考',
};
const TASK_TIPS = {
  all: '查看全部 9 个设计项目与 1 个裸对照基准',
  portfolio: '适合个人主页、作品集陈列、求职简历与个人品牌展示',
  landing: '适合 SaaS 官网、商业产品发布页、线索收集与活动宣传',
  admin: '适合企业后台、控制台、数据看板、工作台与高密度工具界面',
  prototype: '适合交互验证、高保真功能演示、UI 组件 Demo 与幻灯片',
  'style-ref': '适合注入既有设计系统（Design Tokens）与多风格探索比选',
};

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
    wallClockDuration: 4270,
    concurrencyFactor: '约 2.38x 并发',
    constraintTitle: '未约束：会过度自检',
    constraintBlurb:
      '提示词只要求用上 skill，没有禁止自检，也没有要求一次成版。实测：多数跑次写完后反复截图、lint、DOM 探测、CSS 微调。',
    constraintPoints: [
      '每个目录只装一个被测 skill，00-bare 为不装 skill 的对照。',
      '提示词只要求「用上这个 skill」，没有禁止自检，也没有要求一次成版。',
      '多数跑次写完后反复自检——多轮截图、lint、DOM 探测、CSS 微调。',
    ],
    eyebrow: 'A1 个人介绍落地页 · 第二轮实测 · 9 个设计项目 + 1 个裸对照',
    heroLede:
      '只差「给不给 skill」和「给哪一个」。这一版是未约束版：提示词只要求用 skill，没有限制模型自检多少轮，于是它写了又测、测了又改。',
  },
  {
    key: 'v3',
    runDate: '2026-10-29-r3',
    versionShort: 'V3',
    versionLabel: '一次成版约束 + thinking high',
    badgeClass: 'badge-v3',
    roundLabel: '2026-10-29 · r3',
    wallClockDuration: 1411,
    concurrencyFactor: '约 1.87x 并发 (Max 2)',
    constraintTitle: '一次成版硬约束 + thinking high',
    constraintBlurb:
      '同一提示词族追加硬约束：要求一次成版交付，禁止反复自检与无头浏览器验证，最多一次小幅修正；模型开启 thinking high。实测大多数组自检归零，但个别项目仍出现多次编辑或浏览器探测。',
    constraintPoints: [
      '提示词追加「一次性成版交付」硬约束：禁止反复自检、截图循环与多轮大改，最多一次小幅修正。',
      '模型参数：开启 `--thinking high`（ZenMux / deepseek/deepseek-v4.1-flash），用深度思考替代试错自检。',
      '实际执行遵从度：相比 V2 的 8~30 次自检循环，V3 绝大多数组自检归零；但 06-huashu-design 仍执行了 4 次 Playwright 浏览器检查，04、06、08 组出现 5~8 次代码微调。',
    ],
    eyebrow: 'A1 个人介绍落地页 · 第三轮实测 · 9 个设计项目 + 1 个裸对照',
    heroLede:
      '与 V2 同一提示词族、同一模型。差别只在约束：要求一次成版，并打开 thinking high，用来对照「限制自检」本身对质量与消耗的影响。',
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
  if (value === null || value === undefined) return '暂无';
  const n = Number(value);
  if (!Number.isFinite(n)) return '暂无';
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const hasNumber = (value) => Number.isFinite(Number(value)) && value !== null;

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '暂无';
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

const flag = (kind, text, title = '') =>
  `<span class="flag flag-${kind}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;
const interruptedFlag = (run) =>
  (run.interrupted ? flag('warn', '中途断过但有页面', '会话中途超时中断，未正常退出；HTML 已生成') : '');
const readSkillFlag = (run) => {
  if (run.id === '00-bare') {
    return flag('mute', '未安装 / 不适用', '对照组未安装任何 Skill；V3 原始日志中因 bash 探测被分析脚本误标，已在此纠正');
  }
  return run.readSkill ? flag('ok', '是') : flag('mute', '否');
};
const exitCell = (run) => (hasNumber(run.exit) ? esc(run.exit) : flag('warn', '中断'));
const readSkillText = (run) => (run.id === '00-bare' ? '未安装 / 不适用' : (run.readSkill ? '是' : '否'));

function provenanceReviewBlock(project, run) {
  const p = project ?? {
    docPositioning: '未找到作者文档定位信息。',
    observedNote: '未找到本轮实测观察信息。',
    bestFor: '暂无推荐',
    tradeoff: '暂无取舍说明',
    editorialStatus: 'pending_review',
  };

  const pendingBadge =
    p.editorialStatus === 'pending_review'
      ? `<span class="badge badge-pending">待确认</span>`
      : '';

  const customReviewHtml = run.review
    ? `        <div class="provenance-item provenance-custom">
          <div class="provenance-header">
            <span class="badge badge-custom">实测手记</span>
          </div>
          <div class="provenance-body">
            ${run.review
              .split(/\n\s*\n/)
              .map((para) => `<p>${esc(para.trim()).replace(/\n/g, '<br>')}</p>`)
              .join('\n')}
          </div>
        </div>`
    : '';

  return `        <div class="provenance-card">
          <div class="provenance-item">
            <div class="provenance-header">
              <span class="badge badge-doc">作者文档描述</span>
            </div>
            <div class="provenance-body">
              <p>${esc(p.docPositioning)}</p>
            </div>
          </div>

          <div class="provenance-item">
            <div class="provenance-header">
              <span class="badge badge-observed">本次实测观察</span>
            </div>
            <div class="provenance-body">
              <p>${esc(p.observedNote)}</p>
            </div>
          </div>

          <div class="provenance-item">
            <div class="provenance-header">
              <span class="badge badge-editorial">编辑建议</span>
              ${pendingBadge}
            </div>
            <div class="provenance-body">
              <p><strong>优先推荐：</strong>${esc(p.bestFor)}</p>
              <p><strong>主要取舍：</strong>${esc(p.tradeoff)}</p>
            </div>
          </div>
${customReviewHtml}
        </div>`;
}

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
    const promptPath = join(dir, 'prompt.txt');
    const prompt = existsSync(promptPath) ? readText(promptPath).trim() : '';
    const logPath = join(dir, 'run.log');
    const log = existsSync(logPath) ? readText(logPath).trim() : '';
    const rawNote = mm.note ?? meta.note ?? '';
    const tokens = m?.tokens ?? null;

    // Import & merge rich project metadata from site/data/projects.mjs
    const project = (PROJECT_BY_ID && PROJECT_BY_ID[name])
      ?? PROJECTS.find((p) => p.id === name)
      ?? null;

    // F08: Rectification for 00-bare read_skill false positive in V3
    const isBare = name === '00-bare';
    const readSkill = isBare ? false : m?.read_skill === true;
    const isSkill = project ? project.isSkill : (!isBare && name !== '09-awesome-design-md');

    const skillTitle = project?.name
      ?? SKILL_LABEL[name]
      ?? (meta.skill && meta.skill !== 'none' ? meta.skill : '无（裸 Pi 对照）');

    return {
      id: name,
      dir,
      meta,
      project,
      skill: skillTitle,
      isSkill,
      tagline: project?.tagline ?? '',
      tasks: project?.tasks ?? [],
      bestFor: project?.bestFor ?? '',
      tradeoff: project?.tradeoff ?? '',
      docPositioning: project?.docPositioning ?? '',
      observedNote: project?.observedNote ?? '',
      editorialStatus: project?.editorialStatus ?? 'pending_review',
      start: mm.start ?? meta.start,
      end: mm.end ?? meta.end,
      duration: mm.duration_s ?? meta.duration_s,
      exit: mm.exit ?? null,
      bytes: mm.bytes ?? meta.bytes,
      llmCalls: m?.llm_calls ?? null,
      tokens,
      toolCalls: m?.tool_calls_total ?? null,
      browserChecks: m?.browser_checks ?? 0,
      htmlEdits: m?.index_html_edits ?? 0,
      readSkill,
      rawReadSkill: m?.read_skill === true,
      interrupted: /interrupted-but-html-ok/.test(rawNote) || mm.exit === null,
      note: zhNote(rawNote),
      review,
      prompt,
      log,
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
<style>
.badge-doc { color: #1d4e68; background: rgba(41, 107, 144, 0.12); border-color: rgba(41, 107, 144, 0.28); }
.badge-observed { color: var(--accent-ink); background: var(--accent-soft); border-color: rgba(240, 101, 46, 0.32); }
.badge-editorial { color: #7a461b; background: rgba(184, 98, 27, 0.12); border-color: rgba(184, 98, 27, 0.3); }
.badge-pending { color: var(--muted); background: transparent; border: 1px dashed var(--line-strong); font-size: 11px; padding: 1px 7px; }
.badge-custom { color: #2b542c; background: rgba(46, 125, 50, 0.12); border-color: rgba(46, 125, 50, 0.28); }
.provenance-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
.provenance-item { display: flex; flex-direction: column; gap: 6px; padding-bottom: 12px; border-bottom: 1px solid var(--zebra); }
.provenance-item:last-child { padding-bottom: 0; border-bottom: 0; }
.provenance-header { display: flex; align-items: center; gap: 8px; }
.provenance-body { margin: 0; color: var(--fg-2); font-size: 13.5px; line-height: 1.65; }
.provenance-body p { margin: 4px 0; }
.provenance-body strong { color: var(--fg); font-weight: 600; }
</style>
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
  const installedSkillRuns = runs.filter((run) => run.id !== '00-bare');
  return {
    llmCalls: sum(runs, (run) => run.llmCalls),
    toolCalls: sum(runs, (run) => run.toolCalls),
    input: sum(runs, (run) => run.tokens?.input),
    output: sum(runs, (run) => run.tokens?.output),
    cacheRead: sum(runs, (run) => run.tokens?.cacheRead),
    reasoning: sum(runs, (run) => run.tokens?.reasoning),
    totalTokens: sum(runs, (run) => run.tokens?.totalTokens),
    // 00-bare has no skill installed, excluded from readSkill denominator
    readSkill: installedSkillRuns.filter((run) => run.readSkill).length,
    readSkillInstalled: installedSkillRuns.length,
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

      const taskChips = (run.tasks || [])
        .map(
          (t) =>
            `<span class="card-task-chip task-pill" data-task-chip="${esc(t)}">${esc(TASK_DISPLAY_NAMES[t] || t)}</span>`,
        )
        .join('');

      const statusBadge =
        run.isSkill === false
          ? `<span class="flag flag-mute">${run.id === '00-bare' ? '裸对照' : '规范文档'}</span>`
          : '';

      const interruptedBadge = interruptedFlag(run);

      return `      <article class="card" data-project-id="${esc(run.id)}" data-tasks="${esc((run.tasks || []).join(','))}">
        <div class="card-thumb">
          <a href="runs/${esc(run.id)}/detail.html" tabindex="-1" aria-hidden="true">
            ${thumb}
          </a>
          <span class="card-idx">${String(index).padStart(2, '0')}</span>
          <div class="card-flags">
            ${statusBadge}
            ${interruptedBadge}
          </div>
        </div>
        <div class="card-body">
          <div class="card-header-row">
            <h3 class="card-title">
              <a href="runs/${esc(run.id)}/detail.html">${esc(run.skill)}</a>
            </h3>
            ${run.isSkill === false ? `<span class="badge badge-outline">${run.id === '00-bare' ? '未安装 / 不适用' : '规范注入'}</span>` : ''}
          </div>
          <p class="card-tagline">${esc(run.tagline)}</p>

          <div class="card-task-row" aria-label="适用任务分类">
            ${taskChips}
          </div>

          <div class="card-decision-block">
            <div class="card-decision-item card-best-for">
              <span class="card-decision-label"><span class="badge badge-editorial">优先推荐</span></span>
              <span class="card-decision-text">${esc(run.bestFor)}</span>
            </div>
            <div class="card-decision-item card-tradeoff">
              <span class="card-decision-label"><span class="badge badge-observed">主要取舍</span></span>
              <span class="card-decision-text">${esc(run.tradeoff)}</span>
            </div>
          </div>

          <div class="card-compare-action">
            <label class="compare-select-label" title="选择 2-3 个候选 Skill 在同版本下横向并排比对">
              <input type="checkbox" class="compare-select" data-compare-id="${esc(run.id)}">
              <span class="compare-select-text">同版本横向比对</span>
            </label>
          </div>

          <div class="card-foot">
            <div class="card-metrics-secondary" title="单轮实测耗时与调用开销（次要参考指标）">
              <span class="metric-item">耗时 <strong>${esc(formatDuration(run.duration))}</strong></span>
              <span class="metric-sep">·</span>
              <span class="metric-item">LLM <strong>${esc(fmtInt(run.llmCalls))}</strong></span>
              <span class="metric-sep">·</span>
              <span class="metric-item">工具 <strong>${esc(fmtInt(run.toolCalls))}</strong></span>
            </div>
            <a class="card-link" href="runs/${esc(run.id)}/detail.html">查看详情评测 →</a>
          </div>
        </div>
      </article>`;
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
          <div class="stat"><span class="label">评测样本</span><span class="value">${runs.length}<small>组（9+1）</small></span></div>
          <div class="stat"><span class="label">产出页面</span><span class="value">${totals.withPage}<small>/ ${runs.length}</small></span></div>
          <div class="stat" title="各跑次 duration 累加和，非并发整批耗时"><span class="label">各组耗时累计*</span><span class="value">${esc(formatDuration(totals.duration))}</span></div>
          <div class="stat"><span class="label">整批实际经过时间</span><span class="value">${esc(formatDuration(edition.wallClockDuration))}<small>（${esc(edition.concurrencyFactor)}）</small></span></div>
          <div class="stat"><span class="label">未缓存输入 (input)</span><span class="value">${esc(fmtInt(totals.input))}</span></div>
          <div class="stat"><span class="label">缓存读取 (cacheRead)</span><span class="value">${esc(fmtInt(totals.cacheRead))}</span></div>
          <div class="stat"><span class="label">输出 token</span><span class="value">${esc(fmtInt(totals.output))}</span></div>
          <div class="stat" title="00-bare 裸对照未装 Skill，不计入分母"><span class="label">读取了 Skill</span><span class="value">${totals.readSkill}<small>/ ${totals.readSkillInstalled}</small></span></div>
        </dl>
      </div>

      <div class="edition-block" aria-labelledby="${esc(edition.key)}-grid">
        <h3 id="${esc(edition.key)}-grid">实测成果（9 个设计项目 + 1 个裸对照）</h3>
        <p class="section-note">缩略图取自各轮的 shot-hero.png；点开进入同一 skill 的 V2 / V3 左右栏对比（原页面、截图、指标与评价位分列）。</p>
        <div class="grid">
${cards}
        </div>
        <div class="task-empty-state task-filter-empty" hidden>
          <p class="task-empty-state-text task-filter-empty-text">该分类下暂无匹配项目</p>
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
                <th scope="col">单轮耗时</th>
                <th scope="col">退出状态</th>
                <th scope="col">页面字节</th>
                <th scope="col">LLM 调用</th>
                <th scope="col" title="未命中缓存的 prompt 输入 token">输入 token (input)</th>
                <th scope="col" title="模型生成 token">输出 token (output)</th>
                <th scope="col" title="命中的 Prompt Cache token">缓存读取 (cacheRead)</th>
                <th scope="col">工具调用</th>
                <th scope="col">读了 Skill</th>
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
            <li><strong>样本与命名说明</strong>：本批次包含 9 个设计项目（8 个 Agent Skill + 1 个 DESIGN.md 规范）与 1 个裸对照基准。</li>
            <li><strong>耗时统计口径</strong>：上方指标中的「各组耗时累计」为 10 个跑次单项时长的算术求和（${edition.key === 'v2' ? 'V2 累计 169.5 分钟，实际并发执行跨度约 71 分钟' : 'V3 累计 44.0 分钟，实际双并发执行跨度约 23.5 分钟'}），不是整批实际经过时间。</li>
            <li><strong>Token 统计口径</strong>：严格区分 Provider 接口返回的 <code>未缓存输入 (input)</code> 与 <code>缓存读取 (cacheRead)</code>。在多轮自检与长提示词场景下，提示词缓存命中率超过 90%，两者计费单价不同，请勿直接相加作为输入成本。</li>
            <li><strong>00-bare 对照说明</strong>：00-bare 属于未安装任何设计规范的纯基线对照。V3 原始分析日志因 bash 执行了 <code>find . -iname DESIGN.md</code> 文件名探测被误标为 <code>read_skill=true</code>，本站已客观纠正为「未安装 / 不适用」。</li>
            <li><strong>${esc(edition.versionShort)} 执行遵从度说明</strong>：${edition.key === 'v3' ? 'V3 提示词要求「一次成版交付，最多一次小幅修正」，实测中多数组严格遵守且无浏览器检查；但 04-oil-ui、06-huashu-design、08-taste-skill 仍进行了 5~8 次代码编辑，06 组仍执行了 4 次 Playwright 浏览器检查。' : 'V2 未约束自检轮次，多数跑次进行了 10~30 次无头浏览器截图与 DOM 检查循环；其中 08-taste-skill 在第 56 次调用由于 30 分钟超时中断，但已成功落盘 HTML 并完成截图。'}</li>
            <li><strong>费用与评价</strong>：未接入实时计费账单统一记为「暂无」；不排名、不打分。页面呈现严格区分作者文档描述、实测观察与待确认编辑建议。本横评仅个人页实测，其他任务建议来自作者文档。</li>
          </ul>
        </div>
      </div>
    </section>`;
}

function buildIndex(editionsData) {
  // Aggregate task counts
  const taskCounts = { all: PROJECTS.length };
  for (const p of PROJECTS) {
    for (const t of p.tasks || []) {
      taskCounts[t] = (taskCounts[t] || 0) + 1;
    }
  }

  // Task filter chips (F02)
  const taskFilterButtons = TASK_KEYS.map((key, index) => {
    const isAll = key === 'all';
    const label = TASK_DISPLAY_NAMES[key] || key;
    const count = taskCounts[key] || 0;
    const tip = TASK_TIPS[key] || '';
    return `        <button type="button" role="tab" class="task-tab task-filter-chip${isAll ? ' is-active' : ''}" data-task-filter="${esc(key)}" aria-selected="${isAll ? 'true' : 'false'}" aria-pressed="${isAll ? 'true' : 'false'}" title="${esc(tip)}">
          <span class="task-tab-name">${esc(label)}</span>
          <span class="task-count task-filter-count" aria-label="共 ${count} 个项目">${count}</span>
        </button>`;
  }).join('\n');

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
      <p class="eyebrow">A1 个人介绍落地页 · 9 个设计项目 + 1 个裸对照</p>
      <h1>设计 Skill 怎么选？先看同题做出的页面</h1>
      <p class="lede">9 个设计项目 + 1 个裸 Pi 对照，使用同一份个人页资料，在同一提示词族与同一模型（${esc(MODEL_NAME)}）下的同题页面实测。不打分、不排名，只看做出的真实版面、执行开销与任务取舍。本横评仅个人页实测，其他任务建议来自作者文档。</p>
      <ul class="hero-tags">
        <li>同一提示词族</li>
        <li>${esc(MODEL_NAME)}</li>
        <li>2026-10-29 实测</li>
        <li>极简 Pi 四工具</li>
        <li>不排名 · 不打分</li>
        <li>仅个人页实测</li>
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
            <li><strong>多维证据呈现</strong>：严格区分作者文档描述、实测观察与待确认编辑建议。</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Task Filter Navigation (F02) -->
    <section class="task-filter-container task-filter-section" aria-labelledby="task-filter-heading">
      <div class="task-filter-header">
        <div class="task-filter-intro">
          <h2 id="task-filter-heading" class="task-filter-title">按使用任务选型筛选</h2>
          <p class="task-filter-desc">点击任务标签即时筛选适配该场景的 Skill 候选；卡片主要突出定位、推荐任务与取舍</p>
        </div>
        <span class="task-filter-hint" id="task-filter-live" aria-live="polite">已展示全部 10 个项目</span>
      </div>
      <div class="task-filter-bar" role="tablist" aria-label="使用任务分类筛选">
${taskFilterButtons}
      </div>
    </section>

    <div class="edition-switch-container">
      <div class="edition-switch-header">
        <span class="badge badge-outline">跨实验纵向对比</span>
        <span class="edition-switch-title">查看两次实验演进（同一 Skill 在 V2 未约束 vs V3 一次成版中的变化）</span>
      </div>
      <nav class="edition-switch" aria-label="查看两次实验（纵向对比）">
${switchButtons}
      </nav>
    </div>

${panels}

    <section aria-labelledby="prompt-title">
      <h2 id="prompt-title">统一提示词原文</h2>
      <p class="section-note">两版同属 A1 提示词族；V3 在文末多了一次成版约束段。点开可看全文。</p>
${promptBlocks}
    </section>

    <!-- Floating Compare Tray (F11, F12) -->
    <aside class="compare-tray" id="compare-tray" aria-label="同版本候选横向比对栏" hidden>
      <div class="compare-tray-inner">
        <div class="compare-tray-info">
          <span class="badge badge-observed">同版本横向比对</span>
          <span class="compare-tray-title">比较不同 Skill</span>
          <span class="compare-tray-count" id="compare-tray-count">已选 0 / 3 项</span>
          <div class="compare-tray-chips" id="compare-tray-chips"></div>
        </div>
        <div class="compare-tray-actions">
          <button type="button" class="button button-ghost button-sm" id="compare-clear-btn">清空</button>
          <button type="button" class="button button-primary button-sm" id="compare-launch-btn" disabled>查看横向比对</button>
        </div>
      </div>
    </aside>

    <!-- Horizontal Comparison Matrix Modal (F11, F12) -->
    <div class="compare-modal-backdrop" id="compare-modal-backdrop" hidden role="dialog" aria-modal="true" aria-labelledby="compare-modal-title">
      <div class="compare-modal">
        <header class="compare-modal-header">
          <div>
            <span class="badge badge-observed">同版本多候选横向比对</span>
            <h2 id="compare-modal-title">多候选横向比对（同一批次同题并排）</h2>
            <p class="section-note">同在 <strong id="compare-modal-edition-label">V3 一次成版</strong> 批次下对比选中的候选 Skill；如需查看单 Skill 跨实验差异，请进入单组详情。</p>
          </div>
          <button type="button" class="button button-ghost compare-modal-close" id="compare-modal-close" aria-label="关闭横向比对">✕ 关闭</button>
        </header>
        <div class="compare-modal-body">
          <div class="compare-matrix-grid" id="compare-matrix-grid"></div>
        </div>
      </div>
    </div>

    <footer class="footer">
      <p class="repo"><a href="${esc(REPO_URL)}">${esc(REPO_URL)}</a></p>
      <p>数据：runs/2026-10-29-r2、runs/2026-10-29-r3 的 _metrics.json、各轮 meta.json 与会话日志。站点构建：node site/build.mjs。</p>
    </footer>
  </main>
  <script>
  (function () {
    'use strict';

    var VALID_TASKS = ['all', 'portfolio', 'landing', 'admin', 'prototype', 'style-ref'];
    var VALID_EDITIONS = ['v3', 'v2'];
    var MAX_COMPARE_CANDIDATES = 3;

    var TASK_NAMES = {
      all: '全部任务',
      portfolio: '个人站/作品集',
      landing: '营销落地页',
      admin: '后台与产品界面',
      prototype: '原型与演示',
      'style-ref': '已有风格参考'
    };

    function parseUrlState() {
      var search = window.location.search || '';
      var hash = (window.location.hash || '').replace(/^#/, '');
      var queryParams = new URLSearchParams(search);

      var edition = 'v3';
      var task = 'all';
      var compare = [];

      // Parse edition from query, then fallback to hash
      if (queryParams.has('edition')) {
        var ed = (queryParams.get('edition') || '').toLowerCase();
        if (VALID_EDITIONS.indexOf(ed) !== -1) {
          edition = ed;
        }
      } else if (VALID_EDITIONS.indexOf(hash.toLowerCase()) !== -1) {
        edition = hash.toLowerCase();
      }

      // Parse task from query, then fallback to hash (#task=... or #<task>)
      if (queryParams.has('task')) {
        var t = (queryParams.get('task') || '').toLowerCase();
        if (VALID_TASKS.indexOf(t) !== -1) {
          task = t;
        } else {
          task = 'all';
        }
      } else if (hash) {
        var hashParams = new URLSearchParams(hash);
        if (hashParams.has('task')) {
          var ht = (hashParams.get('task') || '').toLowerCase();
          if (VALID_TASKS.indexOf(ht) !== -1) task = ht;
        } else if (VALID_TASKS.indexOf(hash.toLowerCase()) !== -1) {
          task = hash.toLowerCase();
        }
      }

      // Parse compare candidates
      if (queryParams.has('compare')) {
        var raw = queryParams.get('compare') || '';
        compare = raw
          .split(',')
          .map(function (s) { return s.trim(); })
          .filter(Boolean)
          .slice(0, MAX_COMPARE_CANDIDATES);
      }

      return { edition: edition, task: task, compare: compare };
    }

    var ALL_PROJECTS_DATA = ${JSON.stringify(PROJECTS.map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      tasks: p.tasks,
      bestFor: p.bestFor,
      tradeoff: p.tradeoff,
      docPositioning: p.docPositioning,
      observedNote: p.observedNote,
      isSkill: p.isSkill,
    })))};
    var PROJECT_MAP = {};
    ALL_PROJECTS_DATA.forEach(function (p) {
      PROJECT_MAP[p.id] = p;
    });

    function syncUrl(state, isPush) {
      if (!window.history) return;

      var params = new URLSearchParams();

      // Default edition is v3; only serialize if v2
      if (state.edition && state.edition !== 'v3') {
        params.set('edition', state.edition);
      }

      // Default task is all; only serialize if not all
      if (state.task && state.task !== 'all') {
        params.set('task', state.task);
      }

      // Serialize compare candidates if present
      if (state.compare && state.compare.length > 0) {
        params.set('compare', state.compare.slice(0, MAX_COMPARE_CANDIDATES).join(','));
      }

      var qs = params.toString();
      var newUrl = window.location.pathname + (qs ? '?' + qs : '');

      var historyFn = (isPush && typeof window.history.pushState === 'function')
        ? window.history.pushState.bind(window.history)
        : (typeof window.history.replaceState === 'function' ? window.history.replaceState.bind(window.history) : null);

      if (historyFn) {
        try {
          historyFn(null, '', newUrl);
        } catch (e) {
          // Gracefully ignore SecurityError in restricted sandboxed iframes
        }
      }
    }

    // DOM Elements
    var editionTabs = Array.prototype.slice.call(document.querySelectorAll('[data-edition-tab]'));
    var editionPanels = Array.prototype.slice.call(document.querySelectorAll('[data-edition]'));
    var filterChips = Array.prototype.slice.call(document.querySelectorAll('[data-task-filter]'));
    var filterBar = document.querySelector('.task-filter-bar') || document.querySelector('[data-task-filter-bar]');
    var liveRegion = document.getElementById('task-filter-live');
    var compareCheckboxes = Array.prototype.slice.call(document.querySelectorAll('.compare-select'));

    var currentState = parseUrlState();

    function applyEdition(editionKey) {
      currentState.edition = editionKey;
      editionTabs.forEach(function (tab) {
        var on = tab.getAttribute('data-edition-tab') === editionKey;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      editionPanels.forEach(function (panel) {
        var on = panel.getAttribute('data-edition') === editionKey;
        if (on) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      });
    }

    function applyTaskFilter(taskId) {
      currentState.task = taskId;
      filterChips.forEach(function (chip) {
        var isCurrent = chip.getAttribute('data-task-filter') === taskId;
        chip.classList.toggle('is-active', isCurrent);
        chip.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
        chip.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
      });

      var activeVisibleCount = 0;
      editionPanels.forEach(function (panel) {
        var isPanelActive = panel.getAttribute('data-edition') === currentState.edition;
        var cards = Array.prototype.slice.call(panel.querySelectorAll('.card'));
        var panelVisibleCount = 0;

        cards.forEach(function (card) {
          var rawTasks = card.getAttribute('data-tasks') || '';
          var cardTasks = rawTasks
            .split(',')
            .map(function (t) { return t.trim().toLowerCase(); });

          var isMatch = taskId === 'all' || cardTasks.indexOf(taskId) !== -1;

          if (isMatch) {
            card.removeAttribute('hidden');
            card.classList.remove('is-filtered-out');
            card.setAttribute('aria-hidden', 'false');
            panelVisibleCount++;
          } else {
            card.setAttribute('hidden', '');
            card.classList.add('is-filtered-out');
            card.setAttribute('aria-hidden', 'true');
          }
        });

        if (isPanelActive) {
          activeVisibleCount = panelVisibleCount;
        }

        var emptyState = panel.querySelector('.task-empty-state') || panel.querySelector('.task-filter-empty');
        if (emptyState) {
          if (panelVisibleCount === 0) {
            emptyState.removeAttribute('hidden');
            if (emptyState.style) emptyState.style.display = 'flex';
          } else {
            emptyState.setAttribute('hidden', '');
            if (emptyState.style) emptyState.style.display = 'none';
          }
        }
      });

      if (liveRegion) {
        var label = TASK_NAMES[taskId] || taskId;
        liveRegion.textContent = '已切换至“' + label + '”任务筛选，展示 ' + activeVisibleCount + ' 个项目。';
      }
    }

    function renderCompareTray() {
      var tray = document.getElementById('compare-tray');
      if (!tray) return;

      var countEl = document.getElementById('compare-tray-count');
      var chipsEl = document.getElementById('compare-tray-chips');
      var launchBtn = document.getElementById('compare-launch-btn');

      var list = currentState.compare || [];
      if (list.length === 0) {
        tray.setAttribute('hidden', '');
        if (launchBtn) launchBtn.disabled = true;
        return;
      }

      tray.removeAttribute('hidden');

      if (countEl) {
        countEl.textContent = '已选 ' + list.length + ' / ' + MAX_COMPARE_CANDIDATES + ' 项';
      }

      if (chipsEl) {
        var validList = list.filter(function (id) { return Boolean(PROJECT_MAP[id]); });
        var chipsHtml = validList.map(function (id) {
          var p = PROJECT_MAP[id];
          var name = p ? p.name : id;
          return '<span class="compare-chip" data-chip-id="' + p.id + '">' +
            '<span>' + name + '</span>' +
            '<button type="button" class="compare-chip-remove" data-remove-id="' + p.id + '" aria-label="移除 ' + name + '">✕</button>' +
            '</span>';
        }).join('');
        chipsEl.innerHTML = chipsHtml;
      }

      if (launchBtn) {
        launchBtn.disabled = list.length < 2;
        launchBtn.textContent = list.length < 2
          ? '查看横向比对 (需选2-3项)'
          : '查看横向比对 (' + list.length + '项并排)';
      }
    }

    function renderCompareMatrix() {
      var grid = document.getElementById('compare-matrix-grid');
      if (!grid) return;

      var edLabel = document.getElementById('compare-modal-edition-label');
      var ed = currentState.edition || 'v3';
      if (edLabel) {
        edLabel.textContent = ed === 'v2' ? 'V2 试错迭代版' : 'V3 一次成版';
      }

      var list = currentState.compare || [];
      if (list.length === 0) {
        grid.innerHTML = '<p class="section-note">当前未选择任何候选项目。请在卡片右下角勾选“同版本横向比对”。</p>';
        return;
      }

      var qs = [];
      if (ed !== 'v3') qs.push('edition=' + ed);
      if (currentState.task && currentState.task !== 'all') qs.push('task=' + currentState.task);
      if (list.length > 0) qs.push('compare=' + list.join(','));
      var queryStr = qs.length > 0 ? '?' + qs.join('&') : '';

      var colsHtml = list.map(function (id) {
        var p = PROJECT_MAP[id];
        if (!p) return '';
        var taskPills = (p.tasks || []).map(function (t) {
          var label = TASK_NAMES[t] || t;
          return '<span class="task-pill">' + label + '</span>';
        }).join('');

        var thumbSrc = 'thumbs/' + ed + '/' + p.id + '.webp';
        var detailHref = 'runs/' + p.id + '/detail.html' + queryStr;

        return '<article class="compare-matrix-col">' +
          '<div class="compare-matrix-thumb">' +
            '<a href="' + detailHref + '">' +
              '<img src="' + thumbSrc + '" alt="' + p.name + ' 预览截图" loading="lazy">' +
            '</a>' +
          '</div>' +
          '<header>' +
            '<h3 class="compare-matrix-title"><a href="' + detailHref + '">' + p.name + '</a></h3>' +
            '<p class="compare-matrix-tagline">' + (p.tagline || '') + '</p>' +
          '</header>' +
          '<div class="compare-matrix-tasks">' + taskPills + '</div>' +
          '<div class="compare-matrix-fields">' +
            '<div class="compare-matrix-field compare-matrix-best">' +
              '<span class="field-label">优先推荐场景</span>' +
              (p.bestFor || '暂无') +
            '</div>' +
            '<div class="compare-matrix-field compare-matrix-tradeoff">' +
              '<span class="field-label">主要取舍代价</span>' +
              (p.tradeoff || '暂无') +
            '</div>' +
            '<div class="compare-matrix-field">' +
              '<span class="field-label">实测观察要点</span>' +
              (p.observedNote || '暂无') +
            '</div>' +
          '</div>' +
          '<div class="compare-matrix-footer">' +
            '<span class="badge badge-outline">第 ' + p.id.slice(0, 2) + ' 组</span>' +
            '<a class="button button-sm button-ghost" href="' + detailHref + '">进入单组详情 →</a>' +
          '</div>' +
        '</article>';
      }).join('');

      grid.innerHTML = colsHtml;
    }

    function applyCompare(compareList) {
      currentState.compare = compareList.slice(0, MAX_COMPARE_CANDIDATES);
      compareCheckboxes.forEach(function (cb) {
        var id = cb.getAttribute('data-compare-id');
        var isChecked = currentState.compare.indexOf(id) !== -1;
        cb.checked = isChecked;
        var card = cb.closest('.card');
        if (card) {
          card.classList.toggle('is-selected-for-compare', isChecked);
        }
      });
      renderCompareTray();
    }

    function updateCardLinks(state) {
      var params = new URLSearchParams();
      if (state.edition && state.edition !== 'v3') params.set('edition', state.edition);
      if (state.task && state.task !== 'all') params.set('task', state.task);
      if (state.compare && state.compare.length > 0) {
        params.set('compare', state.compare.slice(0, MAX_COMPARE_CANDIDATES).join(','));
      }
      var qs = params.toString();
      var suffix = qs ? '?' + qs : '';

      var links = Array.prototype.slice.call(document.querySelectorAll('.card a[href], .card-link'));
      links.forEach(function (a) {
        var baseHref = a.getAttribute('data-base-href');
        if (!baseHref) {
          baseHref = a.getAttribute('href').split('?')[0];
          a.setAttribute('data-base-href', baseHref);
        }
        a.setAttribute('href', baseHref + suffix);
      });
    }

    function renderAll() {
      applyEdition(currentState.edition);
      applyTaskFilter(currentState.task);
      applyCompare(currentState.compare);
      updateCardLinks(currentState);
    }

    // Edition Tab clicks
    editionTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.getAttribute('data-edition-tab');
        if (!key || key === currentState.edition) return;
        currentState.edition = key;
        renderAll();
        syncUrl(currentState, false);
        var modal = document.getElementById('compare-modal-backdrop');
        if (modal && !modal.hasAttribute('hidden')) {
          renderCompareMatrix();
        }
      });
    });

    // Task Filter clicks & delegation
    if (filterBar) {
      filterBar.addEventListener('click', function (e) {
        var chip = e.target.closest('[data-task-filter]');
        if (!chip) return;
        var taskId = chip.getAttribute('data-task-filter');
        if (!taskId || taskId === currentState.task) return;
        currentState.task = taskId;
        renderAll();
        syncUrl(currentState, false);
      });

      // Keyboard navigation (Arrow keys, Home, End)
      filterBar.addEventListener('keydown', function (e) {
        var chip = e.target.closest('[data-task-filter]');
        if (!chip) return;
        var chipList = filterChips;
        var idx = chipList.indexOf(chip);
        if (idx === -1) return;

        var targetIdx = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          targetIdx = (idx + 1) % chipList.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          targetIdx = (idx - 1 + chipList.length) % chipList.length;
        } else if (e.key === 'Home') {
          targetIdx = 0;
        } else if (e.key === 'End') {
          targetIdx = chipList.length - 1;
        }

        if (targetIdx !== -1) {
          e.preventDefault();
          chipList[targetIdx].focus();
        }
      });
    }

    // Compare Checkbox clicks
    compareCheckboxes.forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-compare-id');
        var idx = currentState.compare.indexOf(id);
        if (cb.checked) {
          if (currentState.compare.length >= MAX_COMPARE_CANDIDATES) {
            alert('最多同时选择 ' + MAX_COMPARE_CANDIDATES + ' 个候选项目进行横向比对');
            cb.checked = false;
            return;
          }
          if (idx === -1) currentState.compare.push(id);
        } else {
          if (idx !== -1) currentState.compare.splice(idx, 1);
        }
        applyCompare(currentState.compare);
        updateCardLinks(currentState);
        syncUrl(currentState, false);
        var modal = document.getElementById('compare-modal-backdrop');
        if (modal && !modal.hasAttribute('hidden')) {
          renderCompareMatrix();
        }
      });
    });

    // Tray chips event delegation (remove individual candidate)
    var chipsContainer = document.getElementById('compare-tray-chips');
    if (chipsContainer) {
      chipsContainer.addEventListener('click', function (e) {
        var removeBtn = e.target.closest('[data-remove-id]');
        if (!removeBtn) return;
        var removeId = removeBtn.getAttribute('data-remove-id');
        var idx = currentState.compare.indexOf(removeId);
        if (idx !== -1) {
          currentState.compare.splice(idx, 1);
          applyCompare(currentState.compare);
          updateCardLinks(currentState);
          syncUrl(currentState, false);
          var modal = document.getElementById('compare-modal-backdrop');
          if (modal && !modal.hasAttribute('hidden')) {
            renderCompareMatrix();
          }
        }
      });
    }

    // Compare Tray Actions (Clear & Launch)
    var clearBtn = document.getElementById('compare-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        currentState.compare = [];
        applyCompare(currentState.compare);
        updateCardLinks(currentState);
        syncUrl(currentState, false);
        var modal = document.getElementById('compare-modal-backdrop');
        if (modal) modal.setAttribute('hidden', '');
      });
    }

    var launchBtn = document.getElementById('compare-launch-btn');
    if (launchBtn) {
      launchBtn.addEventListener('click', function () {
        if (currentState.compare.length < 2) return;
        var modal = document.getElementById('compare-modal-backdrop');
        if (modal) {
          renderCompareMatrix();
          modal.removeAttribute('hidden');
          var closeBtn = document.getElementById('compare-modal-close');
          if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
        }
      });
    }

    // Modal Close button & backdrop click
    var modalEl = document.getElementById('compare-modal-backdrop');
    var modalClose = document.getElementById('compare-modal-close');
    if (modalClose && modalEl) {
      modalClose.addEventListener('click', function () {
        modalEl.setAttribute('hidden', '');
      });
    }
    if (modalEl) {
      modalEl.addEventListener('click', function (e) {
        if (e.target === modalEl) {
          modalEl.setAttribute('hidden', '');
        }
      });
    }
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var m = document.getElementById('compare-modal-backdrop');
        if (m && !m.hasAttribute('hidden')) {
          m.setAttribute('hidden', '');
        }
      }
    });

    // Browser Navigation (Back / Forward)
    window.addEventListener('popstate', function () {
      currentState = parseUrlState();
      renderAll();
      var modal = document.getElementById('compare-modal-backdrop');
      if (modal && !modal.hasAttribute('hidden')) {
        renderCompareMatrix();
      }
    });

    window.addEventListener('hashchange', function () {
      currentState = parseUrlState();
      renderAll();
      var modal = document.getElementById('compare-modal-backdrop');
      if (modal && !modal.hasAttribute('hidden')) {
        renderCompareMatrix();
      }
    });

    // Initial render & sync
    renderAll();
    syncUrl(currentState);
  })();
  </script>`;

  return pageShell({
    title: '设计 Skill 横评 · V2 / V3 并列',
    description:
      '9 个设计项目 + 1 个裸对照在同一提示词族、同一模型下的 A1 个人介绍落地页实测：V2 未约束版与 V3 一次成版 + thinking high 并列对照。',
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
    ['读了 skill', readSkillText(run)],
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
    ['读了 skill', readSkillText(run)],
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

// --------------------------------------------------------------------- detail sections (5 Dimensions)

/** Section 1: 定位特点与任务契合 (.detail-positioning) */
function buildDetailPositioning({ id, skill, project, v2Run, v3Run }) {
  const p = project ?? {
    docPositioning: '未找到作者文档定位信息。',
    observedNote: '未找到本轮实测观察信息。',
    bestFor: '暂无推荐',
    tradeoff: '暂无取舍说明',
    editorialStatus: 'pending_review',
    tasks: [],
    tagline: '',
  };

  const pendingBadge =
    p.editorialStatus === 'pending_review'
      ? `<span class="badge badge-pending">待确认</span>`
      : '';

  const interruptedNotice = (v2Run?.interrupted || v3Run?.interrupted)
    ? `    <aside class="notice notice-warn">
      <span class="flag flag-warn">中途断过但有页面</span>
      <span>本轮测试会话在检查循环里异常中断，没有正常退出；但页面已写入磁盘并完成截图。</span>
    </aside>`
    : '';

  const taskPills = (p.tasks || [])
    .map((t) => `<span class="task-pill task-${esc(t)}">${esc(TASK_DISPLAY_NAMES[t] || t)}</span>`)
    .join('\n        ');

  const customReview = v3Run?.review || v2Run?.review || '';
  const customReviewHtml = customReview
    ? `      <div class="provenance-item provenance-custom">
        <div class="provenance-header">
          <span class="badge badge-custom">实测手记</span>
        </div>
        <div class="provenance-body">
          ${customReview
            .split(/\n\s*\n/)
            .map((para) => `<p>${esc(para.trim()).replace(/\n/g, '<br>')}</p>`)
            .join('\n')}
        </div>
      </div>`
    : '';

  return `  <section class="detail-section detail-positioning" aria-labelledby="section-positioning-title">
    <div class="detail-section-header">
      <h2 id="section-positioning-title" class="detail-section-title">
        <span class="section-num">01</span> 定位特点与任务契合
      </h2>
      <p class="section-lede">从官方文档设计主张、同题基准实测观察与选型编辑建议三个维度，客观剖析本项能力。</p>
    </div>

${interruptedNotice}

    <div class="positioning-summary-card">
      <div class="positioning-headline">
        <span class="tagline-tag">核心主张</span>
        <p class="tagline-text">${esc(p.tagline || '基于模型能力的页面生成')}</p>
      </div>
      <div class="positioning-tasks-row">
        <span class="tasks-label">适配任务场景：</span>
        <div class="task-pills">
          ${taskPills || '<span class="task-pill">通用网页设计</span>'}
        </div>
      </div>
    </div>

    <div class="provenance-card">
      <div class="provenance-item">
        <div class="provenance-header">
          <span class="badge badge-doc">作者文档描述</span>
        </div>
        <div class="provenance-body">
          <p>${esc(p.docPositioning)}</p>
        </div>
      </div>

      <div class="provenance-item">
        <div class="provenance-header">
          <span class="badge badge-observed">本次实测观察</span>
        </div>
        <div class="provenance-body">
          <p>${esc(p.observedNote)}</p>
        </div>
      </div>

      <div class="provenance-item">
        <div class="provenance-header">
          <span class="badge badge-editorial">编辑建议</span>
          ${pendingBadge}
        </div>
        <div class="provenance-body">
          <p><strong>优先推荐：</strong>${esc(p.bestFor)}</p>
          <p><strong>主要取舍：</strong>${esc(p.tradeoff)}</p>
        </div>
      </div>
${customReviewHtml}
    </div>
  </section>`;
}

/** Section 2: 成果截图与产物呈现 (.detail-visuals) */
function buildDetailVisuals({ id, skill, root, v2Run, v3Run }) {
  const v2Shot = `${root}v2/runs/${esc(id)}/shot-desktop.png`;
  const v3Shot = `${root}v3/runs/${esc(id)}/shot-desktop.png`;

  return `  <section class="detail-section detail-visuals" aria-labelledby="section-visuals-title">
    <div class="detail-section-header">
      <h2 id="section-visuals-title" class="detail-section-title">
        <span class="section-num">02</span> 成果截图与产物呈现
      </h2>
      <p class="section-lede">同题同机环境下生成的完整静态网页全屏截图。桌面端并排比对，移动端支持同位无缝切换。</p>
    </div>

    <div class="visuals-edition-switcher" role="tablist" aria-label="移动端版本视觉切换">
      <button type="button" class="tab-btn active" data-visual-target="v3" role="tab" aria-selected="true">V3 一次成版 (推荐)</button>
      <button type="button" class="tab-btn" data-visual-target="v2" role="tab" aria-selected="false">V2 未约束自检版</button>
    </div>

    <div class="visuals-compare-grid compare-split" data-active-view="v3">
      <div class="visual-col visual-col-v3" data-edition="v3">
        <div class="visual-col-head">
          <span class="badge badge-v3">V3</span>
          <strong>一次成版约束 + thinking high</strong>
          <span class="visual-meta">${esc(v3Run?.duration ? formatDuration(v3Run.duration) : '')} · ${v3Run?.llmCalls ?? 0} 次调用</span>
        </div>
        <div class="shot-frame shot-frame-compare">
          <a href="${v3Shot}" target="_blank" rel="noopener" title="点击新窗口查看 V3 全页截图 (1440px)">
            <img src="${v3Shot}" alt="V3 ${esc(id)} 全页产出截图" loading="lazy" width="720">
          </a>
        </div>
      </div>

      <div class="visual-col visual-col-v2" data-edition="v2">
        <div class="visual-col-head">
          <span class="badge badge-v2">V2</span>
          <strong>未约束版（多轮自检与CSS微调）</strong>
          <span class="visual-meta">${esc(v2Run?.duration ? formatDuration(v2Run.duration) : '')} · ${v2Run?.llmCalls ?? 0} 次调用</span>
        </div>
        <div class="shot-frame shot-frame-compare">
          <a href="${v2Shot}" target="_blank" rel="noopener" title="点击新窗口查看 V2 全页截图 (1440px)">
            <img src="${v2Shot}" alt="V2 ${esc(id)} 全页产出截图" loading="lazy" width="720">
          </a>
        </div>
      </div>
    </div>
  </section>`;
}

/** Section 3: 版本差异与演化观察 (.detail-differences) */
function buildDetailDifferences({ id, project, v2Run, v3Run }) {
  const durDiff = (v2Run?.duration && v3Run?.duration)
    ? (v2Run.duration > v3Run.duration
        ? `V3 耗时缩短 ${Math.round((1 - v3Run.duration / v2Run.duration) * 100)}%`
        : `两版耗时接近`)
    : '单跑次耗时对比';

  const callDiff = (v2Run?.llmCalls && v3Run?.llmCalls)
    ? `LLM 调用从 ${v2Run.llmCalls} 次骤降至 ${v3Run.llmCalls} 次`
    : '调用开销对比';

  const compliance = (v3Run?.browserChecks > 0 || v3Run?.htmlEdits > 1)
    ? `V3 出现 ${v3Run.browserChecks} 次浏览器探测及 ${v3Run.htmlEdits} 次微调，未完全一次成版。`
    : `V3 严格遵从一次性成版硬约束，无多轮浏览器截屏自检。`;

  return `  <section class="detail-section detail-differences" aria-labelledby="section-differences-title">
    <div class="detail-section-header">
      <h2 id="section-differences-title" class="detail-section-title">
        <span class="section-num">03</span> 版本差异与演化观察
      </h2>
      <p class="section-lede">对比两轮实验在耗时、调用开销、生成策略及版式表现上的客观演进与核心差异。</p>
    </div>

    <div class="differences-cards-grid">
      <div class="diff-card">
        <h3 class="diff-card-title">开销与效率演变</h3>
        <ul class="diff-card-list">
          <li><strong>耗时演进：</strong>V2 ${formatDuration(v2Run?.duration)} → V3 ${formatDuration(v3Run?.duration)}（${esc(durDiff)}）</li>
          <li><strong>调用演进：</strong>${esc(callDiff)}，工具调用 ${v2Run?.toolCalls ?? 0} → ${v3Run?.toolCalls ?? 0} 次</li>
          <li><strong>Prompt 缓存：</strong>V3 缓存读取 ${tokenCells(v3Run?.tokens, 'cacheRead')}，相比 V2 显著收敛</li>
        </ul>
      </div>

      <div class="diff-card">
        <h3 class="diff-card-title">版式风格与执行遵从</h3>
        <ul class="diff-card-list">
          <li><strong>实测特征：</strong>${esc(project?.observedNote || '两版版式风格基本一致')}</li>
          <li><strong>约束遵从：</strong>${esc(compliance)}</li>
          <li><strong>退出状态：</strong>V2 ${hasNumber(v2Run?.exit) ? `退出码 ${v2Run.exit}` : '会话中断'} · V3 ${hasNumber(v3Run?.exit) ? `退出码 ${v3Run.exit}` : '无退出码'}</li>
        </ul>
      </div>
    </div>
  </section>`;
}

/** Section 4: 独立交互预览与视口体验 (.detail-preview) */
function buildDetailPreview({ id, root, v2Run, v3Run }) {
  const v3Live = `${root}v3/runs/${esc(id)}/index.html`;
  const v2Live = `${root}v2/runs/${esc(id)}/index.html`;

  return `  <section class="detail-section detail-preview" aria-labelledby="section-preview-title">
    <div class="detail-section-header">
      <h2 id="section-preview-title" class="detail-section-title">
        <span class="section-num">04</span> 独立交互预览与视口体验
      </h2>
      <p class="section-lede">提供带显式视口标注的独立全屏预览入口，避免内嵌 iframe 容器变形；亦可在此直接体验生成的真实 HTML 页面。</p>
    </div>

    <div class="preview-launchers-grid">
      <div class="preview-card">
        <div class="preview-card-head">
          <span class="badge badge-v3">V3 成果</span>
          <strong>一次成版交互页面</strong>
        </div>
        <p class="preview-card-desc">以独立新窗口打开 V3 产出的 <code>index.html</code>，支持在真实桌面或移动设备视口下体验交互与动效。</p>
        <div class="preview-card-actions">
          <a class="button button-primary" href="${v3Live}" target="_blank" rel="noopener">
            全屏查看页面 (1440px 桌面视口) ↗
          </a>
          <a class="button button-outline" href="${v3Live}" target="_blank" rel="noopener">
            移动端视图 (390px 视口) ↗
          </a>
        </div>
      </div>

      <div class="preview-card">
        <div class="preview-card-head">
          <span class="badge badge-v2">V2 成果</span>
          <strong>未约束版交互页面</strong>
        </div>
        <p class="preview-card-desc">以独立新窗口打开 V2 产出的 <code>index.html</code>，对比未约束多轮迭代的页面效果。</p>
        <div class="preview-card-actions">
          <a class="button button-primary" href="${v2Live}" target="_blank" rel="noopener">
            全屏查看页面 (1440px 桌面视口) ↗
          </a>
          <a class="button button-outline" href="${v2Live}" target="_blank" rel="noopener">
            移动端视图 (390px 视口) ↗
          </a>
        </div>
      </div>
    </div>

    <div class="preview-inline-browser">
      <div class="browser">
        <div class="browser-bar">
          <span class="browser-path">runs/2026-10-29-r3/${esc(id)}/index.html</span>
          <span class="spacer"></span>
          <span class="viewport-tag">推荐视口：1440px × 900px</span>
          <a class="button button-sm button-ghost" href="${v3Live}" target="_blank" rel="noopener">新窗口独立打开</a>
        </div>
        <iframe class="live-frame live-frame-preview" src="${v3Live}" loading="lazy" title="V3 ${esc(id)} 真实网页内嵌交互预览"></iframe>
      </div>
    </div>
  </section>`;
}

/** Section 5: 评测证据链与执行数据 (.detail-evidence) */
function buildDetailEvidence({ id, v2Run, v3Run, promptV2, promptV3 }) {
  const p3 = v3Run?.prompt || promptV3 || '（提示词原文缺失）';
  const p2 = v2Run?.prompt || promptV2 || '（提示词原文缺失）';
  const log3 = v3Run?.log || '（暂无详细终端日志）';
  const log2 = v2Run?.log || '（暂无详细终端日志）';

  return `  <section class="detail-section detail-evidence" aria-labelledby="section-evidence-title">
    <div class="detail-section-header">
      <h2 id="section-evidence-title" class="detail-section-title">
        <span class="section-num">05</span> 评测证据链与执行数据
      </h2>
      <p class="section-lede">完整保留客观实测数据、原始提示词与执行日志。默认折叠收纳，避免长文本干扰核心选型体验，点击可展开深入审计。</p>
    </div>

    <details class="evidence-accordion details-accordion">
      <summary class="accordion-summary"><span class="accordion-title">实测数据与完整指标对比表（V2 vs V3）</span><span class="accordion-hint">点击展开详细指标表</span></summary>
      <div class="accordion-body">
        <div class="table-wrap">
          <table class="kv kv-compare">
            <thead>
              <tr>
                <th scope="col" style="width:26%">评测指标</th>
                <th scope="col" style="width:37%"><span class="badge badge-v3">V3</span> 一次成版</th>
                <th scope="col" style="width:37%"><span class="badge badge-v2">V2</span> 未约束自检版</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">单轮耗时</th>
                <td class="mono">${formatDuration(v3Run?.duration)}</td>
                <td class="mono">${formatDuration(v2Run?.duration)}</td>
              </tr>
              <tr>
                <th scope="row">LLM 调用次数</th>
                <td class="mono">${fmtInt(v3Run?.llmCalls)} 次</td>
                <td class="mono">${fmtInt(v2Run?.llmCalls)} 次</td>
              </tr>
              <tr>
                <th scope="row">工具调用次数</th>
                <td class="mono">${fmtInt(v3Run?.toolCalls)} 次</td>
                <td class="mono">${fmtInt(v2Run?.toolCalls)} 次</td>
              </tr>
              <tr>
                <th scope="row">输入 token (raw input)</th>
                <td class="mono">${tokenCells(v3Run?.tokens, 'input')}</td>
                <td class="mono">${tokenCells(v2Run?.tokens, 'input')}</td>
              </tr>
              <tr>
                <th scope="row">输出 token (output)</th>
                <td class="mono">${tokenCells(v3Run?.tokens, 'output')}</td>
                <td class="mono">${tokenCells(v2Run?.tokens, 'output')}</td>
              </tr>
              <tr>
                <th scope="row">缓存读取 (cacheRead)</th>
                <td class="mono">${tokenCells(v3Run?.tokens, 'cacheRead')}</td>
                <td class="mono">${tokenCells(v2Run?.tokens, 'cacheRead')}</td>
              </tr>
              <tr>
                <th scope="row">页面体积 (HTML bytes)</th>
                <td class="mono">${fmtInt(v3Run?.bytes)} 字节</td>
                <td class="mono">${fmtInt(v2Run?.bytes)} 字节</td>
              </tr>
              <tr>
                <th scope="row">读了 skill</th>
                <td>${readSkillText(v3Run)}</td>
                <td>${readSkillText(v2Run)}</td>
              </tr>
              <tr>
                <th scope="row">执行退出码</th>
                <td class="mono">${hasNumber(v3Run?.exit) ? String(v3Run.exit) : '无记录'}</td>
                <td class="mono">${hasNumber(v2Run?.exit) ? String(v2Run.exit) : '无记录（会话中断）'}</td>
              </tr>
              <tr>
                <th scope="row">开始时间</th>
                <td>${cstToZh(v3Run?.start) || '暂无'}</td>
                <td>${cstToZh(v2Run?.start) || '暂无'}</td>
              </tr>
              <tr>
                <th scope="row">结束时间</th>
                <td>${cstToZh(v3Run?.end) || '暂无'}</td>
                <td>${cstToZh(v2Run?.end) || '暂无'}</td>
              </tr>
              <tr>
                <th scope="row">执行状态备注</th>
                <td>${esc(v3Run?.note || '无异常记录')}</td>
                <td>${esc(v2Run?.note || '无异常记录')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="fine">数据来源：runs/2026-10-29-r2 与 runs/2026-10-29-r3 的 _metrics.json 与各轮 meta.json；费用记为「暂无」。不排名、不打分。</p>
      </div>
    </details>

    <details class="evidence-accordion details-accordion">
      <summary class="accordion-summary"><span class="accordion-title">评测任务完整提示词 (Prompt 原文)</span><span class="accordion-hint">点击展开查看发送给模型的原始提示词</span></summary>
      <div class="accordion-body">
        <div class="prompt-tab-panel">
          <h4 style="margin:0 0 8px;font-size:13px;color:var(--muted)">V3 提示词（含一次成版交付约束与 thinking high）</h4>
          <pre class="code-block" tabindex="0"><code>${esc(p3)}</code></pre>
        </div>
        <div class="prompt-tab-panel" style="margin-top:16px">
          <h4 style="margin:0 0 8px;font-size:13px;color:var(--muted)">V2 提示词（未约束迭代版）</h4>
          <pre class="code-block" tabindex="0"><code>${esc(p2)}</code></pre>
        </div>
      </div>
    </details>

    <details class="evidence-accordion details-accordion">
      <summary class="accordion-summary"><span class="accordion-title">运行日志与执行诊断 (Execution Log & Session)</span><span class="accordion-hint">点击展开查看运行退出状态与工具调用记录</span></summary>
      <div class="accordion-body">
        <div class="log-block">
          <h4 style="margin:0 0 8px;font-size:13px;color:var(--muted)">V3 运行日志 (退出码：${hasNumber(v3Run?.exit) ? v3Run.exit : '无记录'})</h4>
          <pre class="code-block" tabindex="0"><code>${esc(log3)}</code></pre>
        </div>
        <div class="log-block" style="margin-top:16px">
          <h4 style="margin:0 0 8px;font-size:13px;color:var(--muted)">V2 运行日志 (退出码：${hasNumber(v2Run?.exit) ? v2Run.exit : '无记录（会话中断）'})</h4>
          <pre class="code-block" tabindex="0"><code>${esc(log2)}</code></pre>
        </div>
      </div>
    </details>
  </section>`;
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

function buildCompareDetail({ id, skill, columns, prevId, nextId, promptV2, promptV3 }) {
  const root = '../../';
  const nav = [
    `<a class="back" href="${root}index.html" data-back="true">← 返回总览</a>`,
    '<span class="detail-nav-hint">（单 Skill 跨实验纵向对比）</span>',
    '<span class="pager">',
    prevId
      ? `<a href="../${esc(prevId)}/detail.html">← ${esc(prevId)}</a>`
      : '<span class="disabled">← 上一个</span>',
    nextId
      ? `<a href="../${esc(nextId)}/detail.html">${esc(nextId)} →</a>`
      : '<span class="disabled">下一个 →</span>',
    '</span>',
  ].join('\n      ');

  const v2Col = columns.find((c) => c.edition.key === 'v2');
  const v3Col = columns.find((c) => c.edition.key === 'v3');
  const v2Run = v2Col ? v2Col.run : null;
  const v3Run = v3Col ? v3Col.run : null;
  const project = v3Run?.project || v2Run?.project || (PROJECT_BY_ID && PROJECT_BY_ID[id]) || PROJECTS.find(p => p.id === id);

  const section1 = buildDetailPositioning({ id, skill, project, v2Run, v3Run });
  const section2 = buildDetailVisuals({ id, skill, root, v2Run, v3Run });
  const section3 = buildDetailDifferences({ id, project, v2Run, v3Run });
  const section4 = buildDetailPreview({ id, root, v2Run, v3Run });
  const section5 = buildDetailEvidence({ id, v2Run, v3Run, promptV2, promptV3 });

  const body = `${topbar({
    depth: 2,
    right: '',
  })}
  <main class="wrap wrap-compare" id="main">
    <nav class="topnav" aria-label="页面导航">
      ${nav}
    </nav>

    <header class="hero detail-head">
      <p class="eyebrow"><span class="badge badge-outline">单 Skill 跨实验纵向对比</span> V2 / V3 维度化解析 · 第 ${esc(id.slice(0, 2))} 组</p>
      <h1><span class="idx">${esc(id.slice(0, 2))}</span>${esc(skill)}</h1>
      <p class="lede">本页为「跨实验纵向对比」（同一 Skill 在 V2 试错迭代版 vs V3 一次成版之间的演进变化与指标差异）。如需比较不同 Skill 之间的横向版式，请返回总览使用「同版本横向比对」功能。</p>
      <ul class="chip-row">
        <li>${esc(id)}</li>
        <li>不排名 · 不打分</li>
        <li>三级评价标注</li>
      </ul>
    </header>

${section1}

${section2}

${section3}

${section4}

${section5}

    <footer class="footer">
      <p class="repo"><a href="${esc(REPO_URL)}">${esc(REPO_URL)}</a></p>
      <p>数据：runs/2026-10-29-r2、runs/2026-10-29-r3 的 _metrics.json 与各轮 meta.json。原始产出未改写。</p>
    </footer>
  </main>
  <script>
  (function () {
    // 1. 还原 URL 过滤与对比参数至返回导航链接
    var search = window.location.search || (document.referrer && document.referrer.indexOf('?') !== -1 ? '?' + document.referrer.split('?')[1] : '');
    if (search) {
      var links = Array.prototype.slice.call(document.querySelectorAll('a.back, .pager a'));
      links.forEach(function (a) {
        var base = a.getAttribute('href').split('?')[0];
        a.setAttribute('href', base + search);
      });
    }

    // 2. 移动端版本视觉同位切换 (V2 vs V3)
    var switchBtns = Array.prototype.slice.call(document.querySelectorAll('.visuals-edition-switcher .tab-btn'));
    var visualsGrid = document.querySelector('.visuals-compare-grid');
    if (switchBtns.length && visualsGrid) {
      switchBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var target = btn.getAttribute('data-visual-target');
          switchBtns.forEach(function (b) {
            b.classList.toggle('active', b === btn);
            b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
          });
          visualsGrid.setAttribute('data-active-view', target);
        });
      });
    }
  })();
  </script>`;

  return pageShell({
    title: `${id} · ${skill} · V2 / V3 对比 · 设计 Skill 横评`,
    description: `${id}（${skill}）在 V2（未约束版）与 V3（一次成版 + thinking high）中的维度化解析与对比。`,
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
        if (name.startsWith('.') || name === 'session' || name === 'detail.html') continue;
        const srcPath = join(run.dir, name);
        const dstPath = join(outDir, name);
        const st = statSync(srcPath);
        if (st.isDirectory()) {
          cpSync(srcPath, dstPath, { recursive: true });
        } else if (st.isFile()) {
          copyFileSync(srcPath, dstPath);
        }
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

  const promptV2 = editionsData.find((e) => e.edition.key === 'v2')?.prompt || '';
  const promptV3 = editionsData.find((e) => e.edition.key === 'v3')?.prompt || '';

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
      buildCompareDetail({ id, skill, columns, prevId, nextId, promptV2, promptV3 }),
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

  // Standalone compare.html entry point redirecting to index.html with preserved comparison query
  writeFileSync(
    join(DIST, 'compare.html'),
    `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=index.html">
<title>多候选横向比对 · 重定向中</title>
<script>
window.location.replace('index.html' + window.location.search);
</script>
</head>
<body>
<p><a href="index.html">正在前往多候选横向比对页面...</a></p>
</body>
</html>`,
    'utf8',
  );

  for (const { edition, runs } of editionsData) {
    console.log(`built ${edition.key} (${edition.runDate}): ${runs.length} runs`);
    for (const run of runs) console.log(`  ${edition.key}/runs/${run.id}/ (assets)`);
  }
  console.log(`compare pages -> ${DIST}/runs/<id>/detail.html (${ids.length})`);
  console.log(`overview -> ${DIST}/index.html`);
}

main();
