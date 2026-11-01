// tests/challenger-m2-edge-cases.test.mjs
// Adversarial Edge-Case Stress Testing for Task Filtering & URL Query State

import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PROJECTS } from '../site/data/projects.mjs';

const REPO_ROOT = resolve('.');
const DIST_INDEX = join(REPO_ROOT, 'site', 'dist', 'index.html');

describe('Milenger M2-4: Task Filtering & URL Query Edge Cases Adversarial Suite', () => {
  const indexHtml = readFileSync(DIST_INDEX, 'utf-8');

  // Extract client script from site/dist/index.html
  const scriptMatch = indexHtml.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'Client script must exist in site/dist/index.html');
  const clientScript = scriptMatch[1];

  describe('1. Parsing rawTasks String Splitting Edge Cases', () => {
    // The exact card task parser used in site/dist/index.html:
    // rawTasks.split(',').map(function (t) { return t.trim().toLowerCase(); })
    function parseCardTasks(rawTasks) {
      if (rawTasks == null) rawTasks = '';
      return rawTasks
        .split(',')
        .map((t) => t.trim().toLowerCase());
    }

    it('1.1 handles empty strings gracefully without crashing or false-positive matching', () => {
      const cardTasks1 = parseCardTasks('');
      assert.deepEqual(cardTasks1, ['']);
      assert.equal(cardTasks1.indexOf('portfolio') !== -1, false);
      assert.equal(cardTasks1.indexOf('style-ref') !== -1, false);

      const cardTasksNull = parseCardTasks(null);
      assert.deepEqual(cardTasksNull, ['']);
      assert.equal(cardTasksNull.indexOf('portfolio') !== -1, false);
    });

    it('1.2 handles multiple consecutive and trailing/leading commas', () => {
      const cardTasks = parseCardTasks(',,,portfolio,,,landing,,,');
      assert.deepEqual(cardTasks, ['', '', '', 'portfolio', '', '', 'landing', '', '', '']);
      // Should match portfolio and landing
      assert.equal(cardTasks.indexOf('portfolio') !== -1, true);
      assert.equal(cardTasks.indexOf('landing') !== -1, true);
      // Should NOT match other tasks
      assert.equal(cardTasks.indexOf('admin') !== -1, false);
      assert.equal(cardTasks.indexOf('prototype') !== -1, false);
      assert.equal(cardTasks.indexOf('style-ref') !== -1, false);
    });

    it('1.3 handles leading/trailing whitespace, tabs, and newlines in task tokens', () => {
      const raw = '   portfolio  ,\t\nstyle-ref\r\n ,  landing   ';
      const cardTasks = parseCardTasks(raw);
      assert.deepEqual(cardTasks, ['portfolio', 'style-ref', 'landing']);
      assert.equal(cardTasks.indexOf('portfolio') !== -1, true);
      assert.equal(cardTasks.indexOf('style-ref') !== -1, true);
      assert.equal(cardTasks.indexOf('landing') !== -1, true);
      assert.equal(cardTasks.indexOf('admin') !== -1, false);
    });

    it('1.4 normalizes mixed-case and uppercase tasks', () => {
      const raw = 'PORTFOLIO, Style-Ref, LaNdInG';
      const cardTasks = parseCardTasks(raw);
      assert.deepEqual(cardTasks, ['portfolio', 'style-ref', 'landing']);
      assert.equal(cardTasks.indexOf('portfolio') !== -1, true);
      assert.equal(cardTasks.indexOf('style-ref') !== -1, true);
      assert.equal(cardTasks.indexOf('landing') !== -1, true);
    });
  });

  describe('2. URL Query and Hash Parsing Edge Cases (parseUrlState Simulation)', () => {
    // Simulator replicating parseUrlState from site/dist/index.html
    function simulateParseUrlState(search, hash) {
      const VALID_TASKS = ['all', 'portfolio', 'landing', 'admin', 'prototype', 'style-ref'];
      const VALID_EDITIONS = ['v3', 'v2'];
      const MAX_COMPARE_CANDIDATES = 3;

      const queryParams = new URLSearchParams(search || '');
      let edition = 'v3';
      let task = 'all';
      let compare = [];

      if (queryParams.has('edition')) {
        const ed = (queryParams.get('edition') || '').toLowerCase();
        if (VALID_EDITIONS.indexOf(ed) !== -1) {
          edition = ed;
        }
      } else if (VALID_EDITIONS.indexOf((hash || '').replace(/^#/, '').toLowerCase()) !== -1) {
        edition = (hash || '').replace(/^#/, '').toLowerCase();
      }

      if (queryParams.has('task')) {
        const t = (queryParams.get('task') || '').toLowerCase();
        if (VALID_TASKS.indexOf(t) !== -1) {
          task = t;
        } else {
          task = 'all';
        }
      } else if (hash) {
        const cleanHash = hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(cleanHash);
        if (hashParams.has('task')) {
          const ht = (hashParams.get('task') || '').toLowerCase();
          if (VALID_TASKS.indexOf(ht) !== -1) task = ht;
        } else if (VALID_TASKS.indexOf(cleanHash.toLowerCase()) !== -1) {
          task = cleanHash.toLowerCase();
        }
      }

      if (queryParams.has('compare')) {
        const raw = queryParams.get('compare') || '';
        compare = raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, MAX_COMPARE_CANDIDATES);
      }

      return { edition, task, compare };
    }

    it('2.1 ?task=nonexistent safely defaults task to "all"', () => {
      const state = simulateParseUrlState('?task=nonexistent', '');
      assert.equal(state.task, 'all');
      assert.equal(state.edition, 'v3');
    });

    it('2.2 ?task= (empty string) safely defaults task to "all"', () => {
      const state = simulateParseUrlState('?task=', '');
      assert.equal(state.task, 'all');
    });

    it('2.3 ?task=   (whitespace only) safely defaults task to "all"', () => {
      const state = simulateParseUrlState('?task=%20%20%20', '');
      assert.equal(state.task, 'all');
    });

    it('2.4 ?task=portfolio,landing (multi-value) safely defaults task to "all"', () => {
      const state = simulateParseUrlState('?task=portfolio,landing', '');
      assert.equal(state.task, 'all');
    });

    it('2.5 ?task=STYLE-REF (uppercase valid task) normalizes to lowercase "style-ref"', () => {
      const state = simulateParseUrlState('?task=STYLE-REF', '');
      assert.equal(state.task, 'style-ref');
    });

    it('2.6 combined query parameters: ?task=nonexistent&edition=v2', () => {
      const state = simulateParseUrlState('?task=nonexistent&edition=v2', '');
      assert.equal(state.task, 'all');
      assert.equal(state.edition, 'v2');
    });

    it('2.7 hash fallback: #task=nonexistent defaults to "all"', () => {
      const state = simulateParseUrlState('', '#task=nonexistent');
      assert.equal(state.task, 'all');
    });

    it('2.8 hash fallback: #style-ref resolves to "style-ref"', () => {
      const state = simulateParseUrlState('', '#style-ref');
      assert.equal(state.task, 'style-ref');
    });
  });

  describe('3. Empirical Execution of applyTaskFilter across all cards', () => {
    // Replicate DOM card filtering logic exactly as executed in client script
    function filterCards(cards, taskId) {
      let visibleCount = 0;
      const results = [];

      for (const card of cards) {
        const rawTasks = card.rawTasks || '';
        const cardTasks = rawTasks
          .split(',')
          .map((t) => t.trim().toLowerCase());

        const isMatch = taskId === 'all' || cardTasks.indexOf(taskId) !== -1;
        if (isMatch) {
          visibleCount++;
          results.push(card.id);
        }
      }

      return { visibleCount, results };
    }

    // Parse actual cards from index.html for V3
    const v3Match = indexHtml.match(/id="v3"[\s\S]*?(?:id="v2"|<\/main>)/i);
    assert.ok(v3Match, 'V3 section must exist');
    const v3Cards = [...v3Match[0].matchAll(/<article\s+class="card"[^>]*data-project-id="([^"]+)"[^>]*data-tasks="([^"]*)"/g)]
      .map((m) => ({ id: m[1], rawTasks: m[2] }));

    it('3.1 taskId = "all" shows all 10 cards', () => {
      const { visibleCount, results } = filterCards(v3Cards, 'all');
      assert.equal(visibleCount, 10);
      assert.equal(results.length, 10);
    });

    it('3.2 taskId = "nonexistent" matches 0 cards and activates empty state condition', () => {
      const { visibleCount, results } = filterCards(v3Cards, 'nonexistent');
      assert.equal(visibleCount, 0);
      assert.equal(results.length, 0);
    });

    it('3.3 taskId = "" matches 0 cards', () => {
      const { visibleCount, results } = filterCards(v3Cards, '');
      assert.equal(visibleCount, 0);
    });

    it('3.4 style-ref matches exactly 3 projects in V3', () => {
      const { visibleCount, results } = filterCards(v3Cards, 'style-ref');
      assert.equal(visibleCount, 3);
      assert.deepEqual(results, ['02-ui-ux-pro-max', '04-oil-ui', '09-awesome-design-md']);
    });

    it('3.5 all 5 canonical tasks have non-zero matching card sets in V3', () => {
      const canonicalTasks = ['portfolio', 'landing', 'admin', 'prototype', 'style-ref'];
      for (const t of canonicalTasks) {
        const { visibleCount, results } = filterCards(v3Cards, t);
        assert.ok(visibleCount > 0, `Task "${t}" must match at least 1 card in V3, but matched 0`);
      }
    });

    it('3.6 empty state elements exist in both V2 and V3 panels in the real HTML', () => {
      assert.match(indexHtml, /id="v3"[\s\S]*?class="[^"]*task-empty-state[^"]*"/i);
      assert.match(indexHtml, /id="v2"[\s\S]*?class="[^"]*task-empty-state[^"]*"/i);
    });
  });

  describe('4. Live Region & Accessibility Feedback', () => {
    it('4.1 task-filter-live aria-live region exists in index.html', () => {
      assert.match(indexHtml, /id="task-filter-live"[^>]*aria-live="polite"/);
    });

    it('4.2 TASK_NAMES lookup covers all 5 tasks + all', () => {
      assert.match(indexHtml, /all:\s*'全部任务'/);
      assert.match(indexHtml, /portfolio:\s*'个人站\/作品集'/);
      assert.match(indexHtml, /landing:\s*'营销落地页'/);
      assert.match(indexHtml, /admin:\s*'后台与产品界面'/);
      assert.match(indexHtml, /prototype:\s*'原型与演示'/);
      assert.match(indexHtml, /'style-ref':\s*'已有风格参考'/);
    });
  });
});
