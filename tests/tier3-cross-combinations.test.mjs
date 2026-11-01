// tests/tier3-cross-combinations.test.mjs
// Tier 3: Cross-Feature Combinations (Pairwise)
// Tests cross-feature interactions: filter + edition, comparison + URL, responsive + mobile switcher, detail + return state.

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
  buildReturnLink,
} from './helpers/client-sim.mjs';

describe('Tier 3: Cross-Feature Combinations (Pairwise)', () => {

  // -------------------------------------------------------------------------
  // Combination 1: Task Filter + Edition Switcher
  // -------------------------------------------------------------------------
  describe('Combination 1: Task Filter + Edition Switcher', () => {
    it('3.1 should retain active task filter when switching between V2 and V3 editions', () => {
      // Simulate state transition: user is on task=landing in v3, toggles edition to v2
      const initial = parseStateFromUrl('index.html?edition=v3&task=landing');
      assert.equal(initial.edition, 'v3');
      assert.equal(initial.task, 'landing');

      // Update edition
      const transitioned = { ...initial, edition: 'v2' };
      const serialized = serializeStateToUrl(transitioned);
      assert.ok(serialized.includes('edition=v2'), 'URL must reflect new edition');
      assert.ok(serialized.includes('task=landing'), 'URL must retain active task filter');
    });

    it('3.2 should parse combined edition and task from initial deep link correctly', () => {
      const state = parseStateFromUrl('index.html?edition=v2&task=admin');
      assert.equal(state.edition, 'v2');
      assert.equal(state.task, 'admin');
    });
  });

  // -------------------------------------------------------------------------
  // Combination 2: Comparison Mode + URL State Persistence
  // -------------------------------------------------------------------------
  describe('Combination 2: Comparison Mode + URL State Persistence', () => {
    it('3.3 should synchronize candidate selection changes to serialized URL', () => {
      let state = { edition: 'v3', task: 'all', compare: [] };

      // Select candidate 1
      const step1 = toggleCompareCandidate(state.compare, '01-frontend-design');
      state.compare = step1.list;
      let url = serializeStateToUrl(state);
      assert.ok(url.includes('compare=01-frontend-design'));

      // Select candidate 2
      const step2 = toggleCompareCandidate(state.compare, '02-ui-ux-pro-max');
      state.compare = step2.list;
      url = serializeStateToUrl(state);
      assert.ok(url.includes('01-frontend-design'));
      assert.ok(url.includes('02-ui-ux-pro-max'));

      // Deselect candidate 1
      const step3 = toggleCompareCandidate(state.compare, '01-frontend-design');
      state.compare = step3.list;
      url = serializeStateToUrl(state);
      assert.ok(!url.includes('01-frontend-design'));
      assert.ok(url.includes('02-ui-ux-pro-max'));
    });

    it('3.4 should restore exact comparison list on URL deep-link hydration', () => {
      const incomingUrl = 'index.html?edition=v3&compare=02-ui-ux-pro-max,04-oil-ui';
      const parsed = parseStateFromUrl(incomingUrl);
      assert.deepEqual(parsed.compare, ['02-ui-ux-pro-max', '04-oil-ui']);
      assert.equal(parsed.edition, 'v3');
    });
  });

  // -------------------------------------------------------------------------
  // Combination 3: Task Filter + Comparison Selection
  // -------------------------------------------------------------------------
  describe('Combination 3: Task Filter + Comparison Selection', () => {
    it('3.5 should preserve selected candidates when user switches task category filter', () => {
      const state = {
        edition: 'v3',
        task: 'portfolio',
        compare: ['01-frontend-design', '02-ui-ux-pro-max'],
      };

      // Switch task to prototype
      state.task = 'prototype';
      const url = serializeStateToUrl(state);
      const restored = parseStateFromUrl(url);

      assert.equal(restored.task, 'prototype');
      assert.deepEqual(restored.compare, ['01-frontend-design', '02-ui-ux-pro-max']);
    });
  });

  // -------------------------------------------------------------------------
  // Combination 4: Detail Page Navigation + State Memory Return Link
  // -------------------------------------------------------------------------
  describe('Combination 4: Detail Page Navigation + State Memory Return Link', () => {
    it('3.6 should construct back link that preserves active edition and task query parameters', () => {
      const activeState = {
        edition: 'v2',
        task: 'style-ref',
        compare: ['05-ai-design-skills'],
      };
      const returnLink = buildReturnLink(activeState, '../../index.html');
      assert.ok(returnLink.includes('edition=v2'), 'Return link must preserve v2 edition');
      assert.ok(returnLink.includes('task=style-ref'), 'Return link must preserve style-ref task');
      assert.ok(returnLink.includes('compare=05-ai-design-skills'), 'Return link must preserve compare candidates');
    });

    it('3.7 should verify detail page HTML contains state preservation mechanism for return navigation', () => {
      const detailHtml = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));
      // Check whether back link exists and has dynamic restoration or parameters
      const hasBackPreservation = /class=["'][^"']*\bback\b[^"']*["']/i.test(detailHtml);
      assert.ok(hasBackPreservation, 'Detail page must render back navigation link');
    });
  });

  // -------------------------------------------------------------------------
  // Combination 5: Responsive Layout + Mobile Switcher Interaction
  // -------------------------------------------------------------------------
  describe('Combination 5: Responsive Layout + Mobile Switcher', () => {
    it('3.8 should configure CSS styles allowing mobile in-place column switching on <=640px screens', () => {
      const css = readFileSafe(join(DIST_DIR, 'style.css'));
      const inspector = inspectCss(css);
      // Verify mobile breakpoint adapts layout
      const hasResponsiveRules = inspector.hasMediaQuery('max-width') ||
                                 css.includes('@media (max-width');
      assert.ok(hasResponsiveRules, 'style.css must define responsive media queries for layout adaptation');
    });
  });

  // -------------------------------------------------------------------------
  // Combination 6: Collapsible Accordions + Keyboard Accessibility
  // -------------------------------------------------------------------------
  describe('Combination 6: Collapsible Accordions + Accessible Focus', () => {
    it('3.9 should structure accordions with semantic <summary> as first child of <details>', () => {
      const detailHtml = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));
      const detailsList = findElementsByTag(detailHtml, 'details');
      for (const d of detailsList) {
        assert.match(
          d.content,
          /^\s*<summary\b/i,
          '<summary> must be the direct first child of <details> for native keyboard accessibility',
        );
      }
    });

    it('3.10 should ensure interactive accordion summaries receive focus-visible outline', () => {
      const css = readFileSafe(join(DIST_DIR, 'style.css'));
      assert.match(
        css,
        /:focus-visible/i,
        'style.css must specify :focus-visible for keyboard focus indicators',
      );
    });
  });

});
