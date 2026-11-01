// tests/challenger-m5-link-audit.test.mjs
// Milestone 5 Phase 1: Comprehensive Static Link Crawler & Link Integrity Audit
// Author: Challenger M5-1

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Robust repository root resolution
const REPO_ROOT = fs.existsSync(path.join(process.cwd(), 'site', 'dist'))
  ? process.cwd()
  : path.resolve(import.meta.dirname, '..');
const DIST_DIR = path.join(REPO_ROOT, 'site', 'dist');

const EXPECTED_PROJECT_IDS = [
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
 * Recursively find all HTML files in a directory
 */
function findAllHtmlFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findAllHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Strip script and style blocks so client-side JS string concatenation
 * is not falsely matched as DOM element markup.
 */
function stripScriptsAndStyles(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

/**
 * Extract target URLs from an HTML string for given tag and attribute.
 */
function extractAttributes(html, tag, attr) {
  const regex = new RegExp(`<${tag}\\b[^>]*?\\b${attr}\\s*=\\s*["']([^"']*)["'][^>]*>`, 'gi');
  const matches = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.push({
      raw: match[0],
      url: match[1].trim(),
      tag,
      attr,
      index: match.index,
    });
  }
  return matches;
}

/**
 * Resolve and validate internal link target
 */
function resolveInternalLink(sourceHtmlFile, rawUrl) {
  if (!rawUrl || rawUrl.trim() === '') {
    return { type: 'empty', valid: false, error: 'Empty URL attribute' };
  }

  // Non-HTTP protocols
  if (/^(mailto:|tel:|javascript:|data:|blob:)/i.test(rawUrl)) {
    return { type: 'protocol', valid: true, protocol: rawUrl.split(':')[0] };
  }

  // Pure in-page hash
  if (rawUrl.startsWith('#')) {
    return { type: 'hash', valid: true, hash: rawUrl };
  }

  // External URLs
  if (/^[a-z]+:\/\//i.test(rawUrl) || rawUrl.startsWith('//')) {
    return { type: 'external', valid: true, url: rawUrl };
  }

  // Strip query parameters and fragment identifier
  const cleanPath = rawUrl.split(/[?#]/)[0];

  // If URL only had query or hash (e.g. "?edition=v3" or "?task=portfolio")
  if (!cleanPath) {
    return {
      type: 'self-query',
      valid: true,
      resolvedPath: sourceHtmlFile,
      exists: fs.existsSync(sourceHtmlFile),
    };
  }

  const sourceDir = path.dirname(sourceHtmlFile);
  let resolvedPath;
  if (cleanPath.startsWith('/')) {
    // Root-relative against DIST_DIR
    resolvedPath = path.resolve(DIST_DIR, cleanPath.slice(1));
  } else {
    // Relative to source file directory
    resolvedPath = path.resolve(sourceDir, cleanPath);
  }

  let exists = fs.existsSync(resolvedPath);
  let isDirectory = false;
  if (exists) {
    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      isDirectory = true;
      const dirIndex = path.join(resolvedPath, 'index.html');
      if (fs.existsSync(dirIndex)) {
        resolvedPath = dirIndex;
      } else {
        exists = false;
      }
    }
  }

  return {
    type: 'internal',
    valid: exists,
    cleanPath,
    resolvedPath,
    exists,
    isDirectory,
  };
}

describe('Challenger M5-1: Comprehensive Static Link Crawler & Link Integrity Audit', () => {

  describe('1. HTML Distribution Inventory (All 52 HTML Files)', () => {
    it('should confirm site/dist exists as a directory', () => {
      assert.ok(fs.existsSync(DIST_DIR), `DIST_DIR does not exist: ${DIST_DIR}`);
      assert.ok(fs.statSync(DIST_DIR).isDirectory(), 'DIST_DIR is not a directory');
    });

    it('should discover exactly 52 generated HTML files in site/dist', () => {
      const htmlFiles = findAllHtmlFiles(DIST_DIR);
      assert.strictEqual(
        htmlFiles.length,
        52,
        `Expected exactly 52 HTML files in site/dist, but found ${htmlFiles.length}`
      );
    });

    it('should verify all 52 expected HTML files exist on disk', () => {
      const expectedPaths = [
        path.join(DIST_DIR, 'index.html'),
        path.join(DIST_DIR, 'compare.html'),
      ];

      for (const id of EXPECTED_PROJECT_IDS) {
        expectedPaths.push(path.join(DIST_DIR, 'runs', id, 'detail.html'));
        expectedPaths.push(path.join(DIST_DIR, 'v2', 'runs', id, 'detail.html'));
        expectedPaths.push(path.join(DIST_DIR, 'v2', 'runs', id, 'index.html'));
        expectedPaths.push(path.join(DIST_DIR, 'v3', 'runs', id, 'detail.html'));
        expectedPaths.push(path.join(DIST_DIR, 'v3', 'runs', id, 'index.html'));
      }

      assert.strictEqual(expectedPaths.length, 52);
      for (const p of expectedPaths) {
        assert.ok(fs.existsSync(p), `Missing expected HTML file: ${p}`);
      }
    });
  });

  describe('2. Comprehensive Link Crawler & Zero Broken Links Assertion', () => {
    it('should crawl all 52 HTML files and verify 100% of internal links resolve to existing files (0 broken links)', () => {
      const htmlFiles = findAllHtmlFiles(DIST_DIR);
      let totalExtracted = 0;
      let internalChecked = 0;
      const brokenLinks = [];

      for (const file of htmlFiles) {
        const rawContent = fs.readFileSync(file, 'utf8');
        const relFilePath = path.relative(DIST_DIR, file).replace(/\\/g, '/');

        // Check script tags src
        const scriptTags = extractAttributes(rawContent, 'script', 'src');
        for (const s of scriptTags) {
          totalExtracted++;
          const res = resolveInternalLink(file, s.url);
          if (res.type === 'internal') {
            internalChecked++;
            if (!res.valid) {
              brokenLinks.push({ file: relFilePath, tag: 'script', attr: 'src', url: s.url });
            }
          }
        }

        // Clean DOM markup by stripping script and style contents
        const domContent = stripScriptsAndStyles(rawContent);

        const tagConfigs = [
          { tag: 'a', attr: 'href' },
          { tag: 'img', attr: 'src' },
          { tag: 'link', attr: 'href' },
          { tag: 'iframe', attr: 'src' },
        ];

        for (const { tag, attr } of tagConfigs) {
          const links = extractAttributes(domContent, tag, attr);
          totalExtracted += links.length;

          for (const item of links) {
            const resolution = resolveInternalLink(file, item.url);

            if (resolution.type === 'empty') {
              brokenLinks.push({
                file: relFilePath,
                tag,
                attr,
                url: item.url,
                reason: 'Empty URL attribute',
              });
            } else if (resolution.type === 'internal') {
              internalChecked++;
              if (!resolution.valid) {
                brokenLinks.push({
                  file: relFilePath,
                  tag,
                  attr,
                  url: item.url,
                  cleanPath: resolution.cleanPath,
                  resolvedPath: resolution.resolvedPath,
                  reason: 'Target file does not exist on disk',
                });
              }
            }
          }
        }
      }

      console.log(`[Crawler Audit] Audited ${htmlFiles.length} HTML files.`);
      console.log(`[Crawler Audit] Extracted ${totalExtracted} total attributes.`);
      console.log(`[Crawler Audit] Verified ${internalChecked} internal links/assets.`);
      console.log(`[Crawler Audit] Broken links detected: ${brokenLinks.length}`);

      assert.ok(totalExtracted >= 900, `Total extracted links too low: ${totalExtracted}`);
      assert.ok(internalChecked >= 300, `Internal checked links too low: ${internalChecked}`);
      assert.strictEqual(
        brokenLinks.length,
        0,
        `Detected ${brokenLinks.length} broken links across site/dist: ${JSON.stringify(brokenLinks.slice(0, 5), null, 2)}`
      );
    });
  });

  describe('3. Specialized Asset & Element Audits', () => {
    it('should assert 100% of <img src> in DOM point to non-empty image files', () => {
      const htmlFiles = findAllHtmlFiles(DIST_DIR);
      let imgCount = 0;

      for (const file of htmlFiles) {
        const domContent = stripScriptsAndStyles(fs.readFileSync(file, 'utf8'));
        const imgs = extractAttributes(domContent, 'img', 'src');

        for (const img of imgs) {
          const resolution = resolveInternalLink(file, img.url);
          if (resolution.type === 'internal') {
            imgCount++;
            assert.ok(resolution.exists, `Image missing: ${img.url} in ${file}`);
            const stat = fs.statSync(resolution.resolvedPath);
            assert.ok(stat.isFile(), `Image target is not a file: ${resolution.resolvedPath}`);
            assert.ok(stat.size > 0, `Image file is 0 bytes: ${resolution.resolvedPath}`);
          }
        }
      }

      assert.ok(imgCount >= 40, `Expected at least 40 images, got ${imgCount}`);
    });

    it('should assert 100% of <iframe src> point to valid preview HTML files and include accessibility attributes', () => {
      const htmlFiles = findAllHtmlFiles(DIST_DIR);
      let iframeCount = 0;

      for (const file of htmlFiles) {
        const domContent = stripScriptsAndStyles(fs.readFileSync(file, 'utf8'));
        const iframes = extractAttributes(domContent, 'iframe', 'src');

        for (const iframe of iframes) {
          iframeCount++;
          const resolution = resolveInternalLink(file, iframe.url);
          assert.strictEqual(
            resolution.type,
            'internal',
            `Iframe src should be internal preview: ${iframe.url}`
          );
          assert.ok(resolution.exists, `Iframe target missing: ${iframe.url} in ${file}`);

          // Accessibility check: must have title and loading="lazy"
          assert.match(iframe.raw, /title=["'][^"']+["']/i, `Iframe missing title in ${file}`);
          assert.match(iframe.raw, /loading=["']lazy["']/i, `Iframe missing loading="lazy" in ${file}`);
        }
      }

      assert.strictEqual(iframeCount, 10, `Expected exactly 10 detail page preview iframes, got ${iframeCount}`);
    });

    it('should assert 100% of internal stylesheet <link href> point to existing css files', () => {
      const htmlFiles = findAllHtmlFiles(DIST_DIR);
      let internalCssLinks = 0;

      for (const file of htmlFiles) {
        const domContent = stripScriptsAndStyles(fs.readFileSync(file, 'utf8'));
        const links = extractAttributes(domContent, 'link', 'href');

        for (const link of links) {
          if (/rel=["']stylesheet["']/i.test(link.raw)) {
            const resolution = resolveInternalLink(file, link.url);
            if (resolution.type === 'internal') {
              internalCssLinks++;
              assert.ok(resolution.exists, `Stylesheet missing: ${link.url} in ${file}`);
              assert.ok(fs.statSync(resolution.resolvedPath).size > 0, `Stylesheet empty: ${resolution.resolvedPath}`);
            }
          }
        }
      }

      assert.ok(internalCssLinks >= 30, `Expected at least 30 internal stylesheet links, got ${internalCssLinks}`);
    });
  });

  describe('4. URL Sanitization & Path Integrity', () => {
    it('should assert zero undefined, null, NaN, or template literal leaks in any internal href or src', () => {
      const htmlFiles = findAllHtmlFiles(DIST_DIR);
      const tagConfigs = [
        { tag: 'a', attr: 'href' },
        { tag: 'img', attr: 'src' },
        { tag: 'link', attr: 'href' },
        { tag: 'iframe', attr: 'src' },
      ];

      for (const file of htmlFiles) {
        const domContent = stripScriptsAndStyles(fs.readFileSync(file, 'utf8'));
        for (const { tag, attr } of tagConfigs) {
          const items = extractAttributes(domContent, tag, attr);
          for (const item of items) {
            const val = item.url;
            // Skip data: URIs (base64 payloads may coincidentally contain substrings like 'NaN')
            if (val.startsWith('data:')) continue;

            assert.ok(!val.includes('undefined'), `Found "undefined" in ${tag} ${attr} in ${file}: ${val}`);
            assert.ok(!val.includes('null'), `Found "null" in ${tag} ${attr} in ${file}: ${val}`);
            assert.ok(!val.includes('NaN'), `Found "NaN" in ${tag} ${attr} in ${file}: ${val}`);
            assert.ok(!val.includes('[object Object]'), `Found "[object Object]" in ${tag} ${attr} in ${file}: ${val}`);
            assert.ok(!val.includes('${'), `Found unescaped template literal "\${" in ${tag} ${attr} in ${file}: ${val}`);
            assert.ok(!val.includes('\\'), `Found Windows backslash "\\" in ${tag} ${attr} in ${file}: ${val}`);
          }
        }
      }
    });

    it('should assert no empty href="" or src="" attributes exist in any HTML DOM', () => {
      const htmlFiles = findAllHtmlFiles(DIST_DIR);
      const emptyRegex = /<(a|img|link|iframe)\b[^>]*?\b(href|src)\s*=\s*["']\s*["'][^>]*>/i;

      for (const file of htmlFiles) {
        const domContent = stripScriptsAndStyles(fs.readFileSync(file, 'utf8'));
        const match = emptyRegex.exec(domContent);
        assert.strictEqual(
          match,
          null,
          `Found empty href/src in ${file}: ${match ? match[0] : ''}`
        );
      }
    });
  });

  describe('5. Cross-Page Navigation Graph Integrity', () => {
    it('should verify all cards in index.html link to physically existing detail pages', () => {
      const indexHtml = stripScriptsAndStyles(fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8'));
      const links = extractAttributes(indexHtml, 'a', 'href');
      const detailLinks = links.filter((l) => l.url.includes('runs/') && l.url.includes('detail.html'));

      // 20 cards (10 in V2, 10 in V3), each card has 4 detail links (thumb, title, and buttons)
      assert.strictEqual(detailLinks.length, 80, `Expected exactly 80 detail links on homepage (4 per card x 20 cards), got ${detailLinks.length}`);

      for (const item of detailLinks) {
        const resolution = resolveInternalLink(path.join(DIST_DIR, 'index.html'), item.url);
        assert.strictEqual(resolution.type, 'internal');
        assert.ok(resolution.exists, `Homepage card link broken: ${item.url}`);
      }
    });

    it('should verify every primary detail page provides a return link pointing to an existing index.html', () => {
      const detailFiles = EXPECTED_PROJECT_IDS.map((id) => path.join(DIST_DIR, 'runs', id, 'detail.html'));

      for (const file of detailFiles) {
        const content = stripScriptsAndStyles(fs.readFileSync(file, 'utf8'));
        const links = extractAttributes(content, 'a', 'href');
        const backLinks = links.filter((l) => l.url.includes('index.html'));

        assert.ok(
          backLinks.length > 0,
          `Detail page missing back link to index.html: ${file}`
        );

        for (const back of backLinks) {
          const resolution = resolveInternalLink(file, back.url);
          assert.strictEqual(resolution.type, 'internal');
          assert.ok(resolution.exists, `Back link in ${file} broken: ${back.url}`);
        }
      }
    });

    it('should verify all redirect shims link to valid destination detail pages', () => {
      const shimFiles = [
        ...EXPECTED_PROJECT_IDS.map((id) => path.join(DIST_DIR, 'v2', 'runs', id, 'detail.html')),
        ...EXPECTED_PROJECT_IDS.map((id) => path.join(DIST_DIR, 'v3', 'runs', id, 'detail.html')),
      ];

      for (const shim of shimFiles) {
        const content = fs.readFileSync(shim, 'utf8');
        const links = extractAttributes(content, 'a', 'href');
        assert.ok(links.length > 0, `Shim missing anchor link: ${shim}`);
        for (const link of links) {
          const res = resolveInternalLink(shim, link.url);
          assert.strictEqual(res.type, 'internal');
          assert.ok(res.exists, `Shim link broken in ${shim}: ${link.url}`);
        }
      }
    });

    it('should verify compare.html exists and links to valid detail pages and index.html', () => {
      const compareHtml = stripScriptsAndStyles(fs.readFileSync(path.join(DIST_DIR, 'compare.html'), 'utf8'));
      const links = extractAttributes(compareHtml, 'a', 'href');

      assert.ok(links.length > 0, 'compare.html must contain navigation links');
      for (const link of links) {
        const resolution = resolveInternalLink(path.join(DIST_DIR, 'compare.html'), link.url);
        if (resolution.type === 'internal') {
          assert.ok(resolution.exists, `Link in compare.html is broken: ${link.url}`);
        }
      }
    });
  });
});
