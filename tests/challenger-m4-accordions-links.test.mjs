// tests/challenger-m4-accordions-links.test.mjs
// Adversarial Empirical Stress Test Suite for Milestone 4 (Detail Page Accordions & Links)
// Author: Challenger M4-2 (Accordion & Link Stress Challenger)
//
// Rigorous verification across all 10 project detail pages:
// 1. Strict AST / regex check: Every single <details> element MUST have <summary> as its immediate first child.
// 2. All preview links (desktop 1440px and mobile 390px) have valid hrefs pointing to existing files.
// 3. All screenshot img src point to existing image files (desktop screenshots for v2 and v3).
// 4. Every iframe has non-empty title and loading="lazy".
// 5. Prompt and log contents are properly escaped against XSS (no unescaped <script> or HTML tags).
// 6. Zero occurrences of undefined or null across rendered HTML output.
// 7. Complete 5-dimensional section hierarchy and sequential DOM ordering.
// 8. Accessibility focus indicators and interactive summary styling.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PROJECTS } from '../site/data/projects.mjs';

// Resolve repository root robustly regardless of execution working directory
const REPO_ROOT = existsSync(join(process.cwd(), 'site', 'dist'))
  ? process.cwd()
  : resolve(import.meta.dirname, '..');
const DIST_DIR = join(REPO_ROOT, 'site', 'dist');

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
 * Helper: Read file text safely
 */
function readFile(filePath) {
  assert.ok(existsSync(filePath), `File must exist: ${filePath}`);
  return readFileSync(filePath, 'utf8');
}

/**
 * Helper: Parse HTML attributes from opening tag
 */
