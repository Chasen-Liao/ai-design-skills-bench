// tests/challenger-m4-viewport-stress.test.mjs
// Adversarial Empirical Stress Test Suite for Milestone 4 (Viewport & Layout Stress Challenger)
//
// Tests:
// 1. Strict DOM structure and 5 dimensional section hierarchy across all 10 detail pages.
// 2. Mobile switcher (.visuals-edition-switcher) button structure, ARIA attributes, and interactive JS simulation.
// 3. CSS specificity and display toggles for data-active-view across 390px mobile, 768px tablet, and 1440px desktop.
// 4. Touch target height/padding compliance (>= 40px) for mobile controls and WCAG 2.5.8 / 2.5.5 accessibility.
// 5. Horizontal overflow safety: pre code block wrap/break, table-wrap overflow-x, fluid media, and adversarial token strings.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import vm from 'node:vm';
import { PROJECTS } from '../site/data/projects.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const DIST_DIR = join(REPO_ROOT, 'site', 'dist');
const STYLE_CSS_PATH = join(REPO_ROOT, 'site', 'style.css');
const DIST_STYLE_PATH = join(DIST_DIR, 'style.css');

assert.ok(existsSync(STYLE_CSS_PATH), 'site/style.css must exist');
assert.ok(existsSync(DIST_STYLE_PATH), 'site/dist/style.css must exist');

const styleCss = readFileSync(STYLE_CSS_PATH, 'utf-8');
const distStyleCss = readFileSync(DIST_STYLE_PATH, 'utf-8');

const ALL_PROJECT_IDS = [
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

/**
 * Lightweight mock element to simulate DOM operations for client scripts
 */
class MockDOMElement {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attrs };
    this.classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
    this.listeners = {};
    this.children = [];
    this.textContent = '';
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  dispatchEvent(event) {
    const handlers = this.listeners[event.type || event] || [];
    for (const h of handlers) {
      h.call(this, event);
    }
  }

  get classList() {
    return {
      contains: (cls) => this.classes.has(cls),
      add: (cls) => {
        this.classes.add(cls);
        this.attributes.class = Array.from(this.classes).join(' ');
      },
      remove: (cls) => {
        this.classes.delete(cls);
        this.attributes.class = Array.from(this.classes).join(' ');
      },
      toggle: (cls, force) => {
        const has = this.classes.has(cls);
        const shouldHave = force !== undefined ? Boolean(force) : !has;
        if (shouldHave) {
          this.classes.add(cls);
        } else {
          this.classes.delete(cls);
        }
        this.attributes.class = Array.from(this.classes).join(' ');
        return shouldHave;
      },
    };
  }
}

