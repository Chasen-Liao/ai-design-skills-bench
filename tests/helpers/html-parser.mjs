// tests/helpers/html-parser.mjs
// Lightweight, zero-dependency HTML & CSS inspection utilities for Node.js E2E tests.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '../..');
export const DIST_DIR = join(REPO_ROOT, 'site', 'dist');

/**
 * Read text content of a file. Returns null if missing.
 */
export function readFileSafe(filePath) {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf8');
}

/**
 * Strip HTML tags and normalize whitespace.
 */
export function getText(htmlSnippet) {
  if (!htmlSnippet) return '';
  return htmlSnippet
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract attribute key-value pairs from an opening tag string (e.g. `<div id="foo" class="bar">`).
 */
export function extractAttributes(openingTag) {
  const attrs = {};
  const attrRegex = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  // Skip the tag name
  const stripped = openingTag.replace(/^<[a-zA-Z0-9_-]+\s*/, '');
  while ((match = attrRegex.exec(stripped)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[key] = value;
  }
  return attrs;
}

/**
 * Find elements matching a tag name. Returns objects with `{ tag, full, open, content, attrs }`.
 */
export function findElementsByTag(html, tagName) {
  const elements = [];
  const regex = new RegExp(`<(${tagName})\\b([^>]*)>([\\s\\S]*?)<\\/\\1>`, 'gi');
  let match;
  while ((match = regex.exec(html)) !== null) {
    elements.push({
      tag: match[1],
      full: match[0],
      open: `<${match[1]}${match[2]}>`,
      attrs: extractAttributes(`<${match[1]}${match[2]}>`),
      content: match[3],
      text: getText(match[3]),
    });
  }
  // Also support self-closing / void elements if no match
  if (elements.length === 0) {
    const voidRegex = new RegExp(`<(${tagName})\\b([^>]*)\\/?>`, 'gi');
    while ((match = voidRegex.exec(html)) !== null) {
      elements.push({
        tag: match[1],
        full: match[0],
        open: match[0],
        attrs: extractAttributes(match[0]),
        content: '',
        text: '',
      });
    }
  }
  return elements;
}

/**
 * Find element by ID attribute.
 */
export function findElementById(html, id) {
  const regex = new RegExp(`<([a-zA-Z0-9_-]+)\\b([^>]*\\bid=["']${id}["'][^>]*)>([\\s\\S]*?)<\\/\\1>`, 'i');
  const match = regex.exec(html);
  if (!match) return null;
  return {
    tag: match[1],
    full: match[0],
    open: `<${match[1]}${match[2]}>`,
    attrs: extractAttributes(`<${match[1]}${match[2]}>`),
    content: match[3],
    text: getText(match[3]),
  };
}

/**
 * Find elements with a specific CSS class.
 */
export function findElementsByClass(html, className) {
  const elements = [];
  const regex = new RegExp(`<([a-zA-Z0-9_-]+)\\b([^>]*\\bclass=["'][^"']*\\b${className}\\b[^"']*["'][^>]*)>([\\s\\S]*?)<\\/\\1>`, 'gi');
  let match;
  while ((match = regex.exec(html)) !== null) {
    elements.push({
      tag: match[1],
      full: match[0],
      open: `<${match[1]}${match[2]}>`,
      attrs: extractAttributes(`<${match[1]}${match[2]}>`),
      content: match[3],
      text: getText(match[3]),
    });
  }
  return elements;
}

/**
 * Parse CSS into rule blocks and media query sections.
 */
export function inspectCss(cssText) {
  return {
    raw: cssText,
    hasVariable: (varName) => cssText.includes(varName),
    hasSelector: (selector) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`${escaped}\\s*\\{`, 'i').test(cssText);
    },
    hasMediaQuery: (queryPattern) => {
      const escaped = queryPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`@media[^{]*${escaped}`, 'i').test(cssText);
    },
  };
}
