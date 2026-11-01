// tests/challenger-m1-adversarial.test.mjs
// Adversarial edge-case harness written by Challenger M1-2

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve('.');

test('Challenger M1-2: Central Data Schema & Edge Cases', async (t) => {
  const projectsModulePath = path.join(REPO_ROOT, 'site/data/projects.mjs');
  assert.ok(fs.existsSync(projectsModulePath), 'site/data/projects.mjs must exist');

  const { PROJECTS, PROJECT_BY_ID } = await import(`file://${projectsModulePath.replace(/\\/g, '/')}`);

  await t.test('Exports validation', () => {
    assert.ok(Array.isArray(PROJECTS), 'PROJECTS must be an array');
    assert.equal(PROJECTS.length, 10, 'PROJECTS must contain exactly 10 entries');
    assert.ok(PROJECT_BY_ID && typeof PROJECT_BY_ID === 'object', 'PROJECT_BY_ID must be an object');
    assert.equal(Object.keys(PROJECT_BY_ID).length, 10, 'PROJECT_BY_ID must index exactly 10 entries');
  });

  await t.test('Consistency between PROJECTS and PROJECT_BY_ID', () => {
    for (const p of PROJECTS) {
      assert.ok(p.id, `Project must have an id`);
      assert.strictEqual(PROJECT_BY_ID[p.id], p, `PROJECT_BY_ID[${p.id}] must match object in PROJECTS`);
    }
  });

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
    '09-awesome-design-md'
  ];

  await t.test('All 10 project IDs are exact and in canonical order', () => {
    const actualIds = PROJECTS.map(p => p.id);
    assert.deepEqual(actualIds, expectedIds, 'Project IDs must match canonical list in order');
  });

  const validTasks = ['portfolio', 'landing', 'admin', 'prototype', 'style-ref'];

  await t.test('Deep schema validation of all 10 projects', () => {
    for (const p of PROJECTS) {
      // Required strings and non-empty
      assert.ok(typeof p.name === 'string' && p.name.trim().length > 0, `${p.id} name must be non-empty string`);
      assert.ok(typeof p.tagline === 'string' && p.tagline.trim().length > 0, `${p.id} tagline must be non-empty string`);
      assert.ok(typeof p.bestFor === 'string' && p.bestFor.trim().length > 0, `${p.id} bestFor must be non-empty string`);
      assert.ok(typeof p.tradeoff === 'string' && p.tradeoff.trim().length > 0, `${p.id} tradeoff must be non-empty string`);
      assert.ok(typeof p.docPositioning === 'string' && p.docPositioning.trim().length > 0, `${p.id} docPositioning must be non-empty string`);
      assert.ok(typeof p.observedNote === 'string' && p.observedNote.trim().length > 0, `${p.id} observedNote must be non-empty string`);

      // Tasks array
      assert.ok(Array.isArray(p.tasks) && p.tasks.length > 0, `${p.id} tasks must be non-empty array`);
      for (const task of p.tasks) {
        assert.ok(validTasks.includes(task), `${p.id} task '${task}' must be one of ${validTasks.join(', ')}`);
      }

      // editorialStatus
      assert.ok(['confirmed', 'pending_review'].includes(p.editorialStatus), `${p.id} editorialStatus must be 'confirmed' or 'pending_review'`);

      // isSkill flag
      assert.strictEqual(typeof p.isSkill, 'boolean', `${p.id} isSkill must be boolean`);
      if (p.id === '00-bare' || p.id === '09-awesome-design-md') {
        assert.strictEqual(p.isSkill, false, `${p.id} must have isSkill = false`);
      } else {
        assert.strictEqual(p.isSkill, true, `${p.id} must have isSkill = true`);
      }

      // Extended provenance fields (structured objects)
      assert.ok(p.authorDoc && typeof p.authorDoc === 'object', `${p.id} authorDoc must be an object`);
      assert.ok(typeof p.authorDoc.description === 'string' && p.authorDoc.description.trim().length > 0, `${p.id} authorDoc.description must be non-empty string`);

      assert.ok(p.benchmarkObs && typeof p.benchmarkObs === 'object', `${p.id} benchmarkObs must be an object`);
      assert.ok(typeof p.benchmarkObs.strengths === 'string' && p.benchmarkObs.strengths.trim().length > 0, `${p.id} benchmarkObs.strengths must be non-empty string`);
      assert.ok(typeof p.benchmarkObs.weaknesses === 'string' && p.benchmarkObs.weaknesses.trim().length > 0, `${p.id} benchmarkObs.weaknesses must be non-empty string`);

      assert.ok(p.editorialAdvice && typeof p.editorialAdvice === 'object', `${p.id} editorialAdvice must be an object`);
      assert.ok(typeof p.editorialAdvice.recommendation === 'string' && p.editorialAdvice.recommendation.trim().length > 0, `${p.id} editorialAdvice.recommendation must be non-empty string`);
      assert.ok(['confirmed', 'pending_review'].includes(p.editorialAdvice.status), `${p.id} editorialAdvice.status must be confirmed or pending_review`);
    }
  });

  await t.test('zh.mjs localization dictionary coverage', async () => {
    const zhModulePath = path.join(REPO_ROOT, 'site/data/zh.mjs');
    assert.ok(fs.existsSync(zhModulePath), 'site/data/zh.mjs must exist');
    const zh = await import(`file://${zhModulePath.replace(/\\/g, '/')}`);

    assert.ok(zh.SKILL_LABEL, 'zh.SKILL_LABEL must exist');
    for (const id of expectedIds) {
      assert.ok(zh.SKILL_LABEL[id], `zh.SKILL_LABEL must contain label for ${id}`);
    }

    assert.ok(zh.TASK_LABELS, 'zh.TASK_LABELS must exist');
    for (const task of validTasks) {
      assert.ok(zh.TASK_LABELS[task], `zh.TASK_LABELS must contain label for ${task}`);
    }
    assert.ok(zh.TASK_LABELS['all'], 'zh.TASK_LABELS must contain label for all');

    assert.ok(zh.PROVENANCE_TAGS, 'zh.PROVENANCE_TAGS must exist');
    assert.ok(zh.PROVENANCE_TAGS.author_doc, 'author_doc tag label required');
    assert.ok(zh.PROVENANCE_TAGS.actual_obs, 'actual_obs tag label required');
    assert.ok(zh.PROVENANCE_TAGS.pending_review, 'pending_review tag label required');

    assert.ok(zh.METRIC_LABELS, 'zh.METRIC_LABELS must exist');
    assert.ok(zh.BENCHMARK_COPY, 'zh.BENCHMARK_COPY must exist');
  });

  await t.test('Distribution artifacts verification', () => {
    const distIndex = path.join(REPO_ROOT, 'site/dist/index.html');
    assert.ok(fs.existsSync(distIndex), 'site/dist/index.html must exist');
    const indexHtml = fs.readFileSync(distIndex, 'utf-8');

    // F05: No "10 个设计 skill", replaced by "9 个设计项目 + 1 个裸对照"
    assert.doesNotMatch(indexHtml, /10\s*个设计\s*skill/i, 'index.html must NOT contain "10 个设计 skill"');
    assert.match(indexHtml, /9\s*个设计项目\s*\+\s*1\s*个裸对照/, 'index.html must contain "9 个设计项目 + 1 个裸对照"');

    // F06: Cumulative duration clarification
    assert.match(indexHtml, /各组耗时累计\*/, 'index.html must label cumulative duration');
    assert.match(indexHtml, /并发/i, 'index.html must explain concurrency factor');

    // F08: 00-bare read_skill fix
    assert.match(indexHtml, /未安装\s*\/\s*不适用/, 'index.html must display "未安装 / 不适用" for 00-bare');

    // F09: Token separation
    assert.match(indexHtml, /未缓存输入\s*\(input\)/, 'index.html must label un-cached input');
    assert.match(indexHtml, /缓存读取\s*\(cacheRead\)/, 'index.html must label cacheRead');

    // F10: Taste skill interruption notice
    assert.match(indexHtml, /中途断过但有页面/, 'index.html must retain taste-skill warning badge');

    // F18: No maintenance text in public HTML
    assert.doesNotMatch(indexHtml, /编辑\s*runs\/.*?\/review\.md/i, 'index.html must not leak editor instructions');
    assert.doesNotMatch(indexHtml, /待\s*Chasen\s*填写/, 'index.html must not contain placeholder');

    // Check detail pages
    for (const id of expectedIds) {
      const detailFile = path.join(REPO_ROOT, `site/dist/runs/${id}/detail.html`);
      assert.ok(fs.existsSync(detailFile), `Detail file for ${id} must exist at ${detailFile}`);
      const detailHtml = fs.readFileSync(detailFile, 'utf-8');

      // Check 3-tier provenance
      assert.match(detailHtml, /作者文档描述/, `Detail page for ${id} must have author doc badge`);
      assert.match(detailHtml, /本次实测观察/, `Detail page for ${id} must have actual obs badge`);
      assert.match(detailHtml, /编辑建议/, `Detail page for ${id} must have editorial advice`);

      // Check no maintenance text
      assert.doesNotMatch(detailHtml, /编辑\s*runs\/.*?\/review\.md/i, `Detail page for ${id} must not leak editor text`);
      assert.doesNotMatch(detailHtml, /待\s*Chasen\s*填写/, `Detail page for ${id} must not contain placeholder`);
    }
  });
});
