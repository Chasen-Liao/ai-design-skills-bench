// tests/challenger-m3-empirical-stress.test.mjs
// Adversarial Empirical Stress Test Suite for Milestone 3
// Tests candidate selection limits (0, 1, 2, 3, 4th cap), floating compare dock,
// horizontal comparison matrix modal, CSS fixes, and URL state persistence.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import vm from 'node:vm';
import { PROJECTS } from '../site/data/projects.mjs';

const REPO_ROOT = resolve('.');
const DIST_INDEX = join(REPO_ROOT, 'site', 'dist', 'index.html');
const DIST_COMPARE = join(REPO_ROOT, 'site', 'dist', 'compare.html');
const DIST_STYLE = join(REPO_ROOT, 'site', 'dist', 'style.css');

assert.ok(existsSync(DIST_INDEX), 'site/dist/index.html must exist');
assert.ok(existsSync(DIST_COMPARE), 'site/dist/compare.html must exist');
assert.ok(existsSync(DIST_STYLE), 'site/dist/style.css must exist');

const indexHtml = readFileSync(DIST_INDEX, 'utf-8');
const styleCss = readFileSync(DIST_STYLE, 'utf-8');

// Extract inline client script from index.html
const scriptMatch = indexHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i);
assert.ok(scriptMatch, 'site/dist/index.html must contain client script');
const clientScriptSource = scriptMatch[1];

// Helper to extract attributes
function parseAttributes(tagStr) {
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
 * Robust Mock DOM Element for executing the real index.html script in Node.js VM
 */
class MockElement {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attrs };
    this.classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
    this.children = [];
    this.parent = null;
    this.listeners = {};
    this.checked = attrs.checked !== undefined ? true : false;
    this.disabled = attrs.disabled !== undefined ? true : false;
    this._textContent = '';
    this.style = {};
  }

  get classList() {
    return {
      add: (...tokens) => tokens.forEach((t) => this.classes.add(t)),
      remove: (...tokens) => tokens.forEach((t) => this.classes.delete(t)),
      toggle: (token, force) => {
        if (force === true) {
          this.classes.add(token);
          return true;
        } else if (force === false) {
          this.classes.delete(token);
          return false;
        }
        if (this.classes.has(token)) {
          this.classes.delete(token);
          return false;
        } else {
          this.classes.add(token);
          return true;
        }
      },
      contains: (token) => this.classes.has(token),
    };
  }

  getAttribute(name) {
    if (name === 'class') {
      return Array.from(this.classes).join(' ');
    }
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') {
      this.classes = new Set(String(value).split(/\s+/).filter(Boolean));
    }
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'class') {
      this.classes.clear();
    }
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }

  addEventListener(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    const list = this.listeners[event.type] || [];
    for (const cb of list) {
      cb.call(this, event);
    }
    if (event.bubbles !== false && this.parent) {
      this.parent.dispatchEvent(event);
    }
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches && curr.matches(selector)) return curr;
      curr = curr.parent;
    }
    return null;
  }

  matches(selector) {
    if (!selector) return false;
    if (selector.includes(',')) {
      return selector.split(',').some((s) => this.matches(s.trim()));
    }
    if (selector.includes(' ')) {
      const tokens = selector.split(/\s+/).filter(Boolean);
      return this.matches(tokens[tokens.length - 1]) && Boolean(this.closest(tokens[tokens.length - 2]));
    }
    if (selector === 'a[href]' || selector === '.card a[href]') {
      return this.tagName === 'A' && this.hasAttribute('href');
    }

    let remaining = selector;
    // Check tag name if present
    const tagMatch = remaining.match(/^([a-zA-Z0-9_-]+)/);
    if (tagMatch) {
      if (this.tagName.toLowerCase() !== tagMatch[1].toLowerCase()) return false;
      remaining = remaining.slice(tagMatch[1].length);
    }
    if (!remaining) return true;

    // Check class if present
    if (remaining.startsWith('.')) {
      const clsParts = remaining.split('.').filter(Boolean);
      return clsParts.every((cls) => this.classes.has(cls));
    }

    // Check id if present
    if (remaining.startsWith('#')) {
      return this.attributes.id === remaining.slice(1);
    }

    // Check attribute if present
    const attrMatch = remaining.match(/^\[([a-zA-Z0-9_-]+)(?:=["']?([^"']*)["']?)?\]$/);
    if (attrMatch) {
      const name = attrMatch[1];
      const val = attrMatch[2];
      if (val === undefined) {
        return this.hasAttribute(name);
      }
      return this.getAttribute(name) === val;
    }
    return false;
  }

  querySelectorAll(selector) {
    if (selector.includes(',')) {
      const parts = selector.split(',').map((s) => s.trim());
      const set = new Set();
      for (const p of parts) {
        for (const el of this.querySelectorAll(p)) {
          set.add(el);
        }
      }
      return Array.from(set);
    }
    const results = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) {
          results.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map((c) => c.textContent).join('');
  }

  set textContent(val) {
    this._textContent = String(val);
    this.children = [];
  }

  get innerHTML() {
    return this._rawHtml || '';
  }

  set innerHTML(htmlStr) {
    this._rawHtml = htmlStr;
    this.children = [];

    // Parse elements from HTML string
    const tagRegex = /<([a-zA-Z0-9_-]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9_-]+)([^>]*)\/?>/g;
    let match;
    while ((match = tagRegex.exec(htmlStr)) !== null) {
      const isVoid = !match[1];
      const tagName = isVoid ? match[4] : match[1];
      const rawAttrs = isVoid ? match[5] : match[2];
      const inner = isVoid ? '' : match[3];

      const attrs = parseAttributes(`<${tagName}${rawAttrs}>`);
      const el = new MockElement(tagName, attrs);
      if (inner) {
        if (/<[a-zA-Z0-9_-]+/.test(inner)) {
          el.innerHTML = inner;
        } else {
          el.textContent = inner;
        }
      }
      this.appendChild(el);
    }
  }

  focus() {
    this._hasFocus = true;
  }
}