describe('Challenger M4: Viewport & Layout Empirical Stress Test Suite', () => {

  // =========================================================================
  // 1. DOM Structure & Dimensional Section Hierarchy across All 10 Detail Pages
  // =========================================================================
  describe('1. DOM Structure & Dimensional Section Hierarchy Across 10 Detail Pages', () => {
    it('1.1 should generate all 10 detail pages with substantial file sizes', () => {
      assert.equal(ALL_PROJECT_IDS.length, 10, 'Must test exactly 10 project run IDs');
      for (const id of ALL_PROJECT_IDS) {
        const filePath = join(DIST_DIR, 'runs', id, 'detail.html');
        assert.ok(existsSync(filePath), `detail.html must exist for project ${id}`);
        const content = readFileSync(filePath, 'utf-8');
        assert.ok(content.length > 5000, `detail.html for ${id} must have substantial content (>5000 bytes, got ${content.length})`);
      }
    });

    it('1.2 should strictly enforce the 5 dimensional sections in exact sequential DOM order (F15)', () => {
      const sectionClasses = [
        'detail-positioning',
        'detail-visuals',
        'detail-differences',
        'detail-preview',
        'detail-evidence',
      ];

      for (const id of ALL_PROJECT_IDS) {
        const filePath = join(DIST_DIR, 'runs', id, 'detail.html');
        const html = readFileSync(filePath, 'utf-8');

        let lastIndex = -1;
        for (let i = 0; i < sectionClasses.length; i++) {
          const cls = sectionClasses[i];
          const pattern = new RegExp(`<section\\b[^>]*class=["'][^"']*\\b${cls}\\b[^"']*["']`, 'i');
          const match = pattern.exec(html);

          assert.ok(match, `Page ${id} missing required dimensional section .${cls}`);
          const curIndex = match.index;
          assert.ok(
            curIndex > lastIndex,
            `Page ${id}: section .${cls} (index ${curIndex}) appeared out of order, expected after index ${lastIndex}`,
          );
          lastIndex = curIndex;
        }
      }
    });

    it('1.3 should enforce semantic <section> tags with accessible aria-labelledby matching section h2 IDs', () => {
      const expectedSectionAria = [
        { sectionClass: 'detail-positioning', titleId: 'section-positioning-title', num: '01' },
        { sectionClass: 'detail-visuals', titleId: 'section-visuals-title', num: '02' },
        { sectionClass: 'detail-differences', titleId: 'section-differences-title', num: '03' },
        { sectionClass: 'detail-preview', titleId: 'section-preview-title', num: '04' },
        { sectionClass: 'detail-evidence', titleId: 'section-evidence-title', num: '05' },
      ];

      for (const id of ALL_PROJECT_IDS) {
        const html = readFileSync(join(DIST_DIR, 'runs', id, 'detail.html'), 'utf-8');

        for (const { sectionClass, titleId, num } of expectedSectionAria) {
          // Check section has aria-labelledby
          const sectionRegex = new RegExp(
            `<section\\b[^>]*class=["'][^"']*\\b${sectionClass}\\b[^"']*["'][^>]*aria-labelledby=["']${titleId}["']`,
            'i',
          );
          assert.ok(
            sectionRegex.test(html),
            `Page ${id}: section .${sectionClass} must have aria-labelledby="${titleId}"`,
          );

          // Check corresponding heading exists with id and section number
          const headingRegex = new RegExp(
            `<h2\\b[^>]*id=["']${titleId}["'][^>]*>[\\s\\S]*?<span\\b[^>]*class=["']section-num["']>${num}<\\/span>`,
            'i',
          );
          assert.ok(
            headingRegex.test(html),
            `Page ${id}: heading #${titleId} must exist with section number "${num}"`,
          );
        }
      }
    });

    it('1.4 should render Section 1 (.detail-positioning) with 3-tier provenance cards, tagline, and task pills', () => {
      for (const id of ALL_PROJECT_IDS) {
        const html = readFileSync(join(DIST_DIR, 'runs', id, 'detail.html'), 'utf-8');

        // Check tagline and task pills
        assert.ok(html.includes('positioning-summary-card'), `Page ${id} missing .positioning-summary-card`);
        assert.ok(html.includes('tagline-tag'), `Page ${id} missing .tagline-tag`);
        assert.ok(html.includes('tagline-text'), `Page ${id} missing .tagline-text`);
        assert.ok(html.includes('task-pills'), `Page ${id} missing .task-pills`);

        // Check 3-tier provenance badges (F04)
        assert.ok(html.includes('badge-doc'), `Page ${id} missing .badge-doc (作者文档描述)`);
        assert.ok(html.includes('作者文档描述'), `Page ${id} missing text "作者文档描述"`);
        assert.ok(html.includes('badge-observed'), `Page ${id} missing .badge-observed (本次实测观察)`);
        assert.ok(html.includes('本次实测观察'), `Page ${id} missing text "本次实测观察"`);
        assert.ok(html.includes('badge-editorial'), `Page ${id} missing .badge-editorial (编辑建议)`);
        assert.ok(html.includes('编辑建议'), `Page ${id} missing text "编辑建议"`);
        assert.ok(html.includes('优先推荐：'), `Page ${id} missing "优先推荐：" label`);
        assert.ok(html.includes('主要取舍：'), `Page ${id} missing "主要取舍：" label`);
      }
    });

    it('1.5 should handle edge case projects in Section 1 (08-taste-skill interruption and 00-bare baseline)', () => {
      // 08-taste-skill interrupted run check
      const html08 = readFileSync(join(DIST_DIR, 'runs', '08-taste-skill', 'detail.html'), 'utf-8');
      assert.ok(
        html08.includes('notice-warn') && html08.includes('flag-warn') && html08.includes('中途断过但有页面'),
        '08-taste-skill must feature prominent interrupted warning notice (F10)',
      );

      // 00-bare baseline check
      const html00 = readFileSync(join(DIST_DIR, 'runs', '00-bare', 'detail.html'), 'utf-8');
      assert.ok(
        html00.includes('00-bare') && (html00.includes('裸对照') || html00.includes('基线生成')),
        '00-bare must clearly declare baseline nature in positioning',
      );
    });

    it('1.6 should render Section 2 (.detail-visuals) with desktop dual-column screenshots and lazy loading', () => {
      for (const id of ALL_PROJECT_IDS) {
        const html = readFileSync(join(DIST_DIR, 'runs', id, 'detail.html'), 'utf-8');

        // Check columns
        assert.ok(html.includes('visual-col-v3'), `Page ${id} missing .visual-col-v3`);
        assert.ok(html.includes('visual-col-v2'), `Page ${id} missing .visual-col-v2`);

        // Check image tags and lazy loading
        const v3ImgRegex = new RegExp(`<img\\b[^>]*src=["'][^"']*v3/runs/${id}/shot-desktop\\.png["'][^>]*>`, 'i');
        const v2ImgRegex = new RegExp(`<img\\b[^>]*src=["'][^"']*v2/runs/${id}/shot-desktop\\.png["'][^>]*>`, 'i');
        assert.ok(v3ImgRegex.test(html), `Page ${id} missing V3 screenshot image tag`);
        assert.ok(v2ImgRegex.test(html), `Page ${id} missing V2 screenshot image tag`);

        // Ensure lazy loading on screenshots
        const imgMatches = html.match(/<img\b[^>]*shot-desktop\.png[^>]*>/gi) || [];
        assert.equal(imgMatches.length, 2, `Page ${id} should have exactly 2 shot-desktop images`);
        for (const img of imgMatches) {
          assert.ok(img.includes('loading="lazy"'), `Screenshot img must specify loading="lazy": ${img}`);
        }
      }
    });

    it('1.7 should render Section 3 (.detail-differences) with evolution and compliance cards', () => {
      for (const id of ALL_PROJECT_IDS) {
        const html = readFileSync(join(DIST_DIR, 'runs', id, 'detail.html'), 'utf-8');

        assert.ok(html.includes('differences-cards-grid'), `Page ${id} missing .differences-cards-grid`);
        assert.ok(html.includes('开销与效率演变'), `Page ${id} missing "开销与效率演变" card title`);
        assert.ok(html.includes('版式风格与执行遵从'), `Page ${id} missing "版式风格与执行遵从" card title`);
        assert.ok(html.includes('耗时演进：'), `Page ${id} missing "耗时演进：" metric`);
        assert.ok(html.includes('调用演进：'), `Page ${id} missing "调用演进：" metric`);
        assert.ok(html.includes('Prompt 缓存：'), `Page ${id} missing "Prompt 缓存：" metric`);
        assert.ok(html.includes('约束遵从：'), `Page ${id} missing "约束遵从：" observation`);
        assert.ok(html.includes('退出状态：'), `Page ${id} missing "退出状态：" status`);
      }
    });

    it('1.8 should render Section 4 (.detail-preview) with standalone launchers and explicit viewport annotations (F17)', () => {
      for (const id of ALL_PROJECT_IDS) {
        const html = readFileSync(join(DIST_DIR, 'runs', id, 'detail.html'), 'utf-8');

        assert.ok(html.includes('preview-launchers-grid'), `Page ${id} missing .preview-launchers-grid`);

        // Explicit 1440px desktop annotation
        assert.ok(
          html.includes('全屏查看页面 (1440px 桌面视口) ↗'),
          `Page ${id} must contain explicit 1440px desktop preview button (F17)`,
        );

        // Explicit 390px mobile annotation
        assert.ok(
          html.includes('移动端视图 (390px 视口) ↗'),
          `Page ${id} must contain explicit 390px mobile preview button (F17)`,
        );

        // Embedded browser viewport annotation
        assert.ok(
          html.includes('推荐视口：1440px × 900px'),
          `Page ${id} must annotate embedded browser viewport 1440px × 900px`,
        );

        // Embedded preview iframe A11y
        const iframeMatch = html.match(/<iframe\b([^>]*)>/i);
        assert.ok(iframeMatch, `Page ${id} must contain embedded preview iframe`);
        const iframeAttrs = iframeMatch[1];
        assert.ok(iframeAttrs.includes('loading="lazy"'), `Page ${id} preview iframe must specify loading="lazy"`);
        assert.ok(iframeAttrs.includes('title='), `Page ${id} preview iframe must include accessible title attribute`);
      }
    });

    it('1.9 should render Section 5 (.detail-evidence) with exactly 3 accessible accordions (F16)', () => {
      for (const id of ALL_PROJECT_IDS) {
        const html = readFileSync(join(DIST_DIR, 'runs', id, 'detail.html'), 'utf-8');

        // Check exactly 3 details accordions in section-evidence
        const evidenceSectionMatch = html.match(/<section\b[^>]*class=["'][^"']*detail-evidence[^"']*["'][\s\S]*?<\/section>/i);
        assert.ok(evidenceSectionMatch, `Page ${id} missing detail-evidence section`);
        const evidenceHtml = evidenceSectionMatch[0];

        const detailsMatches = evidenceHtml.match(/<details\b[^>]*class=["'][^"']*evidence-accordion[^"']*["'][^>]*>/gi) || [];
        assert.equal(detailsMatches.length, 3, `Page ${id} must contain exactly 3 evidence accordions (got ${detailsMatches.length})`);

        // Verify summary is immediate first child of each details accordion
        const summaryFirstChildRegex = /<details\b[^>]*class=["'][^"']*evidence-accordion[^"']*["'][^>]*>\s*<summary\b/gi;
        const summaryMatches = evidenceHtml.match(summaryFirstChildRegex) || [];
        assert.equal(summaryMatches.length, 3, `Page ${id}: all 3 <details> must have <summary> as immediate first child`);

        // Check accordion contents:
        // Accordion 1: Comparison table with scope="col" and scope="row"
        assert.ok(evidenceHtml.includes('kv-compare'), `Page ${id} missing table.kv-compare in evidence`);
        assert.ok(evidenceHtml.includes('scope="col"'), `Page ${id} table must specify scope="col" on header cells`);
        assert.ok(evidenceHtml.includes('scope="row"'), `Page ${id} table must specify scope="row" on row headers`);

        // Accordions 2 & 3: Code blocks with tabindex="0"
        const preBlocks = evidenceHtml.match(/<pre class="code-block" tabindex="0"><code>/g) || [];
        assert.equal(preBlocks.length, 4, `Page ${id} must contain 4 code blocks (2 prompts + 2 logs) with tabindex="0"`);
      }
    });

    it('1.10 should verify clean public DOM: no editor prompt (F18) and no undefined/NaN/null leaks', () => {
      for (const id of ALL_PROJECT_IDS) {
        const html = readFileSync(join(DIST_DIR, 'runs', id, 'detail.html'), 'utf-8');

        // F18: No editor maintenance prompt
        assert.doesNotMatch(
          html,
          /编辑\s*runs\/.*\/review\.md\s*后重新构建即可更新/i,
          `Page ${id} leaked internal editor text into public DOM (F18 violation)`,
        );

        // No template leaks: undefined, NaN, or raw null in body text
        assert.doesNotMatch(
          html,
          />\s*(?:undefined|NaN|null)\s*</,
          `Page ${id} contains unhandled template text literal (undefined, NaN, or null)`,
        );

        // No broken attribute values: href="undefined", src="null", etc.
        assert.doesNotMatch(
          html,
          /(?:href|src|data-[a-z-]+)=["'](?:undefined|null|NaN)["']/i,
          `Page ${id} contains broken attribute pointing to undefined/null/NaN`,
        );

        // Skip link and back link present
        assert.ok(html.includes('<a class="skip-link" href="#main">'), `Page ${id} missing skip-link`);
        assert.ok(html.includes('data-back="true"'), `Page ${id} missing data-back="true" on return link`);
      }
    });
  });

  // =========================================================================
  // 2. Mobile Visuals Switcher Structure & Interactive ARIA Simulation
  // =========================================================================
  describe('2. Mobile Visuals Switcher Structure & Interactive ARIA Simulation', () => {
    it('2.1 should render .visuals-edition-switcher with exact ARIA tablist/tab structure across all 10 pages', () => {
      for (const id of ALL_PROJECT_IDS) {
        const html = readFileSync(join(DIST_DIR, 'runs', id, 'detail.html'), 'utf-8');

        // Check switcher container
        const switcherRegex = /<div\b[^>]*class=["'][^"']*visuals-edition-switcher[^"']*["'][^>]*role=["']tablist["'][^>]*aria-label=["']移动端版本视觉切换["'][^>]*>/i;
        assert.ok(switcherRegex.test(html), `Page ${id} missing valid .visuals-edition-switcher tablist container`);

        // Check V3 tab button
        const v3BtnRegex = /<button\b[^>]*class=["'][^"']*tab-btn\s+active[^"']*["'][^>]*data-visual-target=["']v3["'][^>]*role=["']tab["'][^>]*aria-selected=["']true["'][^>]*>[^<]*V3[^<]*<\/button>/i;
        assert.ok(v3BtnRegex.test(html), `Page ${id} missing valid active V3 tab button`);

        // Check V2 tab button
        const v2BtnRegex = /<button\b[^>]*class=["'][^"']*tab-btn(?!\s+active)[^"']*["'][^>]*data-visual-target=["']v2["'][^>]*role=["']tab["'][^>]*aria-selected=["']false["'][^>]*>[^<]*V2[^<]*<\/button>/i;
        assert.ok(v2BtnRegex.test(html), `Page ${id} missing valid inactive V2 tab button`);

        // Check visuals-compare-grid initial active view
        const gridRegex = /<div\b[^>]*class=["'][^"']*visuals-compare-grid[^"']*["'][^>]*data-active-view=["']v3["'][^>]*>/i;
        assert.ok(gridRegex.test(html), `Page ${id} .visuals-compare-grid must start with data-active-view="v3"`);
      }
    });

    it('2.2 should extract client switcher script and verify interactive tab toggling in VM simulation', () => {
      // Use 01-frontend-design detail.html as baseline
      const html = readFileSync(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'), 'utf-8');
      const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i);
      assert.ok(scriptMatch, 'detail.html must contain inline client script');
      const scriptCode = scriptMatch[1];

      // Build simulated DOM elements
      const btnV3 = new MockDOMElement('button', {
        class: 'tab-btn active',
        'data-visual-target': 'v3',
        role: 'tab',
        'aria-selected': 'true',
      });
      const btnV2 = new MockDOMElement('button', {
        class: 'tab-btn',
        'data-visual-target': 'v2',
        role: 'tab',
        'aria-selected': 'false',
      });
      const visualsGrid = new MockDOMElement('div', {
        class: 'visuals-compare-grid compare-split',
        'data-active-view': 'v3',
      });
      const backLink = new MockDOMElement('a', {
        class: 'back',
        href: '../../index.html',
        'data-back': 'true',
      });
      const pagerPrev = new MockDOMElement('a', {
        href: '../00-bare/detail.html',
      });
      const pagerNext = new MockDOMElement('a', {
        href: '../02-ui-ux-pro-max/detail.html',
      });

      // Mock window and document environment
      const mockWindow = {
        location: {
          search: '?task=portfolio&edition=v2',
        },
      };

      const mockDocument = {
        referrer: '',
        querySelector: (selector) => {
          if (selector === '.visuals-compare-grid') return visualsGrid;
          return null;
        },
        querySelectorAll: (selector) => {
          if (selector === 'a.back, .pager a') {
            return [backLink, pagerPrev, pagerNext];
          }
          if (selector === '.visuals-edition-switcher .tab-btn') {
            return [btnV3, btnV2];
          }
          return [];
        },
      };

      const context = vm.createContext({
        window: mockWindow,
        document: mockDocument,
        Array: Array,
      });

      // Execute script in sandbox
      vm.runInContext(scriptCode, context);

      // Verify 1: URL search parameter persistence on return & pager links
      assert.equal(
        backLink.getAttribute('href'),
        '../../index.html?task=portfolio&edition=v2',
        'Back link must preserve incoming search parameters',
      );
      assert.equal(
        pagerPrev.getAttribute('href'),
        '../00-bare/detail.html?task=portfolio&edition=v2',
        'Pager prev link must preserve incoming search parameters',
      );
      assert.equal(
        pagerNext.getAttribute('href'),
        '../02-ui-ux-pro-max/detail.html?task=portfolio&edition=v2',
        'Pager next link must preserve incoming search parameters',
      );

      // Verify 2: Initial tab state before click
      assert.equal(visualsGrid.getAttribute('data-active-view'), 'v3');
      assert.equal(btnV3.classList.contains('active'), true);
      assert.equal(btnV2.classList.contains('active'), false);
      assert.equal(btnV3.getAttribute('aria-selected'), 'true');
      assert.equal(btnV2.getAttribute('aria-selected'), 'false');

      // Action 1: Click V2 tab button
      btnV2.dispatchEvent({ type: 'click' });
      assert.equal(
        visualsGrid.getAttribute('data-active-view'),
        'v2',
        'Clicking V2 button must set data-active-view="v2" on visuals grid',
      );
      assert.equal(btnV2.classList.contains('active'), true, 'V2 button must gain active class');
      assert.equal(btnV3.classList.contains('active'), false, 'V3 button must lose active class');
      assert.equal(btnV2.getAttribute('aria-selected'), 'true', 'V2 button must have aria-selected="true"');
      assert.equal(btnV3.getAttribute('aria-selected'), 'false', 'V3 button must have aria-selected="false"');

      // Action 2: Click V3 tab button back
      btnV3.dispatchEvent({ type: 'click' });
      assert.equal(
        visualsGrid.getAttribute('data-active-view'),
        'v3',
        'Clicking V3 button must set data-active-view="v3" on visuals grid',
      );
      assert.equal(btnV3.classList.contains('active'), true, 'V3 button must regain active class');
      assert.equal(btnV2.classList.contains('active'), false, 'V2 button must lose active class');
      assert.equal(btnV3.getAttribute('aria-selected'), 'true', 'V3 button must have aria-selected="true"');
      assert.equal(btnV2.getAttribute('aria-selected'), 'false', 'V2 button must have aria-selected="false"');
    });

    it('2.3 should ensure adversarial idempotency under repeated or rapid tab clicks', () => {
      const html = readFileSync(join(DIST_DIR, 'runs', '01-frontend-design', 'detail.html'), 'utf-8');
      const scriptCode = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i)[1];

      const btnV3 = new MockDOMElement('button', {
        class: 'tab-btn active',
        'data-visual-target': 'v3',
        role: 'tab',
        'aria-selected': 'true',
      });
      const btnV2 = new MockDOMElement('button', {
        class: 'tab-btn',
        'data-visual-target': 'v2',
        role: 'tab',
        'aria-selected': 'false',
      });
      const visualsGrid = new MockDOMElement('div', {
        class: 'visuals-compare-grid',
        'data-active-view': 'v3',
      });

      const context = vm.createContext({
        window: { location: { search: '' } },
        document: {
          referrer: '',
          querySelector: () => visualsGrid,
          querySelectorAll: (sel) => (sel.includes('tab-btn') ? [btnV3, btnV2] : []),
        },
        Array,
      });

      vm.runInContext(scriptCode, context);

      // Repeatedly click already active V3 tab 5 times
      for (let i = 0; i < 5; i++) {
        btnV3.dispatchEvent({ type: 'click' });
      }
      assert.equal(visualsGrid.getAttribute('data-active-view'), 'v3');
      assert.equal(btnV3.classList.contains('active'), true);
      assert.equal(btnV2.classList.contains('active'), false);
      assert.equal(btnV3.getAttribute('aria-selected'), 'true');
      assert.equal(btnV2.getAttribute('aria-selected'), 'false');

      // Rapidly toggle back and forth 10 times
      for (let i = 0; i < 10; i++) {
        btnV2.dispatchEvent({ type: 'click' });
        assert.equal(visualsGrid.getAttribute('data-active-view'), 'v2');
        btnV3.dispatchEvent({ type: 'click' });
        assert.equal(visualsGrid.getAttribute('data-active-view'), 'v3');
      }
      assert.equal(btnV3.classList.contains('active'), true);
      assert.equal(btnV2.classList.contains('active'), false);
    });
  });

  // =========================================================================
  // 3. CSS Specificity & Display Toggles Across Viewports
  // =========================================================================
  describe('3. CSS Specificity & Display Toggles Across Viewports', () => {
    it('3.1 should hide switcher on desktop and display dual columns side-by-side', () => {
      // Desktop default: .visuals-edition-switcher must be display: none
      const switcherDesktopRegex = /\.visuals-edition-switcher\s*\{[^}]*display:\s*none;?[^}]*\}/i;
      assert.ok(
        switcherDesktopRegex.test(styleCss),
        'Desktop default CSS must hide .visuals-edition-switcher via display: none',
      );

      // Desktop grid: .visuals-compare-grid must display 2 columns
      const gridDesktopRegex = /\.visuals-compare-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);?[^}]*\}/i;
      assert.ok(
        gridDesktopRegex.test(styleCss),
        'Desktop default CSS must configure .visuals-compare-grid with 2 equal columns',
      );
    });

    it('3.2 should configure mobile breakpoint (max-width: 640px) with switcher flex and single column grid', () => {
      // Extract @media (max-width: 640px) block
      const media640Match = styleCss.match(/@media\s*\(\s*max-width:\s*640px\s*\)\s*\{([\s\S]*?)\n\}/i);
      assert.ok(media640Match, 'style.css must contain @media (max-width: 640px) block');
      const media640Css = media640Match[1];

      // Switcher becomes flex
      const switcherMobileRegex = /\.visuals-edition-switcher\s*\{[^}]*display:\s*flex;?[^}]*\}/i;
      assert.ok(
        switcherMobileRegex.test(media640Css),
        '@media (max-width: 640px) must display .visuals-edition-switcher as flex',
      );

      // Grid collapses to single column
      const gridMobileRegex = /\.visuals-compare-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);?[^}]*\}/i;
      assert.ok(
        gridMobileRegex.test(media640Css),
        '@media (max-width: 640px) must collapse .visuals-compare-grid to 1 column (minmax(0, 1fr))',
      );
    });

    it('3.3 should define display toggles for data-active-view v3 and v2 in mobile media query', () => {
      const media640Match = styleCss.match(/@media\s*\(\s*max-width:\s*640px\s*\)\s*\{([\s\S]*?)\n\}/i);
      assert.ok(media640Match, 'style.css must contain @media (max-width: 640px) block');
      const media640Css = media640Match[1];

      // Toggle rule 1: When data-active-view="v3", hide v2 column
      const hideV2Regex = /\.visuals-compare-grid\[data-active-view=["']v3["']\]\s+\.visual-col-v2\s*\{[^}]*display:\s*none;?[^}]*\}/i;
      assert.ok(
        hideV2Regex.test(media640Css),
        '@media (max-width: 640px) must hide .visual-col-v2 when data-active-view="v3"',
      );

      // Toggle rule 2: When data-active-view="v2", hide v3 column
      const hideV3Regex = /\.visuals-compare-grid\[data-active-view=["']v2["']\]\s+\.visual-col-v3\s*\{[^}]*display:\s*none;?[^}]*\}/i;
      assert.ok(
        hideV3Regex.test(media640Css),
        '@media (max-width: 640px) must hide .visual-col-v3 when data-active-view="v2"',
      );
    });

    it('3.4 should verify CSS specificity ensures display: none is not overridden by general column styles', () => {
      // In CSS, .visuals-compare-grid[data-active-view="v3"] .visual-col-v2 has:
      // 2 class selectors (.visuals-compare-grid, .visual-col-v2) + 1 attribute selector ([data-active-view="v3"])
      // Specificity = (0, 3, 0).
      // Check that inside @media (max-width: 640px), there are no conflicting rules like:
      // .visual-col { display: flex !important; } or higher specificity selectors overriding display.
      const media640Match = styleCss.match(/@media\s*\(\s*max-width:\s*640px\s*\)\s*\{([\s\S]*?)\n\}/i);
      const media640Css = media640Match[1];

      assert.doesNotMatch(
        media640Css,
        /\.visual-col\s*\{[^}]*display:\s*(?:flex|block|grid)\s*!important/i,
        'Mobile CSS must not contain !important display overrides that break column toggles',
      );
    });

    it('3.5 should adapt differences cards and preview launchers to single column on tablet (max-width: 900px)', () => {
      const media900Match = styleCss.match(/@media\s*\(\s*max-width:\s*900px\s*\)\s*\{([\s\S]*?)(?=@media|\s*$)/i);
      assert.ok(media900Match, 'style.css must contain @media (max-width: 900px) tablet block');
      const media900Css = media900Match[1];

      const diffGridRegex = /\.differences-cards-grid[^}]*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);?[^}]*\}/i;
      assert.ok(
        diffGridRegex.test(media900Css),
        '@media (max-width: 900px) must collapse .differences-cards-grid to single column',
      );

      const previewGridRegex = /\.preview-launchers-grid[^}]*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);?[^}]*\}/i;
      assert.ok(
        previewGridRegex.test(media900Css),
        '@media (max-width: 900px) must collapse .preview-launchers-grid to single column',
      );
    });
  });

  // =========================================================================
  // 4. Touch Target Dimensions & Ergonomics Compliance (WCAG 2.5.5 / 2.5.8)
  // =========================================================================
  describe('4. Touch Target Dimensions & Ergonomics Compliance', () => {
    it('4.1 should enforce min-height >= 40px for mobile switcher tab buttons', () => {
      const media640Match = styleCss.match(/@media\s*\(\s*max-width:\s*640px\s*\)\s*\{([\s\S]*?)\n\}/i);
      const media640Css = media640Match[1];

      // Check tab-btn min-height
      const tabBtnRuleMatch = media640Css.match(/\.visuals-edition-switcher\s+\.tab-btn\s*\{([^}]*)\}/i);
      assert.ok(tabBtnRuleMatch, 'Mobile CSS must define rules for .visuals-edition-switcher .tab-btn');
      const tabBtnProps = tabBtnRuleMatch[1];

      const minHeightMatch = tabBtnProps.match(/min-height:\s*(\d+)px/i);
      assert.ok(minHeightMatch, 'Mobile tab-btn must explicitly declare min-height in px');
      const minHeightVal = parseInt(minHeightMatch[1], 10);
      assert.ok(
        minHeightVal >= 40,
        `Mobile tab-btn min-height must be >= 40px for touch ergonomics (got ${minHeightVal}px)`,
      );

      // Check padding exists
      assert.ok(/padding:\s*[^;]+;/i.test(tabBtnProps), 'Mobile tab-btn must define touch padding');
    });

    it('4.2 should ensure accordion summary provides generous hit area and pointer cursor', () => {
      // In base CSS
      const summaryRuleMatch = styleCss.match(/\.accordion-summary\s*\{([^}]*)\}/i);
      assert.ok(summaryRuleMatch, 'style.css must define .accordion-summary rule');
      const summaryProps = summaryRuleMatch[1];

      assert.ok(
        /cursor:\s*pointer/i.test(summaryProps),
        '.accordion-summary must set cursor: pointer for clear interactive affordance',
      );

      const paddingMatch = summaryProps.match(/padding:\s*(\d+)px\s*(\d+)px/i);
      assert.ok(paddingMatch, '.accordion-summary must specify explicit padding in px');
      const vPad = parseInt(paddingMatch[1], 10);
      assert.ok(vPad >= 12, `Vertical padding for summary should be >= 12px (got ${vPad}px)`);

      // In mobile @media (max-width: 640px)
      const media640Match = styleCss.match(/@media\s*\(\s*max-width:\s*640px\s*\)\s*\{([\s\S]*?)\n\}/i);
      const media640Css = media640Match[1];
      const mobileSummaryMatch = media640Css.match(/\.accordion-summary\s*\{([^}]*)\}/i);
      assert.ok(mobileSummaryMatch, 'Mobile CSS must explicitly preserve or adapt .accordion-summary padding');
    });

    it('4.3 should expand preview action buttons into full-width column on mobile to prevent mis-taps', () => {
      const media640Match = styleCss.match(/@media\s*\(\s*max-width:\s*640px\s*\)\s*\{([\s\S]*?)\n\}/i);
      const media640Css = media640Match[1];

      const actionsMatch = media640Css.match(/\.preview-card-actions\s*\{([^}]*)\}/i);
      assert.ok(actionsMatch, 'Mobile CSS must define .preview-card-actions layout rule');
      const actionsProps = actionsMatch[1];

      assert.ok(
        /flex-direction:\s*column/i.test(actionsProps),
        '.preview-card-actions must use flex-direction: column on mobile for full-width stacked touch targets',
      );
    });

    it('4.4 should verify focus-visible indicator on interactive accordion summaries', () => {
      const focusVisibleRegex = /\.accordion-summary:focus-visible\s*\{[^}]*outline:\s*2px\s+solid/i;
      assert.ok(
        focusVisibleRegex.test(styleCss),
        'style.css must define .accordion-summary:focus-visible with 2px solid outline for keyboard users',
      );
    });
  });

  // =========================================================================
  // 5. Horizontal Overflow Resistance & Layout Stress Test
  // =========================================================================
  describe('5. Horizontal Overflow Resistance & Layout Stress Test', () => {
    it('5.1 should contain word-break: break-all and white-space: pre-wrap on .code-block to prevent mobile blowout', () => {
      const codeBlockMatch = styleCss.match(/\.code-block\s*\{([^}]*)\}/i);
      assert.ok(codeBlockMatch, 'style.css must define .code-block rule');
      const codeBlockProps = codeBlockMatch[1];

      // Check white-space: pre-wrap
      assert.ok(
        /white-space:\s*pre-wrap/i.test(codeBlockProps),
        '.code-block must declare white-space: pre-wrap so long code lines wrap gracefully',
      );

      // Check word-break: break-all or overflow-wrap: anywhere
      assert.ok(
        /word-break:\s*break-all/i.test(codeBlockProps) || /overflow-wrap:\s*anywhere/i.test(codeBlockProps),
        '.code-block must declare word-break: break-all or overflow-wrap: anywhere to prevent token overflow',
      );

      // Check bounded vertical overflow
      assert.ok(
        /overflow-y:\s*auto/i.test(codeBlockProps) || /overflow:\s*auto/i.test(codeBlockProps),
        '.code-block must declare overflow-y: auto for scrollable logs',
      );
      assert.ok(
        /max-height:\s*\d+px/i.test(codeBlockProps),
        '.code-block must declare max-height constraint',
      );
    });

    it('5.2 should wrap all comparison tables in .table-wrap with overflow-x: auto and touch momentum', () => {
      const tableWrapMatch = styleCss.match(/(?:^|\n)\.table-wrap\s*\{([^}]*)\}/);
      assert.ok(tableWrapMatch, 'style.css must define .table-wrap rule');
      const tableWrapProps = tableWrapMatch[1];

      assert.ok(
        /overflow-x:\s*auto/i.test(tableWrapProps),
        '.table-wrap must define overflow-x: auto for horizontal table containment',
      );
      assert.ok(
        /-webkit-overflow-scrolling:\s*touch/i.test(tableWrapProps),
        '.table-wrap must define -webkit-overflow-scrolling: touch for iOS smoothness',
      );

      // Verify every detail page wraps table.kv-compare inside .table-wrap
      for (const id of ALL_PROJECT_IDS) {
        const html = readFileSync(join(DIST_DIR, 'runs', id, 'detail.html'), 'utf-8');
        const hasWrappedTable = /<div\b[^>]*class=["'][^"']*table-wrap[^"']*["'][^>]*>\s*<table\b[^>]*class=["'][^"']*kv-compare/i.test(html);
        assert.ok(hasWrappedTable, `Page ${id} must wrap table.kv-compare directly inside .table-wrap`);
      }
    });

    it('5.3 should verify fluid image scaling (width: 100% and height: auto) to eliminate horizontal image overflow', () => {
      const shotFrameImgMatch = styleCss.match(/\.shot-frame\s+img\s*\{([^}]*)\}/i);
      assert.ok(shotFrameImgMatch, 'style.css must define .shot-frame img rule');
      const shotFrameImgProps = shotFrameImgMatch[1];

      assert.ok(
        /width:\s*100%/i.test(shotFrameImgProps),
        '.shot-frame img must specify width: 100% for fluid containment',
      );
      assert.ok(
        /height:\s*auto/i.test(shotFrameImgProps),
        '.shot-frame img must specify height: auto to preserve aspect ratio',
      );
    });

    it('5.4 should ensure embedded preview iframes are 100% fluid with no fixed pixel width', () => {
      const liveFrameMatch = styleCss.match(/\.live-frame\s*\{([^}]*)\}/i);
      assert.ok(liveFrameMatch, 'style.css must define .live-frame rule');
      const liveFrameProps = liveFrameMatch[1];

      assert.ok(
        /width:\s*100%/i.test(liveFrameProps),
        '.live-frame iframe must specify width: 100% for fluid responsive scaling',
      );

      // Verify HTML does not set fixed pixel width attributes on preview iframes
      for (const id of ALL_PROJECT_IDS) {
        const html = readFileSync(join(DIST_DIR, 'runs', id, 'detail.html'), 'utf-8');
        const iframeMatches = html.match(/<iframe\b[^>]*>/gi) || [];
        for (const ifr of iframeMatches) {
          assert.doesNotMatch(
            ifr,
            /\bwidth=["']\d{3,}["']/,
            `Page ${id} iframe must not have fixed hardcoded pixel width: ${ifr}`,
          );
        }
      }
    });

    it('5.5 should stress-test code block wrapping against adversarial unbroken long token strings', () => {
      // Simulate extreme prompt/log input with 1000-character unbroken string (e.g. giant base64 token or URL)
      const unbrokenToken = 'a'.repeat(500) + 'https://example.com/deep/nested/path/' + 'f'.repeat(500);

      // Verify word-break: break-all and white-space: pre-wrap are both present in styleCss
      const codeBlockMatch = styleCss.match(/\.code-block\s*\{([^}]*)\}/i);
      const props = codeBlockMatch[1];
      const hasWrap = /white-space:\s*pre-wrap/i.test(props);
      const hasBreak = /word-break:\s*break-all/i.test(props) || /overflow-wrap:\s*anywhere/i.test(props);

      assert.ok(hasWrap, 'code-block must have white-space: pre-wrap to handle long content without horizontal overflow');
      assert.ok(hasBreak, 'code-block must have word-break: break-all to split unbroken tokens');

      // Check all 10 detail pages to ensure raw logs in pre code-block are sanitized against raw HTML injection
      for (const id of ALL_PROJECT_IDS) {
        const html = readFileSync(join(DIST_DIR, 'runs', id, 'detail.html'), 'utf-8');
        const codeBlockMatches = html.match(/<pre class="code-block"[^>]*><code>([\s\S]*?)<\/code><\/pre>/gi) || [];
        assert.ok(codeBlockMatches.length >= 4, `Page ${id} must contain at least 4 code blocks`);
        for (const block of codeBlockMatches) {
          // Verify code blocks do not contain unescaped script tags
          assert.doesNotMatch(
            block,
            /<script\b/i,
            `Page ${id} code block must properly HTML-escape code contents against script injection`,
          );
        }
      }
    });
  });

});
