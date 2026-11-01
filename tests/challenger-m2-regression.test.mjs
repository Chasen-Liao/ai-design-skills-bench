// tests/challenger-m2-regression.test.mjs
// Challenger M2-2 Empirical Regression & Output Verification Test Suite

import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PROJECTS } from '../site/data/projects.mjs';

const REPO_ROOT = resolve('.');
const DIST_INDEX = join(REPO_ROOT, 'site', 'dist', 'index.html');
const STYLE_CSS = join(REPO_ROOT, 'site', 'style.css');

describe('Challenger M2-2: Milestone 2 Output & Regression Verification', () => {
  const indexHtml = readFileSync(DIST_INDEX, 'utf-8');
  const styleCss = readFileSync(STYLE_CSS, 'utf-8');

  describe('1. Card Elements & Attribute Contract', () => {
    it('1.1 should have data-tasks on all card elements in both V2 and V3 panels', () => {
      const cardMatches = [...indexHtml.matchAll(/<article\s+class="card"[^>]*>/g)].map((m) => m[0]);
      assert.equal(cardMatches.length, 20, 'Expected exactly 20 cards (10 in V2, 10 in V3)');
      for (const cardOpen of cardMatches) {
        assert.match(cardOpen, /data-tasks="[^"]*"/, `Card must have data-tasks attribute: ${cardOpen}`);
      }
    });

    it('1.2 should have .card-tagline on all cards', () => {
      const taglines = [...indexHtml.matchAll(/<p class="card-tagline">[\s\S]*?<\/p>/g)];
      assert.equal(taglines.length, 20, 'Expected exactly 20 .card-tagline elements');
      for (const t of taglines) {
        assert.ok(t[0].length > 25, 'Tagline should not be empty');
      }
    });

    it('1.3 should have .card-metrics-secondary on all cards', () => {
      const metrics = [...indexHtml.matchAll(/<div class="card-metrics-secondary"[^>]*>[\s\S]*?<\/div>/g)];
      assert.equal(metrics.length, 20, 'Expected exactly 20 .card-metrics-secondary elements');
    });

    it('1.4 should check for .card-best-for and .card-tradeoff classes in card decision blocks', () => {
      const hasBestFor = indexHtml.includes('card-best-for');
      const hasTradeoff = indexHtml.includes('card-tradeoff');
      assert.ok(
        hasBestFor && hasTradeoff,
        `Index HTML cards must contain .card-best-for and .card-tradeoff classes (found hasBestFor=${hasBestFor}, hasTradeoff=${hasTradeoff})`,
      );
    });
  });

  describe('2. Milestone 1 Non-Regression Verification', () => {
    it('2.1 should not contain "10 个设计" anywhere in index.html (F05)', () => {
      assert.doesNotMatch(
        indexHtml,
        /10\s*个设计(?!项目)/,
        'No occurrences of "10 个设计" (should be "9 个设计项目 + 1 个裸对照")',
      );
    });

    it('2.2 should contain "9 个设计项目 + 1 个裸对照" across hero, eyebrows, and stats (F05)', () => {
      const occurrences = (indexHtml.match(/9\s*个设计项目\s*\+\s*1\s*个裸对照/g) || []).length;
      assert.ok(occurrences >= 5, `Expected at least 5 occurrences of 9+1 nomenclature, found ${occurrences}`);
    });

    it('2.3 should correct V3 00-bare read_skill to "未安装 / 不适用" (F08)', () => {
      const v3Section = indexHtml.match(/id="v3"[\s\S]*?(?:id="v2"|<\/main>)/i)?.[0] || '';
      assert.ok(v3Section.length > 0, 'V3 section must exist');
      // In table row for 00-bare
      const bareRowMatch = v3Section.match(/<th[^>]*class="col-id"[^>]*>[\s\S]*?00-bare[\s\S]*?<\/tr>/i);
      assert.ok(bareRowMatch, '00-bare row must exist in V3 table');
      assert.match(
        bareRowMatch[0],
        /未安装\s*\/\s*不适用/,
        '00-bare in V3 table must state "未安装 / 不适用"',
      );
      assert.doesNotMatch(
        bareRowMatch[0],
        /<td[^>]*>\s*是\s*<\/td>/,
        '00-bare in V3 must NOT state "是" for read_skill',
      );
    });

    it('2.4 should clarify duration cumulative sum across runs (F06)', () => {
      assert.match(indexHtml, /各组耗时累计\*/, 'Must include "各组耗时累计*" in stat labels');
      assert.match(indexHtml, /各跑次\s*duration\s*累加和/i, 'Must clarify duration is arithmetic sum across runs');
      assert.match(indexHtml, /不是整批实际经过时间/, 'Must clarify not batch wall-clock time');
    });

    it('2.5 should separate input and cacheRead token columns (F09)', () => {
      assert.match(indexHtml, /未缓存输入\s*\(input\)/, 'Must show input tokens column header');
      assert.match(indexHtml, /缓存读取\s*\(cacheRead\)/, 'Must show cacheRead tokens column header');
    });

    it('2.6 should retain 08-taste-skill warning badge (F10)', () => {
      assert.match(indexHtml, /中途断过但有页面/, 'Must retain taste-skill interruption badge');
    });
  });

  describe('3. Target M2 E2E Checks', () => {
    it('3.1 should have decision headline F01', () => {
      assert.match(indexHtml, /设计 Skill 怎么选？先看同题做出的页面/);
    });

    it('3.2 should have task filter container with 5 tasks + all (F02)', () => {
      const taskFilters = [...indexHtml.matchAll(/data-task-filter="([^"]+)"/g)].map((m) => m[1]);
      const expectedTasks = ['all', 'portfolio', 'landing', 'admin', 'prototype', 'style-ref'];
      assert.deepEqual(taskFilters, expectedTasks);
    });

    it('3.3 should have accessible ARIA on task tabs (F02, F22)', () => {
      assert.match(indexHtml, /role="tablist"/);
      assert.match(indexHtml, /role="tab"/);
      assert.match(indexHtml, /aria-selected="true"/);
      assert.match(indexHtml, /aria-label="使用任务分类筛选"/);
    });

    it('3.4 should have responsive media query ordering preventing stacking (Tier 2 2.3.3)', () => {
      assert.match(styleCss, /@media[^{]*(?:max-width:\s*(?:640|768|900)px)[^}]*(?:flex-direction:\s*column|grid-template-columns:\s*1fr|\.compare-split)/i);
    });
  });
});