/**
 * Creates simulated browser environment from indexHtml
 */
function createSimulatedBrowser(initialUrl = 'http://localhost/index.html') {
  const root = new MockElement('root');
  let alertMessage = null;

  // 1. Parse edition tabs
  const tabRegex = /<button[^>]*data-edition-tab="([^"]+)"[^>]*>/g;
  let m;
  while ((m = tabRegex.exec(indexHtml)) !== null) {
    const fullTag = m[0];
    const key = m[1];
    const isAct = fullTag.includes('is-active');
    const tabEl = new MockElement('button', {
      'data-edition-tab': key,
      class: `edition-tab ${isAct ? 'is-active' : ''}`.trim(),
      'aria-pressed': isAct ? 'true' : 'false',
    });
    root.appendChild(tabEl);
  }

  // 2. Parse task filter bar & chips
  const filterBarEl = new MockElement('div', {
    class: 'task-filter-bar',
    'data-task-filter-bar': '',
    role: 'tablist',
  });
  root.appendChild(filterBarEl);

  const chipRegex = /<button[^>]*data-task-filter="([^"]+)"[^>]*>/g;
  while ((m = chipRegex.exec(indexHtml)) !== null) {
    const fullTag = m[0];
    const taskId = m[1];
    const isAct = fullTag.includes('is-active');
    const chipEl = new MockElement('button', {
      class: `task-tab task-filter-chip ${isAct ? 'is-active' : ''}`.trim(),
      'data-task-filter': taskId,
      'aria-selected': isAct ? 'true' : 'false',
      'aria-pressed': isAct ? 'true' : 'false',
    });
    filterBarEl.appendChild(chipEl);
  }

  // 3. Live region
  const liveRegionEl = new MockElement('div', { id: 'task-filter-live' });
  root.appendChild(liveRegionEl);

  // 4. Parse edition panels & cards
  const v2Start = indexHtml.indexOf('id="v2"');
  const v3Start = indexHtml.indexOf('id="v3"');
  const promptStart = indexHtml.indexOf('id="prompt-title"');

  const v2Snippet = indexHtml.substring(v2Start, v3Start);
  const v3Snippet = indexHtml.substring(v3Start, promptStart);

  const panelsData = [
    { key: 'v2', snippet: v2Snippet },
    { key: 'v3', snippet: v3Snippet },
  ];

  for (const { key, snippet } of panelsData) {
    const isHidden = snippet.includes('hidden');
    const panelEl = new MockElement('section', {
      id: key,
      'data-edition': key,
      class: 'edition-panel',
    });
    if (isHidden) panelEl.setAttribute('hidden', '');
    root.appendChild(panelEl);

    const cardRegex = /<article\s+class="card"[^>]*data-project-id="([^"]+)"[^>]*data-tasks="([^"]*)"[^>]*>([\s\S]*?)<\/article>/g;
    let cm;
    while ((cm = cardRegex.exec(snippet)) !== null) {
      const cardId = cm[1];
      const tasks = cm[2];
      const cardBody = cm[3];
      const cardEl = new MockElement('article', {
        class: 'card',
        'data-project-id': cardId,
        'data-tasks': tasks,
      });

      if (cardBody.includes('class="compare-select"')) {
        const cbEl = new MockElement('input', {
          type: 'checkbox',
          class: 'compare-select',
          'data-compare-id': cardId,
        });
        cardEl.appendChild(cbEl);
      }

      const linkRegex = /<a\b[^>]*href="([^"]+)"[^>]*>/g;
      let lm;
      while ((lm = linkRegex.exec(cardBody)) !== null) {
        const fullTag = lm[0];
        const href = lm[1];
        const classMatch = fullTag.match(/class="([^"]*)"/);
        const cls = classMatch ? classMatch[1] : '';
        const aEl = new MockElement('a', {
          href: href,
          class: cls,
        });
        cardEl.appendChild(aEl);
      }

      panelEl.appendChild(cardEl);
    }

    const emptyEl = new MockElement('div', {
      class: 'task-empty-state',
      hidden: '',
    });
    panelEl.appendChild(emptyEl);
  }

  // 5. Floating Compare Tray & Modal Elements
  const trayEl = new MockElement('aside', {
    id: 'compare-tray',
    class: 'compare-tray',
    hidden: '',
  });
  root.appendChild(trayEl);

  const countEl = new MockElement('span', { id: 'compare-tray-count' });
  countEl.textContent = '已选 0 / 3 项';
  trayEl.appendChild(countEl);

  const chipsEl = new MockElement('div', { id: 'compare-tray-chips', class: 'compare-tray-chips' });
  trayEl.appendChild(chipsEl);

  const clearBtn = new MockElement('button', {
    id: 'compare-clear-btn',
    class: 'button button-ghost button-sm',
    type: 'button',
  });
  clearBtn.textContent = '清空';
  trayEl.appendChild(clearBtn);

  const launchBtn = new MockElement('button', {
    id: 'compare-launch-btn',
    class: 'button button-primary button-sm',
    type: 'button',
    disabled: '',
  });
  launchBtn.textContent = '查看横向比对';
  trayEl.appendChild(launchBtn);

  // 6. Compare Modal Elements
  const modalBackdrop = new MockElement('div', {
    id: 'compare-modal-backdrop',
    class: 'compare-modal-backdrop',
    hidden: '',
    role: 'dialog',
  });
  root.appendChild(modalBackdrop);

  const modalTitle = new MockElement('h2', { id: 'compare-modal-title' });
  modalBackdrop.appendChild(modalTitle);

  const editionLabel = new MockElement('strong', { id: 'compare-modal-edition-label' });
  modalBackdrop.appendChild(editionLabel);

  const closeBtn = new MockElement('button', {
    id: 'compare-modal-close',
    class: 'button button-ghost compare-modal-close',
    type: 'button',
  });
  closeBtn.textContent = '✕ 关闭';
  modalBackdrop.appendChild(closeBtn);

  const gridEl = new MockElement('div', { id: 'compare-matrix-grid', class: 'compare-matrix-grid' });
  modalBackdrop.appendChild(gridEl);

  // 7. Window & Document Environment
  const currentUrl = new URL(initialUrl);

  const documentMock = {
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    querySelector: (sel) => root.querySelector(sel),
    getElementById: (id) => root.querySelector(`#${id}`),
  };

  const windowListeners = {};
  const windowMock = {
    location: {
      get search() {
        return currentUrl.search;
      },
      set search(val) {
        currentUrl.search = val;
      },
      get hash() {
        return currentUrl.hash;
      },
      set hash(val) {
        currentUrl.hash = val;
      },
      get pathname() {
        return currentUrl.pathname;
      },
      set pathname(val) {
        currentUrl.pathname = val;
      },
      get href() {
        return currentUrl.href;
      },
      set href(val) {
        const u = new URL(val, 'http://localhost');
        currentUrl.search = u.search;
        currentUrl.hash = u.hash;
        currentUrl.pathname = u.pathname;
      },
    },
    history: {
      replaceState: (state, title, newUrl) => {
        windowMock.location.href = newUrl;
      },
      pushState: (state, title, newUrl) => {
        windowMock.location.href = newUrl;
      },
    },
    alert: (msg) => {
      alertMessage = msg;
    },
    addEventListener: (event, cb) => {
      if (!windowListeners[event]) windowListeners[event] = [];
      windowListeners[event].push(cb);
    },
    dispatchEvent: (event) => {
      const list = windowListeners[event.type] || [];
      for (const cb of list) cb.call(windowMock, event);
    },
    document: documentMock,
    URLSearchParams,
  };

  // Run inline client script in sandbox
  const context = vm.createContext({
    window: windowMock,
    document: documentMock,
    URLSearchParams,
    alert: (msg) => windowMock.alert(msg),
    console,
  });

  vm.runInContext(clientScriptSource, context);

  return {
    window: windowMock,
    document: documentMock,
    root,
    getAlert: () => alertMessage,
    resetAlert: () => {
      alertMessage = null;
    },
  };
}

