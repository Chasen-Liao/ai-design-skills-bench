#!/usr/bin/env node
// Zero-dependency static site builder for the A1 design-skills benchmark.
// Usage: node site/build.mjs   ->   site/dist/

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const RUN_DATE = '2026-10-29';
const HERE = import.meta.dirname;
const REPO_ROOT = resolve(HERE, '..');
const RUNS_DIR = join(REPO_ROOT, 'runs', RUN_DATE);
const THUMBS_SRC = join(HERE, 'thumbs');
const DIST = join(HERE, 'dist');
const REPO_URL = 'https://github.com/Chasen-Liao/ai-design-skills-bench';

const MODEL_NAME = 'DeepSeek V4.1 Flash 1017';
const MODEL_LABEL = `${MODEL_NAME}（ZenMux）`;
const MODEL_ID = 'deepseek/deepseek-v4.1-flash';

// ---------------------------------------------------------------- utilities

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const readText = (path) => readFileSync(path, 'utf8');

function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total)) return 'n/a';
  const whole = Math.max(0, Math.round(total));
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins} 分 ${secs} 秒`;
}

function isPlainFile(dir, name) {
  if (name.startsWith('.')) return false;
  try {
    return statSync(join(dir, name)).isFile();
  } catch {
    return false;
  }
}

// ------------------------------------------------------- markdown table parser

/**
 * Parse the first markdown table that follows an exact heading line.
 * Returns { header: string[], rows: Object<string,string>[] }.
 */
function parseTable(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return { header: [], rows: [] };

  let i = start + 1;
  while (i < lines.length && !lines[i].trim().startsWith('|')) i += 1;
  if (i >= lines.length) return { header: [], rows: [] };

  const splitRow = (line) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

  const header = splitRow(lines[i]);
  i += 1;

  // Separator row: | --- | ---: | ...
  if (i < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i].trim())) i += 1;

  const rows = [];
  for (; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;
    const cells = splitRow(line);
    if (cells.every((cell) => cell === '')) break;
    const row = {};
    header.forEach((key, idx) => {
      row[key] = cells[idx] ?? '';
    });
    rows.push(row);
  }

  return { header, rows };
}

// ------------------------------------------------------------------ data load

function loadRuns() {
  const metrics = readText(join(RUNS_DIR, '_metrics.md'));
  const summary = parseTable(metrics, '## Summary table').rows;
  const weightDetail = parseTable(metrics, '## Process weight detail (observational)').rows;

  const summaryByRun = new Map(summary.map((row) => [row.run, row]));
  const weightByRun = new Map(weightDetail.map((row) => [row.run, row]));

  const dirs = readdirSync(RUNS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d\d/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  return dirs.map((name) => {
    const dir = join(RUNS_DIR, name);
    const meta = JSON.parse(readText(join(dir, 'meta.json')));
    const summaryRow = summaryByRun.get(name) ?? {};
    const weightRow = weightByRun.get(name) ?? {};
    const reviewPath = join(dir, 'review.md');
    const review = existsSync(reviewPath) ? readText(reviewPath).trim() : '';

    return {
      id: name,
      dir,
      meta,
      skill: meta.skill ? meta.skill : 'none（裸 Pi 对照）',
      duration: meta.duration_s,
      exit: meta.exit,
      bytes: meta.bytes,
      processWeight: summaryRow.process_weight || weightRow.weight || 'n/a',
      loop: weightRow['what happened in the loop'] || '',
      notes: summaryRow['notes / issues'] || meta.notes || '',
      review,
    };
  });
}

// --------------------------------------------------------------- page helpers

const pageShell = ({ title, body, depth }) => {
  const css = depth === 0 ? 'style.css' : `${'../'.repeat(depth)}style.css`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${css}">
</head>
<body>
${body}
</body>
</html>
`;
};

const reviewBlock = (review) =>
  review
    ? review
        .split(/\n\s*\n/)
        .map((paragraph) => `      <p>${esc(paragraph.trim()).replace(/\n/g, '<br>')}</p>`)
        .join('\n')
    : '      <p class="placeholder">待 Chasen 填写</p>';

// ------------------------------------------------------------------- overview

