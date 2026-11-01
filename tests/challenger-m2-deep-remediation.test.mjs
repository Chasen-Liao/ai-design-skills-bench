// tests/challenger-m2-deep-remediation.test.mjs
// Challenger M2-3 Deep Empirical Re-Verification & Stress Test Suite

import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PROJECTS, PROJECT_BY_ID } from '../site/data/projects.mjs';

const REPO_ROOT = resolve('.');
const DIST_INDEX = join(REPO_ROOT, 'site', 'dist', 'index.html');
const SRC_STYLE = join(REPO_ROOT, 'site', 'style.css');
const DIST_STYLE = join(REPO_ROOT, 'site', 'dist', 'style.css');

describe('Challenger M2-3: Deep Remediation Re-Verification & Adversarial Stress Tests', () => {
  const indexHtml = readFileSync(DIST_INDEX, 'utf-8');
  const srcStyleCss = readFileSync(SRC_STYLE, 'utf-8');
  const distStyleCss = readFileSync(DIST_STYLE, 'utf-8');

  describe('1. Exhaustive Card Decision Items Verification (20 Cards)', () => {
    // Split into V2 and V3 sections
    const v2Match = indexHtml.match(/id="v2"[\s\S]*?(?:id="v3"|<\/main>)/i);
    const v3Match = indexHtml.match(/id="v3"[\s\S]*?(?:id="v2"|<\/main>)/i);

    it('1.1 should have distinct V2 and V3 sections', () => {
      assert.ok(v2Match, 'V2 section must exist in index.html');
      assert.ok(v3Match, 'V3 section must exist in index.html');
    });

    const v2Cards = [...(v2Match?.[0] || '').matchAll(/<article\s+class="card"[^>]*>([\s\S]*?)<\/article>/g)];
    const v3Cards = [...(v3Match?.[0] || '').matchAll(/<article\s+class="card"[^>]*>([\s\S]*?)<\/article>/g)];

    it('1.2 should have exactly 10 cards in V2 and 10 cards in V3', () => {
      assert.equal(v2Cards.length, 10, 'Expected exactly 10 cards in V2');
      assert.equal(v3Cards.length, 10, 'Expected exactly 10 cards in V3');
    });

    it('1.3 should have .card-best-for and .card-tradeoff in EVERY card in V2', () => {
      for (const [idx, card] of v2Cards.entries()) {
        const cardBody = card[1];
        assert.match(
          cardBody,
          /<div class="card-decision-item card-best-for">/,
          `V2 card #${idx} must contain <div class="card-decision-item card-best-for">`,
        );
        assert.match(
          cardBody,
          /<div class="card-decision-item card-tradeoff">/,
          `V2 card #${idx} must contain <div class="card-decision-item card-tradeoff">`,
        );
        assert.match(
          cardBody,
          /<span class="badge badge-editorial">优先推荐<\/span>/,
          `V2 card #${idx} must contain badge-editorial for 优先推荐`,
        );
        assert.match(
          cardBody,
          /<span class="badge badge-observed">主要取舍<\/span>/,
          `V2 card #${idx} must contain badge-observed for 主要取舍`,
        );
      }
    });

    it('1.4 should have .card-best-for and .card-tradeoff in EVERY card in V3', () => {
      for (const [idx, card] of v3Cards.entries()) {
        const cardBody = card[1];
        assert.match(
          cardBody,
          /<div class="card-decision-item card-best-for">/,
          `V3 card #${idx} must contain <div class="card-decision-item card-best-for">`,
        );
        assert.match(
          cardBody,
          /<div class="card-decision-item card-tradeoff">/,
          `V3 card #${idx} must contain <div class="card-decision-item card-tradeoff">`,
        );
        assert.match(
          cardBody,
          /<span class="badge badge-editorial">优先推荐<\/span>/,
          `V3 card #${idx} must contain badge-editorial for 优先推荐`,
        );
        assert.match(
          cardBody,
          /<span class="badge badge-observed">主要取舍<\/span>/,
          `V3 card #${idx} must contain badge-observed for 主要取舍`,
        );
      }
    });

    it('1.5 should verify decision text is non-empty and non-placeholder on all cards', () => {
      const allCards = [...v2Cards, ...v3Cards];
      for (const card of allCards) {
        const bestForMatch = card[1].match(/<div class="card-decision-item card-best-for">[\s\S]*?<span class="card-decision-text">([^<]+)<\/span>/);
        const tradeoffMatch = card[1].match(/<div class="card-decision-item card-tradeoff">[\s\S]*?<span class="card-decision-text">([^<]+)<\/span>/);
        assert.ok(bestForMatch, 'Must find card-decision-text in card-best-for');
        assert.ok(tradeoffMatch, 'Must find card-decision-text in card-tradeoff');
        const bestForText = bestForMatch[1].trim();
        const tradeoffText = tradeoffMatch[1].trim();
        assert.ok(bestForText.length > 5, `bestFor text must be substantive: "${bestForText}"`);
        assert.ok(tradeoffText.length > 5, `tradeoff text must be substantive: "${tradeoffText}"`);
        assert.doesNotMatch(bestForText, /undefined|null|TBD|待填/, 'No placeholder text in bestFor');
        assert.doesNotMatch(tradeoffText, /undefined|null|TBD|待填/, 'No placeholder text in tradeoff');
      }
    });
  });

  describe('2. Secondary Execution Metrics (.card-metrics-secondary) Contract', () => {
    it('2.1 should verify exactly 20 instances of .card-metrics-secondary', () => {
      const secondaryMatches = [...indexHtml.matchAll(/<div class="card-metrics-secondary"[^>]*>([\s\S]*?)<\/div>/g)];
      assert.equal(secondaryMatches.length, 20, 'Expected exactly 20 .card-metrics-secondary elements');

      for (const [idx, m] of secondaryMatches.entries()) {
        const content = m[1];
        // Must contain 3 metric-item spans
        const metricItems = [...content.matchAll(/<span class="metric-item">([\s\S]*?)<\/span>/g)];
        assert.equal(metricItems.length, 3, `Card #${idx} must have 3 metric items (duration, llm, tool)`);

        // Must contain 2 metric-sep spans
        const separators = [...content.matchAll(/<span class="metric-sep">·<\/span>/g)];
        assert.equal(separators.length, 2, `Card #${idx} must have 2 bullet separators`);

        // Verify no NaN or undefined in metric values
        assert.doesNotMatch(content, /NaN|undefined|null/i, `Card #${idx} must not contain NaN/undefined in metrics`);

        // Verify duration format: 耗时 <strong>...</strong>
        assert.match(metricItems[0][1], /耗时\s*<strong>(?:\d+\s*分\s*\d+\s*秒|\d+\s*秒)<\/strong>/, 'Duration formatted properly');
        // Verify LLM calls format: LLM <strong>...</strong>
        assert.match(metricItems[1][1], /LLM\s*<strong>\d+<\/strong>/, 'LLM calls formatted properly');
        // Verify tool calls format: 工具 <strong>...</strong>
        assert.match(metricItems[2][1], /工具\s*<strong>\d+<\/strong>/, 'Tool calls formatted properly');
      }
    });
  });

  describe('3. CSS Architecture & Layout Verification', () => {
    it('3.1 should confirm site/dist/style.css matches site/style.css', () => {
      assert.equal(srcStyleCss, distStyleCss, 'Distribution style.css must be identical to source style.css');
    });

    it('3.2 should confirm .card-metrics-secondary is decoupled from .card-metrics CSS grid', () => {
      // Must not match .card-metrics-secondary,\s*.card-metrics\s*\{\s*display:\s*grid
      assert.doesNotMatch(
        srcStyleCss,
        /\.card-metrics-secondary\s*,\s*\.card-metrics\s*\{[^}]*display:\s*grid/s,
        '.card-metrics-secondary must not share display: grid with .card-metrics',
      );
    });

    it('3.3 should confirm .card-metrics-secondary has flexbox rules', () => {
      // Should have display: inline-flex or flex
      assert.match(
        srcStyleCss,
        /\.card-metrics-secondary\s*\{[^}]*display:\s*inline-flex[^}]*flex-wrap:\s*wrap/s,
        '.card-metrics-secondary must be styled with inline-flex and flex-wrap: wrap',
      );
    });

    it('3.4 should confirm styling rules for .card-best-for and .card-tradeoff', () => {
      assert.match(
        srcStyleCss,
        /\.card-best-for[^{]*\{[^}]*border-left:\s*3px solid var\(--accent\)/s,
        '.card-best-for must have border-left with --accent',
      );
      assert.match(
        srcStyleCss,
        /\.card-tradeoff[^{]*\{[^}]*border-left:\s*3px solid var\(--border-strong\)/s,
        '.card-tradeoff must have border-left with --border-strong',
      );
    });

    it('3.5 should confirm mobile overrides for card decision and secondary metrics', () => {
      // Under @media (max-width: 640px)
      const mobileMediaMatch = srcStyleCss.match(/@media\s*\(\s*max-width:\s*640px\s*\)\s*\{([\s\S]*?)\n\}/);
      assert.ok(mobileMediaMatch, 'Mobile media query (max-width: 640px) must exist');
      const mobileBody = mobileMediaMatch[1];
      assert.match(mobileBody, /\.card-best-for,\s*\.card-tradeoff\s*\{/s, 'Must define mobile sizes for decision cards');
      assert.match(mobileBody, /\.card-metrics-secondary,\s*\.card-metrics\s*\{[^}]*gap:\s*4px;/s, 'Must define mobile gap');
    });
  });

  describe('4. Data & Task Alignment Verification', () => {
    it('4.1 should verify every card data-tasks matches canonical PROJECTS tasks', () => {
      for (const p of PROJECTS) {
        // Look for cards corresponding to p.id
        const cardRegex = new RegExp(`<article\\s+class="card"[^>]*data-project-id="${p.id}"[^>]*data-tasks="([^"]*)"`, 'g');
        const matches = [...indexHtml.matchAll(cardRegex)];
        assert.equal(matches.length, 2, `Expected 2 cards for project ${p.id} (V2 and V3)`);
        for (const m of matches) {
          const cardTasks = m[1].split(',').filter(Boolean);
          assert.deepEqual(cardTasks.sort(), [...p.tasks].sort(), `Tasks for ${p.id} must match PROJECTS data`);
        }
      }
    });

    it('4.2 should verify compare checkbox on every card matches project ID', () => {
      const compareInputs = [...indexHtml.matchAll(/<input\s+type="checkbox"\s+class="compare-select"\s+data-compare-id="([^"]+)"/g)];
      assert.equal(compareInputs.length, 20, 'Expected 20 compare checkboxes');
      const idsV2 = compareInputs.slice(0, 10).map((m) => m[1]);
      const idsV3 = compareInputs.slice(10, 20).map((m) => m[1]);
      const expectedIds = PROJECTS.map((p) => p.id);
      assert.deepEqual(idsV2, expectedIds, 'V2 compare IDs must match canonical project IDs');
      assert.deepEqual(idsV3, expectedIds, 'V3 compare IDs must match canonical project IDs');
    });
  });
});
