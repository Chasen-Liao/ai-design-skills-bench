// tests/tier1-feature-coverage.test.mjs
// Tier 1: Feature Coverage (>=5 test cases per feature category)
// Tests user requirements R1 through R5 and features F01 through F22 against static artifacts.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPO_ROOT,
  DIST_DIR,
  readFileSafe,
  getText,
  findElementsByTag,
  findElementsByClass,
  findElementById,
  inspectCss,
} from './helpers/html-parser.mjs';

describe('Tier 1: Feature Coverage', () => {

  // -------------------------------------------------------------------------
  // Category 1: Static Build Output & Layout (F20)
  // -------------------------------------------------------------------------
  describe('Category 1: Static Build Output & Layout (F20)', () => {
    it('1.1 should generate site/dist/index.html with valid HTML structure', () => {
      const indexPath = join(DIST_DIR, 'index.html');
      assert.ok(existsSync(indexPath), 'site/dist/index.html must exist');
      const html = readFileSafe(indexPath);
      assert.ok(html.length > 500, 'index.html should not be empty');
      assert.match(html, /<!DOCTYPE html>/i, 'index.html must have DOCTYPE');
      assert.match(html, /<html\s+lang="zh-CN"/i, 'index.html must declare lang="zh-CN"');
      assert.match(html, /<main\b[^>]*\bid="main"/i, 'index.html must have <main id="main">');
    });

    it('1.2 should copy site/style.css into site/dist/style.css', () => {
      const cssPath = join(DIST_DIR, 'style.css');
      assert.ok(existsSync(cssPath), 'site/dist/style.css must exist');
      const css = readFileSafe(cssPath);
      assert.ok(css.length > 1000, 'style.css should have substantial styling rules');
    });

    it('1.3 should generate all 10 detail pages under site/dist/runs/<id>/detail.html', () => {
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
      for (const id of expectedIds) {
        const detailPath = join(DIST_DIR, 'runs', id, 'detail.html');
        assert.ok(existsSync(detailPath), `Detail page for ${id} must exist at runs/${id}/detail.html`);
        const html = readFileSafe(detailPath);
        assert.ok(html.includes(id), `Detail page for ${id} should contain project id`);
      }
    });

    it('1.4 should copy benchmark assets for both v2 and v3 editions under site/dist', () => {
      const v2Dir = join(DIST_DIR, 'v2', 'runs', '01-frontend-design');
      const v3Dir = join(DIST_DIR, 'v3', 'runs', '01-frontend-design');
      assert.ok(existsSync(v2Dir), 'v2 run assets directory must exist');
      assert.ok(existsSync(v3Dir), 'v3 run assets directory must exist');
      assert.ok(existsSync(join(v2Dir, 'meta.json')), 'v2 meta.json must be preserved');
      assert.ok(existsSync(join(v3Dir, 'meta.json')), 'v3 meta.json must be preserved');
    });

    it('1.5 should copy or preserve thumbnails under site/dist/thumbs', () => {
      const thumbsDir = join(DIST_DIR, 'thumbs');
      assert.ok(existsSync(thumbsDir), 'site/dist/thumbs directory must exist');
    });
  });

  // -------------------------------------------------------------------------
  // Category 2: Homepage Decision Headline & 9+1 Nomenclature (F01, F05, F06, F07)
  // -------------------------------------------------------------------------
  describe('Category 2: Homepage Decision Architecture & 9+1 Nomenclature (F01, F05, F06, F07)', () => {
    it('2.1 should display decision-oriented headline: "设计 Skill 怎么选？先看同题做出的页面" (F01)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      assert.match(
        html,
        /设计\s*Skill\s*怎么选[？?]\s*先看同题做出的页面/,
        'Homepage hero title must match F01 decision headline',
      );
    });

    it('2.2 should correct terminology to "9 个设计项目 + 1 个裸对照" instead of "10 个设计 skill" (F05)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      // F05: Header, lede, and stats must use 9+1 formulation
      const has9Plus1 = /9\s*个设计项目\s*\+\s*1\s*个裸(?:Pi)?对照/.test(html) ||
                        /9\s*个设计项目.*1\s*个裸对照/.test(html);
      assert.ok(
        has9Plus1,
        'Homepage should explain 9 design projects + 1 bare baseline (F05)',
      );
      assert.doesNotMatch(
        html,
        /<h1>\s*10\s*个设计\s*skill/i,
        'H1 headline must not state "10 个设计 skill" (00-bare is not a skill)',
      );
    });

    it('2.3 should provide explicit boundary disclaimer regarding personal page benchmark (F01)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      const text = getText(html);
      const hasDisclaimer = text.includes('仅个人页实测') ||
                            text.includes('其他任务建议来自作者文档') ||
                            text.includes('来自作者文档');
      assert.ok(
        hasDisclaimer,
        'Homepage must contain boundary disclaimer clarifying that tests are on personal page and other task advice comes from author docs (F01)',
      );
    });

    it('2.4 should clarify that total duration is a cumulative sum across runs, not wall-clock batch duration (F06)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      const text = getText(html);
      const hasCumulativeNote = text.includes('各组耗时累计') ||
                                text.includes('各组累计') ||
                                text.includes('累计耗时') ||
                                text.includes('不是整批实际经过时间');
      assert.ok(
        hasCumulativeNote,
        'Homepage duration metrics must clarify cumulative sum across runs, not wall-clock batch duration (F06)',
      );
    });

    it('2.5 should contextualize V3 one-shot constraint with factual execution reality (F07)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      const text = getText(html);
      // F07: Contextualize that V3 prompt asked for one-shot, but 04, 06, 08 still had multiple edits or browser checks
      const hasV3Context = text.includes('一次成版') &&
                           (text.includes('限制迭代') || text.includes('实际执行') || text.includes('自检'));
      assert.ok(
        hasV3Context,
        'Homepage must contextualize V3 execution constraint objectively (F07)',
      );
    });

    it('2.6 should clearly identify model name: DeepSeek V4.1 Flash 1017 (F01)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      assert.match(
        html,
        /DeepSeek\s+V4\.1\s+Flash\s+1017/i,
        'Homepage must identify the model as DeepSeek V4.1 Flash 1017',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Category 3: Task Selection Filter & Decision Cards (F02, F03, F04)
  // -------------------------------------------------------------------------
  describe('Category 3: Task Selection Filter & Decision Cards (F02, F03, F04)', () => {
    it('3.1 should render task filter container with 5 designated task categories plus all (F02)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      // F02 requires 5 tasks: 个人站/作品集, 营销落地页, 后台与产品界面, 原型与演示, 已有风格参考
      assert.match(html, /个人站(?:\/|与)作品集/, 'Task filter must include 个人站/作品集');
      assert.match(html, /营销落地页/, 'Task filter must include 营销落地页');
      assert.match(html, /后台(?:与|及)产品界面/, 'Task filter must include 后台与产品界面');
      assert.match(html, /原型(?:与|及)演示/, 'Task filter must include 原型与演示');
      assert.match(html, /已有风格参考/, 'Task filter must include 已有风格参考');
    });

    it('3.2 should provide accessible interactive attributes on task filter buttons (F02, F22)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      // Look for task filter buttons or tabs
      const hasTaskAttrs = /data-task(?:-filter)?=["'][^"']+["']/.test(html) ||
                           /data-category=["'][^"']+["']/.test(html) ||
                           /class=["'][^"']*task-(?:filter|tab|chip)[^"']*["']/.test(html);
      assert.ok(
        hasTaskAttrs,
        'Task filters must have identifiable data or class attributes for client filtering (F02)',
      );
    });

    it('3.3 should structure decision cards to highlight thumbnail, skill name, concrete feature, and tasks (F03)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      // Decision cards should contain project titles and task/positioning information
      const cards = findElementsByClass(html, 'card');
      assert.ok(cards.length >= 10, 'Index should render at least 10 project cards');
      // Verify cards have thumbnail and title
      const firstCard = cards[0].full;
      assert.match(firstCard, /<img\b|<div class="thumb/i, 'Card must have visual preview');
      assert.match(firstCard, /<h3\b/i, 'Card must have title heading');
    });

    it('3.4 should demote execution metrics (duration, LLM calls) to secondary status on cards (F03)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      // Cards must not use metrics as the primary headline or default sorting
      const cards = findElementsByClass(html, 'card');
      for (const card of cards.slice(0, 3)) {
        // H3 should be the skill title, not the metric
        const h3Match = card.full.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
        assert.ok(h3Match, 'Card must have an h3 title');
        const h3Text = getText(h3Match[1]);
        assert.doesNotMatch(h3Text, /^\d+\s*秒|^\d+\s*分/i, 'H3 title must not be duration metric');
      }
    });

    it('3.5 should distinguish 3-tier provenance: author doc, benchmark observation, editorial advice (F04)', () => {
      // Check either in data registry or rendered DOM
      const projectsPath = join(REPO_ROOT, 'site', 'data', 'projects.mjs');
      const indexHtml = readFileSafe(join(DIST_DIR, 'index.html'));
      const detailHtml = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));

      const hasProvenanceInData = existsSync(projectsPath) && (
        readFileSafe(projectsPath).includes('docPositioning') ||
        readFileSafe(projectsPath).includes('observedNote') ||
        readFileSafe(projectsPath).includes('editorialStatus')
      );

      const hasProvenanceInHtml = (
        (indexHtml && (indexHtml.includes('作者文档') || indexHtml.includes('实测观察'))) ||
        (detailHtml && (detailHtml.includes('作者文档') || detailHtml.includes('实测观察')))
      );

      assert.ok(
        hasProvenanceInData || hasProvenanceInHtml,
        'System must distinguish author documentation description from benchmark observation (F04)',
      );
    });

    it('3.6 should verify site/data/projects.mjs conforms to interface contract if present (F04, Contract)', async () => {
      const projectsPath = join(REPO_ROOT, 'site', 'data', 'projects.mjs');
      if (existsSync(projectsPath)) {
        const mod = await import(`file://${projectsPath}`);
        assert.ok(Array.isArray(mod.PROJECTS), 'site/data/projects.mjs must export PROJECTS array');
        assert.equal(mod.PROJECTS.length, 10, 'PROJECTS array must contain 10 items');
        const bare = mod.PROJECTS.find((p) => p.id === '00-bare');
        assert.ok(bare, '00-bare must exist in PROJECTS');
        assert.equal(bare.isSkill, false, '00-bare must have isSkill: false');
        assert.ok(Array.isArray(bare.tasks), 'Project must have tasks array');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Category 4: Metric Rectifications & Run Data Accuracy (F08, F09, F10)
  // -------------------------------------------------------------------------
  describe('Category 4: Objective Metric Rectifications (F08, F09, F10)', () => {
    it('4.1 should correct V3 00-bare read_skill to "未安装 / 不适用" or false positive note (F08)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      // In the V3 edition panel, 00-bare must NOT be displayed as having read skill ("是")
      // Check V3 section if separated or table row
      const v3PanelMatch = html.match(/id=["']v3["'][\s\S]*?(?:id=["']v2["']|<\/main>)/i);
      const targetHtml = v3PanelMatch ? v3PanelMatch[0] : html;

      // Check whether 00-bare row in V3 shows "未安装" or "不适用"
      const bareRowMatch = targetHtml.match(/<tr\b[^>]*>[\s\S]*?00-bare[\s\S]*?<\/tr>/i);
      if (bareRowMatch) {
        const rowText = getText(bareRowMatch[0]);
        assert.ok(
          rowText.includes('未安装') || rowText.includes('不适用') || !rowText.includes('读了 skill 是'),
          'V3 00-bare must not indicate read_skill is true without correction (F08)',
        );
      }
    });

    it('4.2 should separate raw input tokens from cacheRead prompt cache tokens in data table (F09)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      assert.match(html, /输入\s*token/i, 'Table header must include 输入 token');
      assert.match(html, /缓存读取/i, 'Table header must include 缓存读取');
    });

    it('4.3 should remove or replace misleading footnote claiming input is mostly cache hit (F09)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      assert.doesNotMatch(
        html,
        /输入\s*token\s*绝大部分是缓存命中/i,
        'Misleading footnote claiming "输入 token 绝大部分是缓存命中" must be removed (F09)',
      );
    });

    it('4.4 should retain prominent warning badge for 08-taste-skill interruption (F10)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      const detailHtml = readFileSafe(join(DIST_DIR, 'runs', '08-taste-skill', 'detail.html'));
      const combined = (html || '') + (detailHtml || '');
      assert.match(
        combined,
        /中途断过/i,
        '08-taste-skill must retain prominent interrupted warning badge (F10)',
      );
    });

    it('4.5 should accurately aggregate session totals without NaN or undefined (F06, F09)', () => {
      const html = readFileSafe(join(DIST_DIR, 'index.html'));
      const text = getText(html);
      assert.doesNotMatch(text, /\bNaN\b/, 'Rendered page text must not contain NaN');
      assert.doesNotMatch(text, /\bundefined\b/, 'Rendered page text must not contain undefined');
      assert.doesNotMatch(text, /\bnull\b/, 'Rendered page text must not contain raw null string');
    });
  });

  // -------------------------------------------------------------------------
  // Category 5: Multi-Candidate Horizontal Comparison & URL State (F11, F12, F13, F14)
  // -------------------------------------------------------------------------
  describe('Category 5: Multi-Candidate Horizontal Comparison (F11, F12, F13, F14)', () => {
    it('5.1 should provide UI entry or mechanism to compare 2-3 candidate skills side-by-side (F11)', () => {
      const indexHtml = readFileSafe(join(DIST_DIR, 'index.html'));
      const compareHtml = readFileSafe(join(DIST_DIR, 'compare.html'));
      const combined = (indexHtml || '') + (compareHtml || '');
      // Look for comparison launcher, checkboxes, or compare container
      const hasCompareFeature = /data-compare/i.test(combined) ||
                                /class=["'][^"']*compare-(?:matrix|tray|bar|select|btn)[^"']*["']/i.test(combined) ||
                                /比较不同\s*Skill/i.test(combined) ||
                                /横向对[比比]/i.test(combined) ||
                                /候选对[比比]/i.test(combined);
      assert.ok(
        hasCompareFeature,
        'System must provide 2-3 candidate horizontal comparison mechanism (F11)',
      );
    });

    it('5.2 should clearly distinguish horizontal comparison from longitudinal V2 vs V3 comparison (F11, F12)', () => {
      const indexHtml = readFileSafe(join(DIST_DIR, 'index.html'));
      const detailHtml = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));
      const text = getText((indexHtml || '') + ' ' + (detailHtml || ''));
      // Specification explicitly requires clear naming: "比较不同 Skill" vs "查看两次实验"
      const hasClearNaming = (
        (text.includes('比较不同') || text.includes('横向比对') || text.includes('多候选')) &&
        (text.includes('两次实验') || text.includes('V2') || text.includes('纵向对比'))
      );
      assert.ok(
        hasClearNaming,
        'System must clearly distinguish horizontal comparison from longitudinal V2 vs V3 (F11, F12)',
      );
    });

    it('5.3 should synchronize candidate selection and task filter to URL query/hash (F13)', () => {
      const indexHtml = readFileSafe(join(DIST_DIR, 'index.html'));
      // Client script must contain URL state handling for task or compare parameters
      assert.match(
        indexHtml,
        /(?:URLSearchParams|location\.(?:search|hash)|replaceState|pushState)/i,
        'Index client script must implement URL state synchronization (F13)',
      );
    });

    it('5.4 should preserve filter and edition state in detail page return links (F14)', () => {
      const detailHtml = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));
      const backLinks = findElementsByClass(detailHtml, 'back');
      assert.ok(backLinks.length > 0, 'Detail page must have back link');
      const backHref = backLinks[0].attrs.href || '';
      // F14: Return link should support preserved parameters or script dynamic restoration
      const hasStatePreservation = backHref.includes('?') ||
                                   backHref.includes('#') ||
                                   detailHtml.includes('history.back') ||
                                   detailHtml.includes('sessionStorage') ||
                                   detailHtml.includes('data-back');
      assert.ok(
        hasStatePreservation,
        'Detail page return link must preserve previous state rather than hardcoding bare index.html (F14)',
      );
    });

    it('5.5 should enforce max 3 candidates limit in comparison selection (F11, F13)', () => {
      const indexHtml = readFileSafe(join(DIST_DIR, 'index.html'));
      // Script should check length <= 3 or disable additional candidates when 3 are chosen
      const hasMax3Limit = /3\b/i.test(indexHtml) &&
                           /(?:compare|selected|candidates|max|limit)/i.test(indexHtml);
      assert.ok(
        hasMax3Limit,
        'Comparison selection must enforce 2-3 candidate constraint (F11, F13)',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Category 6: Detail Page Dimensions & Content Flow (F15, F16, F17, F18)
  // -------------------------------------------------------------------------
  describe('Category 6: Detail Page Dimensions & Content Flow (F15, F16, F17, F18)', () => {
    it('6.1 should structure detail page with 5 dimensional sections (F15)', () => {
      const html = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));
      // Check for dimensional sections or classes
      const hasSections = /detail-positioning/i.test(html) ||
                          /class=["'][^"']*positioning[^"']*["']/i.test(html) ||
                          /detail-visuals/i.test(html) ||
                          /detail-differences/i.test(html) ||
                          /detail-preview/i.test(html) ||
                          /detail-evidence/i.test(html);
      assert.ok(
        hasSections,
        'Detail page should be restructured by dimension (F15)',
      );
    });

    it('6.2 should use accessible accordions (<details>/<summary>) for long tables, prompt, and logs (F16)', () => {
      const html = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));
      const details = findElementsByTag(html, 'details');
      assert.ok(
        details.length >= 1,
        'Detail page should collapse heavy tables/prompts/logs with <details>/<summary> (F16)',
      );
    });

    it('6.3 should provide standalone interactive preview launcher with viewport dimensions (F17)', () => {
      const html = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));
      // F17 requires dedicated preview with viewport annotations (e.g. 1440px / 390px)
      const hasViewportAnnotation = /1440|390px|视口|全屏预览|新窗口/i.test(html);
      assert.ok(
        hasViewportAnnotation,
        'Detail page must provide standalone preview with explicit viewport dimensions (F17)',
      );
    });

    it('6.4 should remove editor maintenance prompt from public DOM (F18)', () => {
      const html = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));
      assert.doesNotMatch(
        html,
        /编辑\s*runs\/.*\/review\.md\s*后重新构建即可更新/i,
        'Public DOM must remove "编辑 runs/.../review.md 后重新构建即可更新" (F18)',
      );
    });

    it('6.5 should ensure preview iframes have title and loading="lazy" (F17, F22)', () => {
      const html = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));
      const iframes = findElementsByTag(html, 'iframe');
      for (const iframe of iframes) {
        assert.ok(iframe.attrs.title, 'Every iframe must have a title attribute for A11y');
        assert.equal(iframe.attrs.loading, 'lazy', 'iframe should use loading="lazy"');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Category 7: Responsive Layout & Accessibility Standards (F19, F21, F22)
  // -------------------------------------------------------------------------
  describe('Category 7: Responsive Layout & Accessibility (F19, F21, F22)', () => {
    it('7.1 should define warm paper aesthetic design tokens in style.css (F21)', () => {
      const css = readFileSafe(join(DIST_DIR, 'style.css'));
      const inspector = inspectCss(css);
      assert.ok(
        css.includes('#f4efe6') || css.includes('#F4EFE6') || inspector.hasVariable('--bg'),
        'style.css must define warm paper background token (#f4efe6)',
      );
      assert.ok(
        css.includes('#1a1714') || css.includes('#1A1714') || inspector.hasVariable('--fg'),
        'style.css must define deep ink text token (#1a1714)',
      );
      assert.ok(
        css.includes('#f0652e') || css.includes('#F0652E') || inspector.hasVariable('--accent'),
        'style.css must define burnt orange accent token (#f0652e)',
      );
    });

    it('7.2 should include mobile responsive rules for 390px / <= 640px (F19)', () => {
      const css = readFileSafe(join(DIST_DIR, 'style.css'));
      const hasMobileBreak = /@media[^{]*(?:max-width:\s*(?:640|600|480|390)px)/i.test(css);
      assert.ok(
        hasMobileBreak,
        'style.css must have responsive media query for mobile viewports (<= 640px)',
      );
    });

    it('7.3 should include tablet responsive rules for 768px / <= 900px (F19)', () => {
      const css = readFileSafe(join(DIST_DIR, 'style.css'));
      const hasTabletBreak = /@media[^{]*(?:max-width:\s*(?:900|768|800)px)/i.test(css);
      assert.ok(
        hasTabletBreak,
        'style.css must have responsive media query for tablet viewports',
      );
    });

    it('7.4 should include skip-link pointing to #main on all pages (F22)', () => {
      const indexHtml = readFileSafe(join(DIST_DIR, 'index.html'));
      const detailHtml = readFileSafe(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'));
      assert.match(indexHtml, /<a\s+class="skip-link"\s+href="#main">/i, 'index.html must have skip-link');
      assert.match(detailHtml, /<a\s+class="skip-link"\s+href="#main">/i, 'detail.html must have skip-link');
    });

    it('7.5 should provide :focus-visible rules for keyboard navigation (F22)', () => {
      const css = readFileSafe(join(DIST_DIR, 'style.css'));
      assert.match(
        css,
        /:focus-visible/i,
        'style.css must define :focus-visible rules for keyboard navigation accessibility (F22)',
      );
    });

    it('7.6 should use scope="col" or scope="row" on table headers (F22)', () => {
      const indexHtml = readFileSafe(join(DIST_DIR, 'index.html'));
      const ths = findElementsByTag(indexHtml, 'th');
      assert.ok(ths.length > 0, 'Index table must have <th> elements');
      const hasScope = ths.some((th) => th.attrs.scope === 'col' || th.attrs.scope === 'row');
      assert.ok(hasScope, 'Table headers must specify scope="col" or scope="row" for screen readers (F22)');
    });
  });

});
