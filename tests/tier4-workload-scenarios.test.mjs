// tests/tier4-workload-scenarios.test.mjs
// Tier 4: Real-World Workload Scenarios (End-to-End User Journeys)
// Simulates complete user sessions through the entire architecture.

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
  buildReturnLink,
} from './helpers/client-sim.mjs';

describe('Tier 4: Real-World Workload Scenarios', () => {

  // -------------------------------------------------------------------------
  // Scenario 1: Portfolio Designer Workflow
  // -------------------------------------------------------------------------
  it('Scenario 1: Designer discovers portfolio skills, compares candidates, checks detail, and returns', async () => {
    // 1. Visit homepage
    const indexHtml = readFileSafe(join(DIST_DIR, 'index.html'));
    assert.ok(indexHtml, 'Homepage must be reachable');

    // 2. Validate decision hero header
    assert.match(indexHtml, /设计\s*Skill\s*怎么选/i, 'Headline must guide skill selection');

    // 3. User selects "portfolio" task filter
    const portfolioUrl = 'index.html?task=portfolio';
    const state = parseStateFromUrl(portfolioUrl);
    assert.equal(state.task, 'portfolio');

    // 4. User selects two candidates: 01-frontend-design and 02-ui-ux-pro-max
    const c1 = toggleCompareCandidate(state.compare, '01-frontend-design');
    const c2 = toggleCompareCandidate(c1.list, '02-ui-ux-pro-max');
    state.compare = c2.list;

    assert.deepEqual(state.compare, ['01-frontend-design', '02-ui-ux-pro-max']);
    const shareableUrl = serializeStateToUrl(state);
    assert.ok(shareableUrl.includes('task=portfolio'));
    assert.ok(shareableUrl.includes('01-frontend-design'));
    assert.ok(shareableUrl.includes('02-ui-ux-pro-max'));

    // 5. User opens detail page for 02-ui-ux-pro-max
    const detailHtml = readFileSafe(join(DIST_DIR, 'runs', '02-ui-ux-pro-max', 'detail.html'));
    assert.ok(detailHtml, 'Detail page for 02-ui-ux-pro-max must exist');
    assert.match(detailHtml, /02-ui-ux-pro-max/i);

    // 6. User verifies standalone preview launcher exists
    const hasPreview = /<a\b[^>]*href=["'][^"']*\/(?:index\.html|live)["'][^>]*>/i.test(detailHtml) ||
                       /新窗口|全屏预览|standalone/i.test(detailHtml);
    assert.ok(hasPreview, 'Detail page must provide standalone preview launcher');

    // 7. User clicks return link; state must be preserved
    const returnLink = buildReturnLink(state);
    assert.ok(returnLink.includes('task=portfolio'), 'Return link must preserve portfolio task');
    assert.ok(returnLink.includes('01-frontend-design'), 'Return link must preserve candidate 1');
    assert.ok(returnLink.includes('02-ui-ux-pro-max'), 'Return link must preserve candidate 2');
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Technical Benchmark Auditor Workflow
  // -------------------------------------------------------------------------
  it('Scenario 2: Technical auditor validates benchmark fairness, 9+1 nomenclature, and metric fixes', () => {
    const indexHtml = readFileSafe(join(DIST_DIR, 'index.html'));
    assert.ok(indexHtml, 'Homepage must exist');

    // 1. Verify 9+1 nomenclature (F05)
    assert.doesNotMatch(indexHtml, /<h1>\s*10\s*个设计\s*skill/i, 'Headline must not count 00-bare as a skill');

    // 2. Verify cumulative duration notice (F06)
    const text = getText(indexHtml);
    const hasCumulativeNotice = text.includes('各组耗时累计') ||
                                text.includes('各组累计') ||
                                text.includes('累计耗时') ||
                                text.includes('不是整批实际经过时间');
    assert.ok(hasCumulativeNotice, 'Total duration must be annotated as cumulative sum across runs (F06)');

    // 3. Verify V3 00-bare read_skill fix (F08)
    const v3Section = indexHtml.match(/id=["']v3["'][\s\S]*?(?:id=["']v2["']|<\/main>)/i);
    const v3Text = v3Section ? getText(v3Section[0]) : text;
    // Check if 00-bare is corrected
    const bareMention = /00-bare[\s\S]{1,200}?(?:未安装|不适用|探测误标|未读取)/i.test(v3Text) ||
                        !/00-bare[\s\S]{1,100}?读了 skill\s*是/i.test(v3Text);
    assert.ok(bareMention, '00-bare in V3 must not display read_skill=true without clarification (F08)');

    // 4. Verify token accounting separation (F09)
    assert.match(indexHtml, /输入\s*token/i, 'Input tokens must be a separate column');
    assert.match(indexHtml, /缓存读取/i, 'Cache read tokens must be a separate column');
    assert.doesNotMatch(indexHtml, /输入\s*token\s*绝大部分是缓存命中/i, 'Misleading footnote must be removed');

    // 5. Verify 08-taste-skill interruption warning (F10)
    assert.match(indexHtml, /中途断过/i, '08-taste-skill interruption flag must be visible');

    // 6. Verify internal review prompt stripped from detail page (F18)
    const detailHtml = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));
    assert.doesNotMatch(
      detailHtml,
      /编辑\s*runs\/.*\/review\.md\s*后重新构建即可更新/i,
      'Internal maintainer instruction must be removed from public DOM (F18)',
    );
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Mobile Evaluator Workflow (390px Viewport)
  // -------------------------------------------------------------------------
  it('Scenario 3: Mobile evaluator tests 390px responsive viewport, horizontal scrolling, and touch safety', () => {
    const indexHtml = readFileSafe(join(DIST_DIR, 'index.html'));
    const css = readFileSafe(join(DIST_DIR, 'style.css'));

    // 1. Viewport meta tag
    assert.match(
      indexHtml,
      /<meta\s+name="viewport"\s+content="[^"]*width=device-width[^"]*"/i,
      'Viewport meta tag must be set for mobile responsiveness',
    );

    // 2. Table wrap container with horizontal scrolling
    assert.ok(
      indexHtml.includes('table-wrap') || css.includes('.table-wrap'),
      'Table wrapper must be used to provide horizontal scroll on 390px mobile screens',
    );

    // 3. Fluid images
    assert.match(
      css,
      /(?:img\s*\{[^}]*(?:width|max-width):\s*100%|\.card-thumb\s+img|\.compare-thumb\s+img|\.shot-frame\s+img)/i,
      'Images must have responsive fluid width scaling to avoid overflowing mobile viewport',
    );

    // 4. Mobile media queries exist
    const inspector = inspectCss(css);
    const hasMobileStyles = inspector.hasMediaQuery('max-width') || css.includes('@media');
    assert.ok(hasMobileStyles, 'Responsive media queries must exist in CSS');

    // 5. Detail page iframe accessibility
    const detailHtml = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));
    const iframes = findElementsByTag(detailHtml, 'iframe');
    for (const iframe of iframes) {
      assert.ok(iframe.attrs.title, 'Iframe must have title attribute');
    }
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Direct Shareable Deep-Link Workflow
  // -------------------------------------------------------------------------
  it('Scenario 4: Direct shareable deep-link restores complete multi-candidate comparison state', () => {
    // 1. User opens deep link
    const deepLink = 'index.html?edition=v3&task=admin&compare=02-ui-ux-pro-max,04-oil-ui';
    const state = parseStateFromUrl(deepLink);

    // 2. Validate parsed state
    assert.equal(state.edition, 'v3', 'Edition must be v3');
    assert.equal(state.task, 'admin', 'Task must be admin');
    assert.deepEqual(
      state.compare,
      ['02-ui-ux-pro-max', '04-oil-ui'],
      'Comparison list must contain exactly the two shared candidates',
    );

    // 3. Re-serialize state and verify identical round-trip
    const reconstructed = serializeStateToUrl(state);
    assert.ok(reconstructed.includes('task=admin'));
    assert.ok(reconstructed.includes('02-ui-ux-pro-max'));
    assert.ok(reconstructed.includes('04-oil-ui'));

    // 4. Toggle one candidate off and verify URL updates
    const toggled = toggleCompareCandidate(state.compare, '02-ui-ux-pro-max');
    state.compare = toggled.list;
    const updatedUrl = serializeStateToUrl(state);
    assert.ok(!updatedUrl.includes('02-ui-ux-pro-max'), 'Removed candidate must not appear in URL');
    assert.ok(updatedUrl.includes('04-oil-ui'), 'Retained candidate must remain in URL');
  });

});
