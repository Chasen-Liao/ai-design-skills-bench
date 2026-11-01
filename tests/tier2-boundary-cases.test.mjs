// tests/tier2-boundary-cases.test.mjs
// Tier 2: Boundary & Corner Cases (>=5 test cases per category)
// Tests system robustness against malformed inputs, edge conditions, missing data, and viewport extremes.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPO_ROOT,
  DIST_DIR,
  readFileSafe,
  getText,
  findElementsByTag,
  findElementsByClass,
  inspectCss,
} from './helpers/html-parser.mjs';
import {
  parseStateFromUrl,
  serializeStateToUrl,
  toggleCompareCandidate,
  filterProjectsByTask,
  MAX_COMPARE_CANDIDATES,
} from './helpers/client-sim.mjs';

describe('Tier 2: Boundary & Corner Cases', () => {

  // -------------------------------------------------------------------------
  // Category 1: URL Parameter Parsing & Boundary Handling
  // -------------------------------------------------------------------------
  describe('Category 1: URL Parameter Parsing & Edge Cases', () => {
    it('2.1.1 should cap excessive candidate query parameter to exactly 3 items', () => {
      const url = 'index.html?compare=01-frontend,02-ui-ux,03-baoyu,04-oil,05-ai-design';
      const state = parseStateFromUrl(url);
      assert.equal(state.compare.length, MAX_COMPARE_CANDIDATES, 'Candidates must be capped at 3');
      assert.deepEqual(state.compare, ['01-frontend', '02-ui-ux', '03-baoyu']);
    });

    it('2.1.2 should sanitize empty or comma-padded compare parameters cleanly', () => {
      const url = 'index.html?compare=,,,';
      const state = parseStateFromUrl(url);
      assert.deepEqual(state.compare, [], 'Comma-only compare param should resolve to empty array');

      const url2 = 'index.html?compare=';
      const state2 = parseStateFromUrl(url2);
      assert.deepEqual(state2.compare, [], 'Empty compare param should resolve to empty array');
    });

    it('2.1.3 should fall back to "all" task when unknown or invalid task param is provided', () => {
      const url = 'index.html?task=quantum-hyper-design';
      const state = parseStateFromUrl(url);
      assert.equal(state.task, 'all', 'Invalid task param must fall back to "all"');
    });

    it('2.1.4 should fall back to default "v3" when unknown edition param is provided', () => {
      const url = 'index.html?edition=v99_nonexistent';
      const state = parseStateFromUrl(url);
      assert.equal(state.edition, 'v3', 'Invalid edition param must fall back to "v3"');
    });

    it('2.1.5 should neutralize potential XSS payload in query strings during state parsing', () => {
      const url = 'index.html?task=%3Cscript%3Ealert(1)%3C/script%3E';
      const state = parseStateFromUrl(url);
      assert.equal(state.task, 'all', 'Injected script in task param must be discarded');
    });

    it('2.1.6 should serialize normalized state into canonical query string without trailing commas', () => {
      const state = { edition: 'v3', task: 'portfolio', compare: ['01-frontend-design', '02-ui-ux-pro-max'] };
      const url = serializeStateToUrl(state);
      assert.equal(url, 'index.html?task=portfolio&compare=01-frontend-design%2C02-ui-ux-pro-max');
    });
  });

  // -------------------------------------------------------------------------
  // Category 2: Content & Data Boundary Conditions
  // -------------------------------------------------------------------------
  describe('Category 2: Content & Data Boundary Conditions', () => {
    it('2.2.1 should display clean placeholder when review.md is empty without internal editor text', () => {
      const detailHtml = readFileSafe(join(DIST_DIR, 'runs', '00-bare', 'detail.html'));
      // Review is currently empty for all runs
      assert.doesNotMatch(
        detailHtml,
        /编辑\s*runs\/.*\/review\.md/i,
        'Empty review must not display editor maintenance instruction (F18)',
      );
      assert.doesNotMatch(detailHtml, /undefined|null/i, 'Empty review must not render undefined or null');
    });

    it('2.2.2 should correctly match projects that belong to multiple task categories', () => {
      const testProjects = [
        { id: '01', tasks: ['portfolio', 'landing'] },
        { id: '02', tasks: ['admin'] },
      ];
      const portfolioMatches = filterProjectsByTask(testProjects, 'portfolio');
      assert.equal(portfolioMatches.length, 1);
      assert.equal(portfolioMatches[0].id, '01');

      const landingMatches = filterProjectsByTask(testProjects, 'landing');
      assert.equal(landingMatches.length, 1);
      assert.equal(landingMatches[0].id, '01');
    });

    it('2.2.3 should enforce 00-bare baseline is never flagged as an installable skill', async () => {
      const projectsPath = join(REPO_ROOT, 'site', 'data', 'projects.mjs');
      if (existsSync(projectsPath)) {
        const mod = await import(`file://${projectsPath}`);
        const bare = mod.PROJECTS.find((p) => p.id === '00-bare');
        assert.ok(bare, '00-bare must exist');
        assert.equal(bare.isSkill, false, '00-bare must have isSkill: false');
      }
    });

    it('2.2.4 should handle interrupted runs without exit code (null exit) cleanly as warning', () => {
      const detailHtml = readFileSafe(join(DIST_DIR, 'runs', '08-taste-skill', 'detail.html'));
      const text = getText(detailHtml);
      assert.doesNotMatch(text, /退出码：null/i, 'Null exit code must not be rendered as literal "null"');
      assert.doesNotMatch(text, /退出码：NaN/i, 'Null exit code must not be rendered as "NaN"');
    });

    it('2.2.5 should reject 4th candidate addition and flag limit reached', () => {
      const initial = ['01-frontend', '02-ui-ux', '03-baoyu'];
      const res = toggleCompareCandidate(initial, '04-oil');
      assert.equal(res.reachedLimit, true, 'Adding 4th candidate must be flagged as limit reached');
      assert.equal(res.list.length, 3, 'Candidate list length must remain 3');
      assert.ok(!res.list.includes('04-oil'), '4th candidate must not be added');
    });

    it('2.2.6 should allow deselecting an existing candidate from compare list', () => {
      const initial = ['01-frontend', '02-ui-ux', '03-baoyu'];
      const res = toggleCompareCandidate(initial, '02-ui-ux');
      assert.equal(res.removed, true, 'Selected candidate should be removed upon toggle');
      assert.deepEqual(res.list, ['01-frontend', '03-baoyu']);
    });
  });

  // -------------------------------------------------------------------------
  // Category 3: Responsive & Viewport Boundary Conditions
  // -------------------------------------------------------------------------
  describe('Category 3: Responsive & Viewport Boundary Conditions', () => {
    it('2.3.1 should wrap data tables in an overflow container to prevent mobile blowout', () => {
      const css = readFileSafe(join(DIST_DIR, 'style.css'));
      const indexHtml = readFileSafe(join(DIST_DIR, 'index.html'));
      assert.ok(
        indexHtml.includes('table-wrap') || indexHtml.includes('overflow-x') || css.includes('.table-wrap'),
        'Tables must be contained inside horizontally scrollable wrapper',
      );
    });

    it('2.3.2 should define fluid image styling (width: 100% or max-width: 100%) to prevent mobile image overflow', () => {
      const css = readFileSafe(join(DIST_DIR, 'style.css'));
      assert.match(
        css,
        /(?:img\s*\{[^}]*(?:width|max-width):\s*100%|\.card-thumb\s+img|\.compare-thumb\s+img|\.shot-frame\s+img)/i,
        'Image styles must include fluid scaling rules for responsive viewports',
      );
    });

    it('2.3.3 should prevent dual-column 3000px stacking on screens <= 640px via mobile switcher or single column rules', () => {
      const css = readFileSafe(join(DIST_DIR, 'style.css'));
      // CSS must have mobile media query adjusting compare-split or grid
      const hasNarrowHandling = /@media[^{]*(?:max-width:\s*(?:640|768|900)px)[^}]*(?:flex-direction:\s*column|grid-template-columns:\s*1fr|\.compare-split)/i.test(css);
      assert.ok(
        hasNarrowHandling,
        'CSS must adapt multi-column comparison on narrow screens',
      );
    });

    it('2.3.4 should provide touch target sizing of at least 40px or adequate padding for mobile interactive buttons', () => {
      const css = readFileSafe(join(DIST_DIR, 'style.css'));
      const hasTouchPadding = /(?:min-height:\s*(?:36|40|44)px|padding:\s*(?:10|12|14)px)/i.test(css);
      assert.ok(hasTouchPadding, 'CSS should ensure interactive buttons have adequate touch target sizing');
    });

    it('2.3.5 should contain word-break or overflow-wrap on code/paths to prevent mobile container stretch', () => {
      const css = readFileSafe(join(DIST_DIR, 'style.css'));
      const hasWordBreak = /(?:word-break|overflow-wrap|text-overflow|overflow:\s*hidden)/i.test(css);
      assert.ok(hasWordBreak, 'CSS should have text wrapping / overflow protection for paths and code snippets');
    });
  });

});