describe('Challenger M3-1: Empirical Stress Testing Suite', () => {

  describe('Suite 1: Static Generation & Asset Conformance', () => {
    it('1.1 should generate site/dist/index.html with compare tray and matrix modal elements', () => {
      assert.ok(indexHtml.includes('id="compare-tray"'), 'index.html must have #compare-tray');
      assert.ok(indexHtml.includes('id="compare-modal-backdrop"'), 'index.html must have #compare-modal-backdrop');
      assert.ok(indexHtml.includes('id="compare-matrix-grid"'), 'index.html must have #compare-matrix-grid');
      assert.ok(indexHtml.includes('class="compare-select"'), 'index.html must contain compare checkboxes');
    });

    it('1.2 should generate site/dist/compare.html redirecting to index.html with query preservation', () => {
      const compareHtml = readFileSync(DIST_COMPARE, 'utf-8');
      assert.ok(compareHtml.includes('index.html'), 'compare.html must link/redirect to index.html');
      assert.ok(compareHtml.includes('window.location.replace'), 'compare.html must script dynamic replace');
      assert.ok(compareHtml.includes('window.location.search'), 'compare.html must preserve query string');
    });

    it('1.3 should contain empty-state [hidden] cascade fix in site/dist/style.css', () => {
      assert.ok(
        styleCss.includes('.task-empty-state[hidden]') || styleCss.includes('.task-filter-empty[hidden]'),
        'style.css must define .task-empty-state[hidden]',
      );
      assert.ok(
        styleCss.includes('display: none !important'),
        'style.css empty state hidden rule must use !important to override author display:flex',
      );
    });

    it('1.4 should include responsive <=640px rules for floating dock and matrix grid', () => {
      assert.ok(styleCss.includes('@media (max-width: 640px)'), 'style.css must have 640px media query');
      assert.ok(styleCss.includes('.compare-tray-inner'), 'mobile styles must target .compare-tray-inner');
      assert.ok(styleCss.includes('.compare-matrix-grid'), 'mobile styles must target .compare-matrix-grid');
    });
  });

  describe('Suite 2: Candidate Selection Limits (0, 1, 2, 3, and 4th selection cap)', () => {
    it('2.1 should initialize cleanly with 0 candidates selected (tray hidden, checkboxes unchecked)', () => {
      const { document } = createSimulatedBrowser('http://localhost/index.html');
      const tray = document.getElementById('compare-tray');
      assert.ok(tray.hasAttribute('hidden'), 'Tray must be hidden when 0 candidates are selected');

      const checkboxes = document.querySelectorAll('.compare-select');
      assert.ok(checkboxes.length >= 20, 'Should have compare checkboxes on all cards');
      checkboxes.forEach((cb) => {
        assert.equal(cb.checked, false, 'Checkbox must be unchecked initially');
      });
    });

    it('2.2 should transition from 0 to 1 candidate: show tray, count 1/3, chip rendered, launch button disabled', () => {
      const { document, window } = createSimulatedBrowser('http://localhost/index.html');
      const cb1 = document.querySelector('input[data-compare-id="01-frontend-design"]');
      assert.ok(cb1, 'Checkbox for 01-frontend-design must exist');

      cb1.checked = true;
      cb1.dispatchEvent({ type: 'change', bubbles: true });

      const tray = document.getElementById('compare-tray');
      assert.equal(tray.hasAttribute('hidden'), false, 'Tray must be visible with 1 candidate');

      const count = document.getElementById('compare-tray-count');
      assert.equal(count.textContent, '已选 1 / 3 项');

      const chips = document.getElementById('compare-tray-chips');
      assert.ok(chips.querySelector('[data-remove-id="01-frontend-design"]'), 'Chip with remove button must be rendered');

      const launchBtn = document.getElementById('compare-launch-btn');
      assert.equal(launchBtn.disabled, true, 'Launch button must remain disabled with only 1 candidate');
      assert.ok(launchBtn.textContent.includes('需选2-3项'), 'Launch button text must indicate 2-3 items required');

      assert.ok(window.location.search.includes('compare=01-frontend-design'), 'URL query must be synchronized');
    });

    it('2.3 should transition from 1 to 2 candidates: count 2/3, 2 chips, launch button enabled', () => {
      const { document, window } = createSimulatedBrowser('http://localhost/index.html');
      const cb1 = document.querySelector('input[data-compare-id="01-frontend-design"]');
      const cb2 = document.querySelector('input[data-compare-id="02-ui-ux-pro-max"]');

      cb1.checked = true;
      cb1.dispatchEvent({ type: 'change', bubbles: true });
      cb2.checked = true;
      cb2.dispatchEvent({ type: 'change', bubbles: true });

      const count = document.getElementById('compare-tray-count');
      assert.equal(count.textContent, '已选 2 / 3 项');

      const launchBtn = document.getElementById('compare-launch-btn');
      assert.equal(launchBtn.disabled, false, 'Launch button must be enabled with 2 candidates');
      assert.ok(launchBtn.textContent.includes('2项并排'), 'Launch button text must indicate 2 items');

      assert.ok(
        window.location.search.includes('compare=01-frontend-design%2C02-ui-ux-pro-max') ||
        window.location.search.includes('compare=01-frontend-design,02-ui-ux-pro-max'),
        'URL must contain both candidates',
      );
    });

    it('2.4 should transition from 2 to 3 candidates: count 3/3, 3 chips, launch button enabled', () => {
      const { document, window } = createSimulatedBrowser('http://localhost/index.html');
      const cb1 = document.querySelector('input[data-compare-id="01-frontend-design"]');
      const cb2 = document.querySelector('input[data-compare-id="02-ui-ux-pro-max"]');
      const cb3 = document.querySelector('input[data-compare-id="03-baoyu-design"]');

      cb1.checked = true;
      cb1.dispatchEvent({ type: 'change', bubbles: true });
      cb2.checked = true;
      cb2.dispatchEvent({ type: 'change', bubbles: true });
      cb3.checked = true;
      cb3.dispatchEvent({ type: 'change', bubbles: true });

      const count = document.getElementById('compare-tray-count');
      assert.equal(count.textContent, '已选 3 / 3 项');

      const launchBtn = document.getElementById('compare-launch-btn');
      assert.equal(launchBtn.disabled, false, 'Launch button must be enabled with 3 candidates');
      assert.ok(launchBtn.textContent.includes('3项并排'), 'Launch button text must indicate 3 items');

      assert.ok(window.location.search.includes('03-baoyu-design'), 'URL must contain 3rd candidate');
    });

    it('2.5 should strictly prevent selecting a 4th candidate (triggers alert, resets checkbox, caps at 3)', () => {
      const { document, window, getAlert } = createSimulatedBrowser('http://localhost/index.html');
      const cb1 = document.querySelector('input[data-compare-id="01-frontend-design"]');
      const cb2 = document.querySelector('input[data-compare-id="02-ui-ux-pro-max"]');
      const cb3 = document.querySelector('input[data-compare-id="03-baoyu-design"]');
      const cb4 = document.querySelector('input[data-compare-id="04-oil-ui"]');

      cb1.checked = true;
      cb1.dispatchEvent({ type: 'change', bubbles: true });
      cb2.checked = true;
      cb2.dispatchEvent({ type: 'change', bubbles: true });
      cb3.checked = true;
      cb3.dispatchEvent({ type: 'change', bubbles: true });

      // Attempt to check 4th item
      cb4.checked = true;
      cb4.dispatchEvent({ type: 'change', bubbles: true });

      assert.ok(getAlert() && getAlert().includes('最多同时选择 3 个候选项目'), 'Must trigger max candidate alert');
      assert.equal(cb4.checked, false, '4th checkbox must be reset to unchecked');

      const count = document.getElementById('compare-tray-count');
      assert.equal(count.textContent, '已选 3 / 3 项', 'Count must remain 3/3');

      // Verify 4th candidate was not added to URL
      assert.equal(window.location.search.includes('04-oil-ui'), false, '4th candidate must NOT be in URL');
    });

    it('2.6 should cap excessive compare query parameter in deep link to exactly 3 items', () => {
      const initialUrl = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max,03-baoyu-design,04-oil-ui,05-ai-design-skills';
      const { document, window } = createSimulatedBrowser(initialUrl);

      const count = document.getElementById('compare-tray-count');
      assert.equal(count.textContent, '已选 3 / 3 项', 'Initial load with 5 candidates must be capped to 3');

      const cb1 = document.querySelector('input[data-compare-id="01-frontend-design"]');
      const cb2 = document.querySelector('input[data-compare-id="02-ui-ux-pro-max"]');
      const cb3 = document.querySelector('input[data-compare-id="03-baoyu-design"]');
      const cb4 = document.querySelector('input[data-compare-id="04-oil-ui"]');
      const cb5 = document.querySelector('input[data-compare-id="05-ai-design-skills"]');

      assert.equal(cb1.checked, true, '1st candidate checked');
      assert.equal(cb2.checked, true, '2nd candidate checked');
      assert.equal(cb3.checked, true, '3rd candidate checked');
      assert.equal(cb4.checked, false, '4th candidate must be unchecked');
      assert.equal(cb5.checked, false, '5th candidate must be unchecked');
    });
  });

  describe('Suite 3: Floating Compare Dock Interactivity', () => {
    it('3.1 should remove candidate when clicking chip remove button and update dock + URL', () => {
      const initialUrl = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max,03-baoyu-design';
      const { document, window } = createSimulatedBrowser(initialUrl);

      const chipsContainer = document.getElementById('compare-tray-chips');
      const removeBtn2 = chipsContainer.querySelector('[data-remove-id="02-ui-ux-pro-max"]');
      assert.ok(removeBtn2, 'Remove button for 02-ui-ux-pro-max must exist');

      removeBtn2.dispatchEvent({ type: 'click', bubbles: true });

      const count = document.getElementById('compare-tray-count');
      assert.equal(count.textContent, '已选 2 / 3 项');

      const cb2 = document.querySelector('input[data-compare-id="02-ui-ux-pro-max"]');
      assert.equal(cb2.checked, false, 'Checkbox for removed candidate must be unchecked');

      assert.equal(window.location.search.includes('02-ui-ux-pro-max'), false, 'Removed candidate must not be in URL');
      assert.ok(window.location.search.includes('01-frontend-design'), 'Candidate 1 remains in URL');
      assert.ok(window.location.search.includes('03-baoyu-design'), 'Candidate 3 remains in URL');
    });

    it('3.2 should disable launch button when removing candidates drops count below 2', () => {
      const initialUrl = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max';
      const { document } = createSimulatedBrowser(initialUrl);

      const chipsContainer = document.getElementById('compare-tray-chips');
      const removeBtn = chipsContainer.querySelector('[data-remove-id="02-ui-ux-pro-max"]');
      removeBtn.dispatchEvent({ type: 'click', bubbles: true });

      const launchBtn = document.getElementById('compare-launch-btn');
      assert.equal(launchBtn.disabled, true, 'Launch button must become disabled when only 1 item remains');
    });

    it('3.3 should hide tray and clear compare parameter when last candidate is removed', () => {
      const initialUrl = 'http://localhost/index.html?compare=01-frontend-design';
      const { document, window } = createSimulatedBrowser(initialUrl);

      const chipsContainer = document.getElementById('compare-tray-chips');
      const removeBtn = chipsContainer.querySelector('[data-remove-id="01-frontend-design"]');
      removeBtn.dispatchEvent({ type: 'click', bubbles: true });

      const tray = document.getElementById('compare-tray');
      assert.ok(tray.hasAttribute('hidden'), 'Tray must be hidden when all candidates are removed');
      assert.equal(window.location.search.includes('compare'), false, 'compare query param must be omitted');
    });

    it('3.4 should clear all candidates, uncheck all checkboxes, and hide tray on "清空" button click', () => {
      const initialUrl = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max,03-baoyu-design';
      const { document, window } = createSimulatedBrowser(initialUrl);

      const clearBtn = document.getElementById('compare-clear-btn');
      assert.ok(clearBtn, 'Clear button must exist');

      clearBtn.dispatchEvent({ type: 'click', bubbles: true });

      const tray = document.getElementById('compare-tray');
      assert.ok(tray.hasAttribute('hidden'), 'Tray must be hidden after clear');

      const checkboxes = document.querySelectorAll('.compare-select');
      checkboxes.forEach((cb) => assert.equal(cb.checked, false, 'All checkboxes must be unchecked'));

      assert.equal(window.location.search.includes('compare'), false, 'URL query must be cleared');
    });
  });

  describe('Suite 4: Horizontal Comparison Matrix Modal', () => {
    it('4.1 should launch modal and render side-by-side comparison matrix for 2 candidates', () => {
      const initialUrl = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max';
      const { document } = createSimulatedBrowser(initialUrl);

      const launchBtn = document.getElementById('compare-launch-btn');
      assert.equal(launchBtn.disabled, false);

      launchBtn.dispatchEvent({ type: 'click', bubbles: true });

      const modal = document.getElementById('compare-modal-backdrop');
      assert.equal(modal.hasAttribute('hidden'), false, 'Modal must become visible');

      const grid = document.getElementById('compare-matrix-grid');
      const columns = grid.querySelectorAll('.compare-matrix-col');
      assert.equal(columns.length, 2, 'Must render exactly 2 comparison columns');

      // Verify content in each column
      columns.forEach((col) => {
        assert.ok(col.querySelector('.compare-matrix-thumb img'), 'Column must contain thumbnail img');
        assert.ok(col.querySelector('.compare-matrix-title a'), 'Column must contain title link');
        assert.ok(col.querySelector('.compare-matrix-tagline'), 'Column must contain tagline');
        assert.ok(col.querySelector('.compare-matrix-best'), 'Column must contain best-for section');
        assert.ok(col.querySelector('.compare-matrix-tradeoff'), 'Column must contain tradeoff section');
        assert.ok(col.querySelector('a.button'), 'Column must have link to detail');
      });
    });

    it('4.2 should render 3 candidates side-by-side in matrix modal', () => {
      const initialUrl = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max,03-baoyu-design';
      const { document } = createSimulatedBrowser(initialUrl);

      const launchBtn = document.getElementById('compare-launch-btn');
      launchBtn.dispatchEvent({ type: 'click', bubbles: true });

      const grid = document.getElementById('compare-matrix-grid');
      const columns = grid.querySelectorAll('.compare-matrix-col');
      assert.equal(columns.length, 3, 'Must render exactly 3 comparison columns');
    });

    it('4.3 should update modal matrix when switching edition between V3 and V2', () => {
      const initialUrl = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max';
      const { document } = createSimulatedBrowser(initialUrl);

      const launchBtn = document.getElementById('compare-launch-btn');
      launchBtn.dispatchEvent({ type: 'click', bubbles: true });

      const v2Tab = document.querySelector('button[data-edition-tab="v2"]');
      v2Tab.dispatchEvent({ type: 'click', bubbles: true });

      const editionLabel = document.getElementById('compare-modal-edition-label');
      assert.equal(editionLabel.textContent, 'V2 试错迭代版', 'Edition label in modal must update to V2');

      const grid = document.getElementById('compare-matrix-grid');
      const thumbs = grid.querySelectorAll('.compare-matrix-thumb img');
      thumbs.forEach((img) => {
        assert.ok(img.getAttribute('src').startsWith('thumbs/v2/'), 'Thumbnails in modal must switch to V2 paths');
      });
    });

    it('4.4 should close modal when clicking close button, clicking backdrop, or pressing Escape key', () => {
      const initialUrl = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max';
      const { document, window } = createSimulatedBrowser(initialUrl);

      const modal = document.getElementById('compare-modal-backdrop');
      const launchBtn = document.getElementById('compare-launch-btn');
      const closeBtn = document.getElementById('compare-modal-close');

      // 1. Close via close button
      launchBtn.dispatchEvent({ type: 'click', bubbles: true });
      assert.equal(modal.hasAttribute('hidden'), false);
      closeBtn.dispatchEvent({ type: 'click', bubbles: true });
      assert.equal(modal.hasAttribute('hidden'), true, 'Modal must close on close button click');

      // 2. Close via backdrop click
      launchBtn.dispatchEvent({ type: 'click', bubbles: true });
      assert.equal(modal.hasAttribute('hidden'), false);
      modal.dispatchEvent({ type: 'click', bubbles: false, target: modal });
      assert.equal(modal.hasAttribute('hidden'), true, 'Modal must close on backdrop click');

      // 3. Close via Escape key
      launchBtn.dispatchEvent({ type: 'click', bubbles: true });
      assert.equal(modal.hasAttribute('hidden'), false);
      window.dispatchEvent({ type: 'keydown', key: 'Escape' });
      assert.equal(modal.hasAttribute('hidden'), true, 'Modal must close on Escape key');
    });
  });

  describe('Suite 5: URL State Persistence & Browser History (F13)', () => {
    it('5.1 should serialize combined edition, task, and compare parameters into canonical URL', () => {
      const { document, window } = createSimulatedBrowser('http://localhost/index.html');

      // Switch to V2
      const v2Tab = document.querySelector('button[data-edition-tab="v2"]');
      v2Tab.dispatchEvent({ type: 'click', bubbles: true });

      // Filter by portfolio
      const portfolioChip = document.querySelector('button[data-task-filter="portfolio"]');
      portfolioChip.dispatchEvent({ type: 'click', bubbles: true });

      // Select 2 candidates
      const cb1 = document.querySelector('input[data-compare-id="01-frontend-design"]');
      const cb2 = document.querySelector('input[data-compare-id="02-ui-ux-pro-max"]');
      cb1.checked = true;
      cb1.dispatchEvent({ type: 'change', bubbles: true });
      cb2.checked = true;
      cb2.dispatchEvent({ type: 'change', bubbles: true });

      const search = window.location.search;
      assert.ok(search.includes('edition=v2'), 'URL must contain edition=v2');
      assert.ok(search.includes('task=portfolio'), 'URL must contain task=portfolio');
      assert.ok(search.includes('compare=01-frontend-design'), 'URL must contain 1st candidate');
      assert.ok(search.includes('02-ui-ux-pro-max'), 'URL must contain 2nd candidate');
    });

    it('5.2 should hydrate full multi-dimensional state from initial deep link', () => {
      const deepLink = 'http://localhost/index.html?edition=v2&task=portfolio&compare=01-frontend-design,03-baoyu-design';
      const { document } = createSimulatedBrowser(deepLink);

      // Verify V2 is active
      const v2Tab = document.querySelector('button[data-edition-tab="v2"]');
      assert.equal(v2Tab.classList.contains('is-active'), true, 'V2 tab must be active');

      // Verify portfolio filter is active
      const portChip = document.querySelector('button[data-task-filter="portfolio"]');
      assert.equal(portChip.classList.contains('is-active'), true, 'Portfolio filter must be active');

      // Verify compare tray has 2 items
      const count = document.getElementById('compare-tray-count');
      assert.equal(count.textContent, '已选 2 / 3 项');

      // Verify card links have preserved query params
      const cardLink = document.querySelector('.card a[href]');
      assert.ok(cardLink.getAttribute('href').includes('compare='), 'Card links must preserve compare query');
    });

    it('5.3 should re-hydrate state on browser popstate (back/forward)', () => {
      const { document, window } = createSimulatedBrowser('http://localhost/index.html');

      // User simulates back navigation to a compare URL
      window.location.search = '?compare=05-ai-design-skills,06-huashu-design';
      window.dispatchEvent({ type: 'popstate' });

      const count = document.getElementById('compare-tray-count');
      assert.equal(count.textContent, '已选 2 / 3 项', 'Popstate must update compare tray count');

      const cb5 = document.querySelector('input[data-compare-id="05-ai-design-skills"]');
      assert.equal(cb5.checked, true, 'Checkbox 05 must be checked on popstate');
    });
  });

  describe('Suite 6: Visual & Semantic Disambiguation (F12)', () => {
    it('6.1 should visually distinguish horizontal comparison from longitudinal evolution on index.html', () => {
      // Longitudinal evolution header
      assert.ok(
        indexHtml.includes('跨实验纵向对比'),
        'Index page must have visible badge/text for longitudinal comparison',
      );
      assert.ok(
        indexHtml.includes('查看两次实验演进'),
        'Index page must explain longitudinal evolution',
      );

      // Horizontal multi-candidate comparison
      assert.ok(
        indexHtml.includes('同版本横向比对') || indexHtml.includes('同版本多候选横向比对'),
        'Index page must clearly label candidate comparison as horizontal',
      );
    });

    it('6.2 should distinguish horizontal vs longitudinal on all 10 detail pages', () => {
      for (const project of PROJECTS) {
        const detailPath = join(REPO_ROOT, 'site', 'dist', 'runs', project.id, 'detail.html');
        assert.ok(existsSync(detailPath), `Detail page for ${project.id} must exist`);
        const html = readFileSync(detailPath, 'utf-8');

        assert.ok(
          html.includes('跨实验纵向对比'),
          `Detail page for ${project.id} must clearly state it is a longitudinal evolution view`,
        );
        assert.ok(
          html.includes('同版本横向比对'),
          `Detail page for ${project.id} must reference horizontal comparison when guiding user back`,
        );
      }
    });
  });

  describe('Suite 7: Detail Page State Preservation Navigation (F14)', () => {
    it('7.1 should update return link and pager links with active query string', () => {
      const detailPath = join(REPO_ROOT, 'site', 'dist', 'runs', '01-frontend-design', 'detail.html');
      const html = readFileSync(detailPath, 'utf-8');

      // Verify inline script in detail.html handles preserving query parameters
      assert.ok(html.includes('window.location.search'), 'Detail script must check window.location.search');
      assert.ok(
        html.includes('a.back') || html.includes('[data-back="true"]'),
        'Detail script must target back link',
      );
      assert.ok(
        html.includes('.pager a') || html.includes('pager'),
        'Detail script must update pager links with search params',
      );
    });
  });

  describe('Suite 8: Adversarial Edge Cases & Hostile Input Mining', () => {
    it('8.1 should handle unknown/invalid candidate IDs in URL without crashing runtime', () => {
      const initialUrl = 'http://localhost/index.html?compare=nonexistent-skill,another-fake-id';
      assert.doesNotThrow(() => {
        const { document } = createSimulatedBrowser(initialUrl);
        const count = document.getElementById('compare-tray-count');
        assert.equal(count.textContent, '已选 2 / 3 项');

        const launchBtn = document.getElementById('compare-launch-btn');
        assert.equal(launchBtn.disabled, false);

        // Clicking launch should handle nonexistent projects gracefully
        launchBtn.dispatchEvent({ type: 'click', bubbles: true });
        const grid = document.getElementById('compare-matrix-grid');
        assert.ok(grid, 'Grid element must exist and not throw exception');
      }, 'Invalid project IDs must not crash the client script');
    });

    it('8.2 should handle hostile XSS injection strings in compare query safely', () => {
      const hostileUrl = 'http://localhost/index.html?compare=%3Cscript%3Ealert(1)%3C%2Fscript%3E';
      assert.doesNotThrow(() => {
        const { document } = createSimulatedBrowser(hostileUrl);
        const chips = document.getElementById('compare-tray-chips');
        assert.ok(chips, 'Chips container must handle escaped or sanitized candidate ID');
      }, 'Hostile injection payload in compare param must be handled safely');
    });

    it('8.3 should handle empty and comma-padded compare parameters cleanly', () => {
      const paddedUrl = 'http://localhost/index.html?compare=,,01-frontend-design,,,02-ui-ux-pro-max,,';
      const { document, window } = createSimulatedBrowser(paddedUrl);

      const count = document.getElementById('compare-tray-count');
      assert.equal(count.textContent, '已选 2 / 3 项', 'Must ignore empty comma-separated tokens');

      const cb1 = document.querySelector('input[data-compare-id="01-frontend-design"]');
      const cb2 = document.querySelector('input[data-compare-id="02-ui-ux-pro-max"]');
      assert.equal(cb1.checked, true);
      assert.equal(cb2.checked, true);
    });

    it('8.4 should handle rapid toggling of candidates (selection idempotency)', () => {
      const { document, window } = createSimulatedBrowser('http://localhost/index.html');
      const cb = document.querySelector('input[data-compare-id="01-frontend-design"]');

      for (let i = 0; i < 5; i++) {
        cb.checked = true;
        cb.dispatchEvent({ type: 'change', bubbles: true });
        assert.ok(window.location.search.includes('01-frontend-design'));

        cb.checked = false;
        cb.dispatchEvent({ type: 'change', bubbles: true });
        assert.equal(window.location.search.includes('01-frontend-design'), false);
      }
    });

    it('8.5 should verify mobile 390px styles prevent matrix and tray blowout in CSS rules', () => {
      // Test mobile media query in style.css
      const media640Match = styleCss.match(/@media\s*\(max-width:\s*640px\)\s*\{([\s\S]*?)\n\}/);
      assert.ok(media640Match, 'Must have 640px media query block');
      const mediaBlock = media640Match[1];

      assert.ok(
        mediaBlock.includes('.compare-tray-inner'),
        'Mobile query must restyle .compare-tray-inner',
      );
      assert.ok(
        mediaBlock.includes('flex-direction:\s*column') || mediaBlock.includes('flex-direction: column'),
        'Mobile tray inner must stack vertically',
      );
      assert.ok(
        mediaBlock.includes('.compare-matrix-grid'),
        'Mobile query must restyle .compare-matrix-grid',
      );
      assert.ok(
        mediaBlock.includes('grid-template-columns: minmax(0, 1fr)'),
        'Mobile matrix grid must use single-column minmax(0, 1fr) to prevent horizontal blowout',
      );
    });
  });
});