function buildIndex(runs, prompt) {
  const cards = runs
    .map((run, index) => {
      const thumbPath = join(DIST, 'thumbs', `${run.id}.webp`);
      const thumb = existsSync(thumbPath)
        ? `<img src="thumbs/${esc(run.id)}.webp" alt="${esc(run.id)} 页面缩略图" loading="lazy" width="720" height="450">`
        : '<div class="thumb-missing">缩略图缺失</div>';
      return `      <a class="card" href="runs/${esc(run.id)}/detail.html">
        <div class="thumb">${thumb}</div>
        <div class="card-body">
          <h3 class="card-title"><span class="num">${String(index).padStart(2, '0')}</span>${esc(run.skill)}</h3>
          <p class="card-meta">耗时 ${esc(formatDuration(run.duration))} · 流程 ${esc(run.processWeight)}</p>
        </div>
      </a>`;
    })
    .join('\n');

  const tableRows = runs
    .map(
      (run) => `          <tr>
            <td class="nowrap"><a href="runs/${esc(run.id)}/detail.html">${esc(run.id)}</a></td>
            <td>${esc(run.skill)}</td>
            <td class="num">${esc(run.duration)}</td>
            <td class="num">${esc(run.exit)}</td>
            <td class="num">${esc(run.bytes)}</td>
            <td class="na">n/a</td>
            <td class="na">n/a</td>
            <td>${esc(run.processWeight)}</td>
            <td class="notes">${esc(run.notes)}</td>
          </tr>`,
    )
    .join('\n');

  const body = `  <main class="wrap">
    <header class="hero">
      <h1>设计 Skill 横评 · A1 个人介绍落地页</h1>
      <p class="lede">同一段提示词、同一个模型，10 组只差一个 skill。</p>
    </header>

    <section class="setup" aria-labelledby="setup-title">
      <h2 id="setup-title">对照设定</h2>
      <ul>
        <li><strong>同一提示词</strong>：Chasen 个人介绍落地页（原文见下方）。</li>
        <li><strong>同一模型</strong>：ZenMux 上的 ${esc(MODEL_NAME)}（<code>${esc(MODEL_ID)}</code>）。</li>
        <li><strong>同一 harness</strong>：极简 Pi，仅 read / bash / edit / write 四个工具，<code>--no-session</code>。</li>
        <li><strong>每个目录只装一个被测 skill</strong>，00-bare 为不装 skill 的对照。</li>
        <li><strong>单次运行</strong>，结果有随机性。</li>
        <li><strong>本站不排名、不打分。</strong></li>
      </ul>
    </section>

    <section aria-labelledby="grid-title">
      <h2 id="grid-title">10 组实测</h2>
      <div class="grid">
${cards}
      </div>
    </section>

    <section aria-labelledby="data-title">
      <h2 id="data-title">实测数据</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>run</th>
              <th>skill</th>
              <th>耗时(s)</th>
              <th>exit</th>
              <th>HTML 字节</th>
              <th>tokens</th>
              <th>费用</th>
              <th>流程轻重</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
${tableRows}
          </tbody>
        </table>
      </div>
      <p class="fine">token 与费用不可得（run 使用 <code>--no-session</code>，未保留 usage），记为 n/a，不做估算。</p>
    </section>

    <section aria-labelledby="prompt-title">
      <details class="prompt" open>
        <summary id="prompt-title">统一提示词原文</summary>
        <pre>${esc(prompt)}</pre>
      </details>
    </section>

    <footer class="footer">
      <p><a href="${esc(REPO_URL)}">${esc(REPO_URL)}</a></p>
      <p class="fine">数据来自 runs/${esc(RUN_DATE)}/_metrics.md、_log.md。</p>
    </footer>
  </main>`;

  return pageShell({ title: '设计 Skill 横评 · A1 个人介绍落地页', body, depth: 0 });
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
    ['开始', run.meta.start],
    ['结束', run.meta.end],
    ['耗时', formatDuration(run.duration)],
    ['exit', run.exit],
    ['HTML 字节', run.bytes],
    ['tokens', 'n/a'],
    ['费用', 'n/a'],
    ['流程轻重', run.processWeight],
    ['循环中发生了什么', run.loop || 'n/a'],
    ['备注', run.notes || 'n/a'],
  ]
    .map(
      ([label, value]) => `          <tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`,
    )
    .join('\n');

  const body = `  <main class="wrap">
    <nav class="topnav">
      ${nav}
    </nav>

    <header class="hero">
      <h1><span class="num">${esc(run.id.slice(0, 2))}</span>${esc(run.skill)}</h1>
      <p class="strip">同一提示词 · 同一模型 ${esc(MODEL_LABEL)}· 极简 Pi 四工具 · 只装这一个 skill</p>
    </header>

    <section aria-labelledby="facts-title">
      <h2 id="facts-title">实测数据</h2>
      <div class="table-wrap">
        <table class="kv">
          <tbody>
${facts}
          </tbody>
        </table>
      </div>
    </section>

    <section aria-labelledby="live-title">
      <h2 id="live-title">真实页面</h2>
      <p><a class="button" href="index.html" target="_blank" rel="noopener">新窗口打开</a></p>
      <iframe class="live-frame" src="index.html" loading="lazy" title="${esc(run.id)} 生成的页面"></iframe>
    </section>

    <section aria-labelledby="shot-title">
      <h2 id="shot-title">全页截图</h2>
      <div class="shot-frame">
        <a href="shot-desktop.png" target="_blank" rel="noopener"><img src="shot-desktop.png" loading="lazy" alt="${esc(run.id)} 全页截图"></a>
      </div>
    </section>

    <section aria-labelledby="review-title">
      <h2 id="review-title">Chasen 的评价</h2>
      <div class="review">
${reviewBlock(run.review)}
      </div>
      <p class="fine">编辑 runs/${esc(RUN_DATE)}/${esc(run.id)}/review.md 后重新构建即可更新。</p>
    </section>

    <footer class="footer">
      <p><a href="${esc(REPO_URL)}">${esc(REPO_URL)}</a></p>
    </footer>
  </main>`;

  return pageShell({
    title: `${run.id} · ${run.skill} · 设计 Skill 横评`,
    body,
    depth: 2,
  });
}

// ----------------------------------------------------------------------- main

function main() {
  const runs = loadRuns();
  const prompt = readText(join(RUNS_DIR, '_prompt-a1.txt'));

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