function extractAttrs(tagStr) {
  const attrs = {};
  const attrRegex = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  const stripped = tagStr.replace(/^<[a-zA-Z0-9_-]+\s*/, '');
  let match;
  while ((match = attrRegex.exec(stripped)) !== null) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

/**
 * Helper: Find elements by tag
 */
function findTags(html, tagName) {
  const list = [];
  const regex = new RegExp(`<(${tagName})\\b([^>]*)>([\\s\\S]*?)<\\/\\1>`, 'gi');
  let match;
  while ((match = regex.exec(html)) !== null) {
    list.push({
      tag: match[1],
      full: match[0],
      open: `<${match[1]}${match[2]}>`,
      attrs: extractAttrs(`<${match[1]}${match[2]}>`),
      content: match[3],
    });
  }
  return list;
}

describe('Challenger M4-2: Empirical Accordion & Link Stress Test Suite', () => {

  // =========================================================================
  // Suite 1: Detail Pages Presence & 5-Dimensional Section Hierarchy
  // =========================================================================
  describe('Suite 1: Detail Pages Presence & 5-Dimensional Hierarchy (F15, F18)', () => {
    it('1.1 should ensure all 10 project detail pages exist with substantial content', () => {
      assert.strictEqual(ALL_PROJECT_IDS.length, 10, 'Must test exactly 10 project IDs');
      for (const id of ALL_PROJECT_IDS) {
        const detailPath = join(DIST_DIR, 'runs', id, 'detail.html');
        assert.ok(existsSync(detailPath), `detail.html must exist for ${id}`);
        const stat = statSync(detailPath);
        assert.ok(stat.size > 5000, `detail.html for ${id} must be > 5KB (was ${stat.size} bytes)`);
      }
    });

    it('1.2 should verify every detail page contains the 5 dimensional sections in exact sequential DOM order', () => {
      const requiredSections = [
        'detail-positioning',
        'detail-visuals',
        'detail-differences',
        'detail-preview',
        'detail-evidence',
      ];

      for (const id of ALL_PROJECT_IDS) {
        const html = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        let lastIndex = -1;

        for (const secClass of requiredSections) {
          const secRegex = new RegExp(`<section\\b[^>]*\\bclass=["'][^"']*${secClass}[^"']*["']`, 'i');
          const match = secRegex.exec(html);
          assert.ok(match, `Project ${id} must contain section .${secClass}`);
          const index = match.index;
          assert.ok(
            index > lastIndex,
            `Project ${id}: section .${secClass} (pos ${index}) must appear after previous section (pos ${lastIndex})`,
          );
          lastIndex = index;
        }
      }
    });

    it('1.3 should verify editor maintenance prompt is completely removed from all 10 detail pages (F18)', () => {
      for (const id of ALL_PROJECT_IDS) {
        const html = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        assert.doesNotMatch(
          html,
          /编辑\s*runs\/.*\/review\.md\s*后重新构建即可更新/i,
          `Project ${id} must not contain editor maintenance prompt (F18)`,
        );
      }
    });
  });

  // =========================================================================
  // Suite 2: Strict AST & Regex Verification for <details> and <summary> (F16, F22)
  // =========================================================================
  describe('Suite 2: Strict AST & Regex Verification for <details> and <summary> (F16, F22)', () => {
    it('2.1 should ensure every single <details> element has <summary> as its immediate first child', () => {
      let totalDetailsCount = 0;

      for (const id of ALL_PROJECT_IDS) {
        const html = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        const detailsMatches = findTags(html, 'details');

        assert.ok(
          detailsMatches.length >= 3,
          `Project ${id} must have at least 3 <details> accordions (found ${detailsMatches.length})`,
        );

        detailsMatches.forEach((det, idx) => {
          totalDetailsCount++;
          const content = det.content;

          // Strict immediate first-child check:
          // Nothing except optional whitespace/newlines can exist before <summary>
          assert.match(
            content,
            /^\s*<summary\b/i,
            `Project ${id} accordion #${idx + 1} MUST have <summary> as its immediate first child! Found leading content: ${JSON.stringify(content.slice(0, 40))}`,
          );

          // Verify no text nodes or other tags precede <summary>
          const beforeSummary = content.substring(0, content.indexOf('<summary'));
          assert.strictEqual(
            beforeSummary.trim(),
            '',
            `Project ${id} accordion #${idx + 1} has non-whitespace content before <summary>`,
          );

          // Verify summary has valid closing tag
          assert.match(
            content,
            /<\/summary>/i,
            `Project ${id} accordion #${idx + 1} <summary> must be properly closed with </summary>`,
          );

          // Verify only ONE <summary> exists in this <details> element
          const summaryCount = (content.match(/<summary\b/gi) || []).length;
          assert.strictEqual(
            summaryCount,
            1,
            `Project ${id} accordion #${idx + 1} must contain exactly 1 <summary> tag (found ${summaryCount})`,
          );
        });
      }

      assert.strictEqual(totalDetailsCount, 30, 'Total <details> across 10 pages must be exactly 30 (3 per page)');
    });

    it('2.2 should verify semantic contents and accessibility attributes of <summary> elements', () => {
      for (const id of ALL_PROJECT_IDS) {
        const html = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        const summaries = findTags(html, 'summary');

        assert.strictEqual(summaries.length, 3, `Project ${id} must contain exactly 3 <summary> elements`);

        for (const s of summaries) {
          // Class check
          assert.ok(
            (s.attrs.class || '').includes('accordion-summary'),
            `Project ${id} <summary> must include class "accordion-summary"`,
          );

          // Non-empty title check
          assert.match(
            s.content,
            /<span class=["'][^"']*accordion-title[^"']*["']>[^<]+<\/span>/i,
            `Project ${id} <summary> must include non-empty .accordion-title`,
          );

          // Non-empty hint check
          assert.match(
            s.content,
            /<span class=["'][^"']*accordion-hint[^"']*["']>[^<]+<\/span>/i,
            `Project ${id} <summary> must include non-empty .accordion-hint`,
          );
        }
      }
    });

    it('2.3 should verify interactive accordion summaries receive keyboard focus-visible styling in CSS', () => {
      const css = readFile(join(DIST_DIR, 'style.css'));

      // Check :focus-visible rule specifically for accordion summaries
      const hasSummaryFocus =
        /\.accordion-summary:focus-visible/i.test(css) ||
        /summary:focus-visible/i.test(css) ||
        /\.details-accordion summary:focus-visible/i.test(css);

      assert.ok(hasSummaryFocus, 'style.css must define :focus-visible styling for accordion summary');

      // Check outline or box-shadow styling in summary focus
      const focusBlockMatch = css.match(/(?:(?:\.accordion-summary|summary):focus-visible[\s\S]*?\{[\s\S]*?\})/i);
      assert.ok(focusBlockMatch, 'Must find focus-visible CSS rule block');
      assert.ok(
        /outline|box-shadow/i.test(focusBlockMatch[0]),
        'focus-visible rule must provide distinct outline or box-shadow for keyboard accessibility',
      );
    });
  });

  // =========================================================================
  // Suite 3: Standalone Preview Launchers & Relative Links (F17)
  // =========================================================================
  describe('Suite 3: Standalone Preview Launchers & File Targets (F17)', () => {
    it('3.1 should verify V3 and V2 preview launcher buttons have explicit 1440px and 390px annotations', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailHtml = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        const previewSecMatch = detailHtml.match(/<section class=["'][^"']*detail-preview[^"']*["'][\s\S]*?<\/section>/i);
        assert.ok(previewSecMatch, `Project ${id} must contain .detail-preview section`);
        const secHtml = previewSecMatch[0];

        // 1440px desktop button annotations
        assert.match(secHtml, /1440px\s*桌面视口/i, `Project ${id} must annotate 1440px desktop viewport`);

        // 390px mobile button annotations
        assert.match(secHtml, /390px\s*视口/i, `Project ${id} must annotate 390px mobile viewport`);

        // Both primary and outline button styles
        assert.match(secHtml, /button-primary/i, `Project ${id} must have .button-primary`);
        assert.match(secHtml, /button-outline/i, `Project ${id} must have .button-outline`);
      }
    });

    it('3.2 should resolve and verify all V3 preview links point to existing files on disk', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailDir = join(DIST_DIR, 'runs', id);
        const detailHtml = readFile(join(detailDir, 'detail.html'));

        // Expected relative URL
        const expectedRel = `../../v3/runs/${id}/index.html`;
        assert.ok(
          detailHtml.includes(expectedRel),
          `Project ${id} detail.html must include link to ${expectedRel}`,
        );

        // Resolve relative URL from detail.html's directory
        const resolvedPath = resolve(detailDir, expectedRel);
        assert.ok(
          existsSync(resolvedPath),
          `Resolved V3 preview target file must exist on disk: ${resolvedPath}`,
        );

        const stat = statSync(resolvedPath);
        assert.ok(
          stat.size > 100,
          `V3 preview target for ${id} must be a valid non-empty file (size was ${stat.size} bytes)`,
        );
      }
    });

    it('3.3 should resolve and verify all V2 preview links point to existing files on disk', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailDir = join(DIST_DIR, 'runs', id);
        const detailHtml = readFile(join(detailDir, 'detail.html'));

        // Expected relative URL
        const expectedRel = `../../v2/runs/${id}/index.html`;
        assert.ok(
          detailHtml.includes(expectedRel),
          `Project ${id} detail.html must include link to ${expectedRel}`,
        );

        // Resolve relative URL from detail.html's directory
        const resolvedPath = resolve(detailDir, expectedRel);
        assert.ok(
          existsSync(resolvedPath),
          `Resolved V2 preview target file must exist on disk: ${resolvedPath}`,
        );

        const stat = statSync(resolvedPath);
        assert.ok(
          stat.size > 100,
          `V2 preview target for ${id} must be a valid non-empty file (size was ${stat.size} bytes)`,
        );
      }
    });

    it('3.4 should verify all launcher anchors open safely in new window with target="_blank" and rel="noopener"', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailHtml = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        const launcherLinks = findTags(detailHtml, 'a').filter(a =>
          a.content.includes('1440px') || a.content.includes('390px') || a.content.includes('新窗口独立打开')
        );

        assert.ok(launcherLinks.length >= 4, `Project ${id} must have at least 4 launcher links (found ${launcherLinks.length})`);

        for (const link of launcherLinks) {
          assert.strictEqual(link.attrs.target, '_blank', `Launcher link must have target="_blank"`);
          assert.strictEqual(link.attrs.rel, 'noopener', `Launcher link must have rel="noopener"`);
        }
      }
    });

    it('3.5 should verify pager navigation links and return links have valid targets', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailDir = join(DIST_DIR, 'runs', id);
        const detailHtml = readFile(join(detailDir, 'detail.html'));

        // Return link
        const returnLinkMatch = detailHtml.match(/<a\b[^>]*\bclass=["'][^"']*back[^"']*["'][^>]*>/i);
        assert.ok(returnLinkMatch, `Project ${id} must have return link`);
        const returnAttrs = extractAttrs(returnLinkMatch[0]);
        assert.strictEqual(returnAttrs.href, '../../index.html', `Return link must target ../../index.html`);
        assert.strictEqual(returnAttrs['data-back'], 'true', `Return link must have data-back="true"`);

        // Pager links
        const pagerMatch = detailHtml.match(/<span class=["']pager["']>([\s\S]*?)<\/span>/i);
        assert.ok(pagerMatch, `Project ${id} must contain pager span`);
        const pagerLinks = findTags(pagerMatch[0], 'a');
        for (const pl of pagerLinks) {
          const resolvedPagerTarget = resolve(detailDir, pl.attrs.href.split('?')[0]);
          assert.ok(
            existsSync(resolvedPagerTarget),
            `Pager link target must exist: ${resolvedPagerTarget} (from ${pl.attrs.href})`,
          );
        }
      }
    });
  });

  // =========================================================================
  // Suite 4: Screenshot Image Source Path & Asset Verification
  // =========================================================================
  describe('Suite 4: Screenshot Image Source Path & Asset Verification', () => {
    it('4.1 should verify V3 and V2 desktop screenshot image files exist on disk with valid file size', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailDir = join(DIST_DIR, 'runs', id);
        const detailHtml = readFile(join(detailDir, 'detail.html'));

        // V3 Image check
        const v3ImgRel = `../../v3/runs/${id}/shot-desktop.png`;
        assert.ok(detailHtml.includes(v3ImgRel), `Project ${id} must reference ${v3ImgRel}`);
        const v3ImgPath = resolve(detailDir, v3ImgRel);
        assert.ok(existsSync(v3ImgPath), `V3 image file must exist: ${v3ImgPath}`);
        const v3Stat = statSync(v3ImgPath);
        assert.ok(v3Stat.size > 10000, `V3 image must be > 10KB (was ${v3Stat.size})`);

        // V2 Image check
        const v2ImgRel = `../../v2/runs/${id}/shot-desktop.png`;
        assert.ok(detailHtml.includes(v2ImgRel), `Project ${id} must reference ${v2ImgRel}`);
        const v2ImgPath = resolve(detailDir, v2ImgRel);
        assert.ok(existsSync(v2ImgPath), `V2 image file must exist: ${v2ImgPath}`);
        const v2Stat = statSync(v2ImgPath);
        assert.ok(v2Stat.size > 10000, `V2 image must be > 10KB (was ${v2Stat.size})`);
      }
    });

    it('4.2 should verify screenshot <img> tags have loading="lazy" and descriptive alt attributes', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailHtml = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        const visualsMatch = detailHtml.match(/<section class=["'][^"']*detail-visuals[^"']*["'][\s\S]*?<\/section>/i);
        assert.ok(visualsMatch, `Project ${id} must have .detail-visuals`);

        const imgTags = visualsMatch[0].match(/<img\b[^>]*>/gi) || [];
        assert.strictEqual(imgTags.length, 2, `Project ${id} must contain 2 screenshot images in .detail-visuals`);

        for (const img of imgTags) {
          const attrs = extractAttrs(img);
          assert.strictEqual(attrs.loading, 'lazy', `Screenshot image must have loading="lazy"`);
          assert.ok(attrs.alt && attrs.alt.length > 5, `Screenshot image must have descriptive alt`);
          assert.ok(attrs.alt.includes(id), `Screenshot alt must include project id ${id}`);
        }
      }
    });

    it('4.3 should verify mobile visuals switcher contains accessible tablist attributes (F19, F22)', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailHtml = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        const switcherMatch = detailHtml.match(/<div\b[^>]*\bclass=["'][^"']*visuals-edition-switcher[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        assert.ok(switcherMatch, `Project ${id} must contain .visuals-edition-switcher`);

        const openingTag = switcherMatch[0].match(/<[^>]+>/)[0];
        const switcherAttrs = extractAttrs(openingTag);
        assert.strictEqual(switcherAttrs.role, 'tablist', 'Switcher must have role="tablist"');

        const buttons = findTags(switcherMatch[1], 'button');
        assert.strictEqual(buttons.length, 2, `Switcher must have 2 buttons`);

        for (const btn of buttons) {
          assert.strictEqual(btn.attrs.type, 'button', 'Switcher tab must have type="button"');
          assert.strictEqual(btn.attrs.role, 'tab', 'Switcher tab must have role="tab"');
          assert.ok(
            btn.attrs['aria-selected'] === 'true' || btn.attrs['aria-selected'] === 'false',
            'Switcher tab must have aria-selected="true|false"',
          );
        }
      }
    });
  });

  // =========================================================================
  // Suite 5: Embedded Preview Iframe Accessibility & Lazy Loading (F17, F22)
  // =========================================================================
  describe('Suite 5: Embedded Preview Iframe Accessibility & Lazy Loading (F17, F22)', () => {
    it('5.1 should verify every detail page has exactly one inline preview iframe with title and loading="lazy"', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailDir = join(DIST_DIR, 'runs', id);
        const detailHtml = readFile(join(detailDir, 'detail.html'));

        const iframes = detailHtml.match(/<iframe\b[^>]*>/gi) || [];
        assert.strictEqual(
          iframes.length,
          1,
          `Project ${id} must contain exactly 1 <iframe> element (found ${iframes.length})`,
        );

        const iframeTag = iframes[0];
        const attrs = extractAttrs(iframeTag);

        // title attribute
        assert.ok(
          attrs.title && attrs.title.trim().length > 0,
          `Project ${id} <iframe> must have a non-empty title attribute for accessibility`,
        );
        assert.ok(
          attrs.title.includes(id),
          `Project ${id} <iframe> title should mention project ID`,
        );

        // loading="lazy"
        assert.strictEqual(
          attrs.loading,
          'lazy',
          `Project ${id} <iframe> must have loading="lazy"`,
        );

        // valid src target
        assert.ok(
          attrs.src && attrs.src.includes(`../../v3/runs/${id}/index.html`),
          `Project ${id} <iframe> src must point to ../../v3/runs/${id}/index.html`,
        );

        // target file existence
        const resolvedIframeSrc = resolve(detailDir, attrs.src);
        assert.ok(
          existsSync(resolvedIframeSrc),
          `Iframe target file must exist: ${resolvedIframeSrc}`,
        );
      }
    });
  });

  // =========================================================================
  // Suite 6: Prompt & Log Content HTML Escaping & XSS Protection
  // =========================================================================
  describe('Suite 6: Prompt & Log Content HTML Escaping & XSS Protection', () => {
    it('6.1 should verify all 10 detail pages contain 4 code blocks inside .detail-evidence', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailHtml = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        const evidenceMatch = detailHtml.match(/<section class=["'][^"']*detail-evidence[^"']*["'][\s\S]*?<\/section>/i);
        assert.ok(evidenceMatch, `Project ${id} must have .detail-evidence`);

        const codeBlocks = evidenceMatch[0].match(/<pre class=["'][^"']*code-block[^"']*["'][^>]*><code>[\s\S]*?<\/code><\/pre>/gi) || [];
        assert.strictEqual(
          codeBlocks.length,
          4,
          `Project ${id} must have 4 code blocks (V3 prompt, V2 prompt, V3 log, V2 log)`,
        );

        for (const block of codeBlocks) {
          // Verify tabindex="0" for keyboard scroll accessibility
          assert.match(
            block,
            /\btabindex=["']0["']/i,
            `Code block must have tabindex="0" so keyboard users can scroll through long logs`,
          );
        }
      }
    });

    it('6.2 should verify no unescaped <script> or HTML tags exist inside .detail-evidence', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailHtml = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        const evidenceMatch = detailHtml.match(/<section class=["'][^"']*detail-evidence[^"']*["'][\s\S]*?<\/section>/i);
        assert.ok(evidenceMatch, `Project ${id} must have .detail-evidence`);
        const evidenceHtml = evidenceMatch[0];

        // Ensure zero script tags in evidence section
        assert.doesNotMatch(
          evidenceHtml,
          /<script\b/i,
          `Project ${id} .detail-evidence MUST NOT contain any unescaped <script> tags`,
        );

        // Check code blocks specifically for unescaped HTML elements
        const codeBlocks = evidenceHtml.match(/<code>([\s\S]*?)<\/code>/gi) || [];
        for (const cb of codeBlocks) {
          assert.doesNotMatch(
            cb,
            /<script\b|<iframe\b|<img\s+src=[^>]*onerror/i,
            `Code block in ${id} must not contain unescaped executable elements`,
          );
        }
      }
    });

    it('6.3 should verify that raw prompt/log text containing special characters (<, >, &, ") is strictly escaped', () => {
      // Find projects where source logs contain special chars
      for (const id of ALL_PROJECT_IDS) {
        for (const edition of ['2026-10-29-r2', '2026-10-29-r3']) {
          const logPath = join(REPO_ROOT, 'runs', edition, id, 'run.log');
          if (!existsSync(logPath)) continue;

          const rawLog = readFileSync(logPath, 'utf8');
          if (rawLog.includes('"') || rawLog.includes('<') || rawLog.includes('>')) {
            const detailHtml = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));

            // If raw log has href="#" or similar quote, HTML should contain &quot;
            if (rawLog.includes('href="#"')) {
              assert.ok(
                detailHtml.includes('href=&quot;#&quot;'),
                `Project ${id} log containing 'href="#"' must be escaped to 'href=&quot;#&quot;'`,
              );
            }
          }
        }
      }
    });

    it('6.4 should verify escaping oracle neutralizing adversarial vectors', () => {
      // Direct adversarial oracle test
      const adversarialVectors = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        '<svg/onload=alert`1`>',
        '"><script>alert(document.domain)</script>',
        "';alert(String.fromCharCode(88,83,83))//",
      ];

      // Use same escape logic defined in builder
      const esc = (value) =>
        String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      for (const vec of adversarialVectors) {
        const escaped = esc(vec);
        assert.doesNotMatch(escaped, /<script\b/i);
        assert.doesNotMatch(escaped, /<img\b/i);
        assert.doesNotMatch(escaped, /<svg\b/i);
        assert.ok(!escaped.includes('<') && !escaped.includes('>'));
      }
    });
  });

  // =========================================================================
  // Suite 7: Zero Occurrences of undefined and null in Rendered HTML Output
  // =========================================================================
  describe('Suite 7: Zero Occurrences of undefined and null (Template String Sanitization)', () => {
    it('7.1 should assert literal string "undefined" NEVER appears anywhere in any detail page', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailHtml = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        const hasUndefined = detailHtml.includes('undefined');
        if (hasUndefined) {
          // Find context of undefined
          const idx = detailHtml.indexOf('undefined');
          const snippet = detailHtml.substring(Math.max(0, idx - 40), Math.min(detailHtml.length, idx + 60));
          assert.fail(`Project ${id} detail.html contains "undefined"! Snippet: ${snippet}`);
        }
        assert.strictEqual(hasUndefined, false, `Project ${id} must not contain "undefined"`);
      }
    });

    it('7.2 should assert word token "null" NEVER appears anywhere in any detail page', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailHtml = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        const nullMatches = detailHtml.match(/\bnull\b/i);
        if (nullMatches) {
          const idx = detailHtml.search(/\bnull\b/i);
          const snippet = detailHtml.substring(Math.max(0, idx - 40), Math.min(detailHtml.length, idx + 60));
          assert.fail(`Project ${id} detail.html contains literal "null"! Snippet: ${snippet}`);
        }
        assert.strictEqual(nullMatches, null, `Project ${id} must not contain literal "null"`);
      }
    });

    it('7.3 should assert "NaN" and "[object Object]" NEVER appear in any detail page', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailHtml = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        assert.ok(!detailHtml.includes('NaN'), `Project ${id} must not contain "NaN"`);
        assert.ok(!detailHtml.includes('[object Object]'), `Project ${id} must not contain "[object Object]"`);
      }
    });

    it('7.4 should assert no empty href="" or src="" attributes exist in any detail page', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailHtml = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));
        assert.doesNotMatch(
          detailHtml,
          /\b(?:href|src)=["']\s*["']/i,
          `Project ${id} detail.html must not contain empty href="" or src=""`,
        );
      }
    });
  });

  // =========================================================================
  // Suite 8: Adversarial Edge Cases & Specific Run Robustness
  // =========================================================================
  describe('Suite 8: Adversarial Edge Cases & Specific Run Robustness', () => {
    it('8.1 should verify 00-bare baseline handles non-skill status accurately', () => {
      const bareHtml = readFile(join(DIST_DIR, 'runs', '00-bare', 'detail.html'));

      // Metric table must show "未安装 / 不适用" for read_skill
      assert.ok(
        bareHtml.includes('未安装 / 不适用'),
        '00-bare must display "未安装 / 不适用" for read_skill',
      );

      // Provenance section must display baseline positioning
      assert.ok(
        bareHtml.includes('纯模型默认系统能力基线') || bareHtml.includes('无 Skill 规范注入的基线生成'),
        '00-bare must state baseline positioning in provenance card',
      );
    });

    it('8.2 should verify 08-taste-skill interrupted run handles null exit without error', () => {
      const tasteHtml = readFile(join(DIST_DIR, 'runs', '08-taste-skill', 'detail.html'));

      // Check exit code display handles null/interrupted run gracefully
      assert.ok(
        tasteHtml.includes('会话中断') || tasteHtml.includes('无记录（会话中断）'),
        '08-taste-skill must indicate session interruption without null exit error',
      );

      // Both V2 and V3 preview launchers must be present
      assert.ok(tasteHtml.includes('../../v3/runs/08-taste-skill/index.html'));
      assert.ok(tasteHtml.includes('../../v2/runs/08-taste-skill/index.html'));
    });

    it('8.3 should verify 09-awesome-design-md renders without missing data errors', () => {
      const awesomeHtml = readFile(join(DIST_DIR, 'runs', '09-awesome-design-md', 'detail.html'));

      // Check all 5 sections exist
      assert.ok(awesomeHtml.includes('detail-positioning'));
      assert.ok(awesomeHtml.includes('detail-visuals'));
      assert.ok(awesomeHtml.includes('detail-differences'));
      assert.ok(awesomeHtml.includes('detail-preview'));
      assert.ok(awesomeHtml.includes('detail-evidence'));

      // Accordions exist
      const detailsCount = (awesomeHtml.match(/<details\b/gi) || []).length;
      assert.strictEqual(detailsCount, 3, '09-awesome-design-md must have 3 accordions');
    });

    it('8.4 should verify detail page client scripts handle popstate and mobile switcher without errors', () => {
      for (const id of ALL_PROJECT_IDS) {
        const detailHtml = readFile(join(DIST_DIR, 'runs', id, 'detail.html'));

        // Script block presence
        const scriptMatch = detailHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i);
        assert.ok(scriptMatch, `Project ${id} must contain inline script block before </body>`);
        const scriptContent = scriptMatch[1];

        // Preserves search params in back link
        assert.ok(scriptContent.includes('location.search') || scriptContent.includes('data-back'), 'Script must preserve query params');

        // Handles mobile switcher click event
        assert.ok(scriptContent.includes('visuals-edition-switcher') || scriptContent.includes('data-visual-target'), 'Script must handle tab switching');
      }
    });
  });

});
