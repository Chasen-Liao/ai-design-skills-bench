import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve('.');
const DIST = path.join(REPO_ROOT, 'site/dist');

test('Challenger M1-1 Deep Empirical Verification Suite', async (t) => {
  // 1. Interface Contract 1 Verification
  await t.test('1. Interface Contract 1 conformance (site/data/projects.mjs)', async () => {
    const projectsPath = path.join(REPO_ROOT, 'site/data/projects.mjs');
    assert.ok(fs.existsSync(projectsPath), 'site/data/projects.mjs must exist');

    const { PROJECTS, PROJECT_BY_ID } = await import(`file://${projectsPath.replace(/\\/g, '/')}`);

    assert.ok(Array.isArray(PROJECTS), 'PROJECTS must be an array');
    assert.equal(PROJECTS.length, 10, 'PROJECTS must contain exactly 10 entries');
    assert.equal(Object.keys(PROJECT_BY_ID).length, 10, 'PROJECT_BY_ID must index 10 entries');

    const expectedIds = [
      '00-bare',
      '01-frontend-design',
      '02-ui-ux-pro-max',
      '03-baoyu-design',
      '04-oil-ui',
      '05-ai-design-skills',
      '06-huashu-design',
      '07-hallmark',
      '08-taste-skill',
      '09-awesome-design-md',
    ];

    const validTasks = ['portfolio', 'landing', 'admin', 'prototype', 'style-ref'];

    for (let i = 0; i < 10; i++) {
      const id = expectedIds[i];
      const p = PROJECTS[i];
      assert.equal(p.id, id, `Project at index ${i} must have id ${id}`);
      assert.strictEqual(PROJECT_BY_ID[id], p, `PROJECT_BY_ID[${id}] must match PROJECTS[${i}]`);

      assert.ok(p.name && p.name.trim().length > 0, `${id} name must be non-empty`);
      assert.ok(p.tagline && p.tagline.trim().length > 0, `${id} tagline must be non-empty`);
      assert.ok(p.bestFor && p.bestFor.trim().length > 0, `${id} bestFor must be non-empty`);
      assert.ok(p.tradeoff && p.tradeoff.trim().length > 0, `${id} tradeoff must be non-empty`);
      assert.ok(p.docPositioning && p.docPositioning.trim().length > 0, `${id} docPositioning must be non-empty`);
      assert.ok(p.observedNote && p.observedNote.trim().length > 0, `${id} observedNote must be non-empty`);

      assert.ok(Array.isArray(p.tasks) && p.tasks.length > 0, `${id} tasks must be non-empty array`);
      for (const task of p.tasks) {
        assert.ok(validTasks.includes(task), `${id} task ${task} must be in ${validTasks.join(', ')}`);
      }

      assert.ok(['confirmed', 'pending_review'].includes(p.editorialStatus), `${id} editorialStatus must be confirmed or pending_review`);

      if (id === '00-bare' || id === '09-awesome-design-md') {
        assert.equal(p.isSkill, false, `${id} isSkill must be false`);
      } else {
        assert.equal(p.isSkill, true, `${id} isSkill must be true`);
      }
    }
  });

  // 2. 20 Runs Raw Data vs Computed Totals
  await t.test('2. 20 Runs raw metrics vs calculated totals & formatting', () => {
    const r2Metrics = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'runs/2026-10-29-r2/_metrics.json'), 'utf8'));
    const r3Metrics = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'runs/2026-10-29-r3/_metrics.json'), 'utf8'));

    assert.equal(Object.keys(r2Metrics).length, 10, 'V2 raw metrics must have 10 runs');
    assert.equal(Object.keys(r3Metrics).length, 10, 'V3 raw metrics must have 10 runs');

    let v2DurationSum = 0;
    let v2InputSum = 0;
    let v2OutputSum = 0;
    let v2CacheReadSum = 0;
    for (const [id, m] of Object.entries(r2Metrics)) {
      v2DurationSum += m.meta?.duration_s ?? 0;
      v2InputSum += m.tokens?.input ?? 0;
      v2OutputSum += m.tokens?.output ?? 0;
      v2CacheReadSum += m.tokens?.cacheRead ?? 0;
    }
    assert.equal(v2DurationSum, 10172, 'V2 duration sum must be 10,172 seconds');

    let v3DurationSum = 0;
    let v3InputSum = 0;
    let v3OutputSum = 0;
    let v3CacheReadSum = 0;
    for (const [id, m] of Object.entries(r3Metrics)) {
      v3DurationSum += m.meta?.duration_s ?? 0;
      v3InputSum += m.tokens?.input ?? 0;
      v3OutputSum += m.tokens?.output ?? 0;
      v3CacheReadSum += m.tokens?.cacheRead ?? 0;
    }
    assert.equal(v3DurationSum, 2643, 'V3 duration sum must be 2,643 seconds');

    const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

    // Check V2 stats rendered in index.html
    assert.match(indexHtml, /169 分 32 秒/, 'V2 cumulative duration must be formatted as 169 分 32 秒');
    assert.match(indexHtml, /71 分 10 秒/, 'V2 wall clock duration must be formatted as 71 分 10 秒');
    assert.match(indexHtml, /44 分 3 秒/, 'V3 cumulative duration must be formatted as 44 分 3 秒');
    assert.match(indexHtml, /23 分 31 秒/, 'V3 wall clock duration must be formatted as 23 分 31 秒');
  });

  // 3. 00-bare readSkill exclusion & labeling
  await t.test('3. 00-bare readSkill rectification (F08)', () => {
    const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    const v2Index = indexHtml.indexOf('data-edition="v2"');
    const v3Index = indexHtml.indexOf('data-edition="v3"');
    const v2Html = indexHtml.slice(v2Index, v3Index);
    const v3Html = indexHtml.slice(v3Index);

    // V2 00-bare
    assert.ok(v2Html.includes('未安装 / 不适用'), 'V2 00-bare row/card must display 未安装 / 不适用');
    assert.match(v2Html, /<span class="value">9<small>\/ 9<\/small><\/span>/, 'V2 readSkill stat must show 9 / 9');

    // V3 00-bare
    assert.ok(v3Html.includes('未安装 / 不适用'), 'V3 00-bare row/card must display 未安装 / 不适用');
    assert.match(v3Html, /<span class="value">9<small>\/ 9<\/small><\/span>/, 'V3 readSkill stat must show 9 / 9');

    // Detail page for 00-bare
    const bareDetail = fs.readFileSync(path.join(DIST, 'runs/00-bare/detail.html'), 'utf8');
    assert.ok(bareDetail.includes('读了 skill：未安装 / 不适用'), '00-bare detail page must display 读了 skill：未安装 / 不适用');
    assert.ok(!bareDetail.includes('读了 skill：是'), '00-bare detail page must not display 读了 skill：是');
  });

  // 4. 08-taste-skill warning badge retention
  await t.test('4. 08-taste-skill warning badge retention (F10)', () => {
    const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    const v2Index = indexHtml.indexOf('data-edition="v2"');
    const v3Index = indexHtml.indexOf('data-edition="v3"');
    const v2Html = indexHtml.slice(v2Index, v3Index);
    const v3Html = indexHtml.slice(v3Index);

    // V2: must have interrupted badge
    assert.ok(v2Html.includes('中途断过但有页面'), 'V2 index must display 中途断过但有页面');
    assert.ok(v2Html.includes('33 分 54 秒<span class="flag flag-warn"'), 'V2 08-taste-skill row must have warn flag');

    // V3: exited normally in 515s, must NOT have interrupted badge in card or row
    const v3Card08 = v3Html.slice(v3Html.indexOf('runs/08-taste-skill/detail.html'), v3Html.indexOf('runs/08-taste-skill/detail.html') + 500);
    assert.ok(!v3Card08.includes('中途断过'), 'V3 08-taste-skill card must NOT have interrupted badge');

    // Detail page
    const tasteDetail = fs.readFileSync(path.join(DIST, 'runs/08-taste-skill/detail.html'), 'utf8');
    assert.ok(tasteDetail.includes('中途断过但有页面'), '08 detail page V2 column must display 中途断过但有页面');
    assert.ok(tasteDetail.includes('无记录（会话中断）'), '08 detail page V2 column must record timeout interrupt');
  });

  // 5. Cleanliness and absence of leaked strings
  await t.test('5. Absence of leaked developer and placeholder strings', () => {
    function walk(dir) {
      let files = [];
      for (const item of fs.readdirSync(dir)) {
        const p = path.join(dir, item);
        if (fs.statSync(p).isDirectory()) files = files.concat(walk(p));
        else files.push(p);
      }
      return files;
    }

    const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html'));
    assert.ok(htmlFiles.length >= 11, 'Must have at least 11 HTML files in dist');

    for (const f of htmlFiles) {
      const c = fs.readFileSync(f, 'utf8');
      assert.ok(!c.includes('待 Chasen 填写'), `File ${f} must not leak "待 Chasen 填写"`);
      assert.ok(!c.includes('编辑 runs/') || !c.includes('即可更新'), `File ${f} must not leak editor instruction`);
    }

    // Site overview page specific checks
    const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    assert.ok(!indexHtml.includes('10 个设计 skill'), 'index.html must not contain "10 个设计 skill"');
    assert.ok(indexHtml.includes('9 个设计项目 + 1 个裸对照'), 'index.html must contain "9 个设计项目 + 1 个裸对照"');
    assert.ok(indexHtml.includes('各组耗时累计*'), 'index.html must contain "各组耗时累计*"');
    assert.ok(indexHtml.includes('整批实际经过时间'), 'index.html must contain "整批实际经过时间"');
    assert.ok(indexHtml.includes('未缓存输入 (input)'), 'index.html must contain "未缓存输入 (input)"');
    assert.ok(indexHtml.includes('缓存读取 (cacheRead)'), 'index.html must contain "缓存读取 (cacheRead)"');
  });

  // 6. Provenance 3-Tier Badges on all 10 detail pages
  await t.test('6. 3-tier provenance model presence on all 10 detail pages', () => {
    const ids = [
      '00-bare',
      '01-frontend-design',
      '02-ui-ux-pro-max',
      '03-baoyu-design',
      '04-oil-ui',
      '05-ai-design-skills',
      '06-huashu-design',
      '07-hallmark',
      '08-taste-skill',
      '09-awesome-design-md',
    ];

    for (const id of ids) {
      const detailFile = path.join(DIST, `runs/${id}/detail.html`);
      assert.ok(fs.existsSync(detailFile), `Detail file must exist: ${detailFile}`);
      const c = fs.readFileSync(detailFile, 'utf8');

      assert.ok(c.includes('badge-doc') && c.includes('作者文档描述'), `${id} detail page must have badge-doc`);
      assert.ok(c.includes('badge-observed') && c.includes('本次实测观察'), `${id} detail page must have badge-observed`);
      assert.ok(c.includes('badge-editorial') && c.includes('编辑建议'), `${id} detail page must have badge-editorial`);
    }
  });
});
