// tests/challenger-m3-url-history.test.mjs
// Adversarial Stress Test Suite: URL Persistence, Browser History Navigation & Detail Page Memory
// Milestone 3 Challenger Verification

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import vm from 'node:vm';
import { PROJECTS } from '../site/data/projects.mjs';

const REPO_ROOT = resolve('.');
const DIST_INDEX = join(REPO_ROOT, 'site', 'dist', 'index.html');
const DIST_COMPARE = join(REPO_ROOT, 'site', 'dist', 'compare.html');
const indexHtml = readFileSync(DIST_INDEX, 'utf-8');

// Extract the inline script from index.html
const scriptMatch = indexHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i);
assert.ok(scriptMatch, 'site/dist/index.html must contain the client script');
const clientScriptSource = scriptMatch[1];

/**
 * Robust lightweight DOM element simulator for testing index.html runtime behavior
 */
class MockElement {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attrs };
    this.classes = new Set(
      (attrs.class || '')
        .split(/\s+/)
        .filter(Boolean)
    );
    this.children = [];
    this.parent = null;
    this.listeners = {};
    this.checked = attrs.checked !== undefined ? Boolean(attrs.checked) : false;
    this.disabled = attrs.disabled !== undefined ? Boolean(attrs.disabled) : false;
    this._textContent = '';
  }

  get id() {
    return this.attributes.id || '';
  }

  set id(val) {
    this.attributes.id = val;
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(val) {
    this._textContent = String(val);
  }

  get innerHTML() {
    return this._innerHTML || '';
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
    this.children = [];
    // Lightweight parser for child elements generated via innerHTML
    const tagRegex = /<([a-zA-Z0-9]+)\b([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)\b([^>]*)\/?>/g;
    let match;
    while ((match = tagRegex.exec(val)) !== null) {
      const tag = match[1] || match[4];
      const rawAttrs = match[2] || match[5] || '';
      const body = match[3] || '';
      const attrs = {};
      const attrRegex = /([a-zA-Z0-9_-]+)(?:="([^"]*)")?/g;
      let am;
      while ((am = attrRegex.exec(rawAttrs)) !== null) {
        attrs[am[1]] = am[2] !== undefined ? am[2] : true;
      }
      const child = new MockElement(tag, attrs);
      child.textContent = body.replace(/<[^>]+>/g, '').trim();
      this.appendChild(child);

      // Recursive parse for nested buttons/links
      if (body.includes('<')) {
        let nestedMatch;
        const nestedRegex = /<([a-zA-Z0-9]+)\b([^>]*)>([\s\S]*?)<\/\1>/g;
        while ((nestedMatch = nestedRegex.exec(body)) !== null) {
          const ntag = nestedMatch[1];
          const nrawAttrs = nestedMatch[2];
          const nbody = nestedMatch[3];
          const nattrs = {};
          let nam;
          while ((nam = attrRegex.exec(nrawAttrs)) !== null) {
            nattrs[nam[1]] = nam[2] !== undefined ? nam[2] : true;
          }
          const nchild = new MockElement(ntag, nattrs);
          nchild.textContent = nbody.replace(/<[^>]+>/g, '').trim();
          child.appendChild(nchild);
        }
      }
    }
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
    const eventObj = {
      type: event.type,
      target: event.target || this,
      bubbles: event.bubbles !== false,
      preventDefault: () => {},
      key: event.key,
    };
    const list = this.listeners[eventObj.type] || [];
    for (const cb of list) {
      cb.call(this, eventObj);
    }
    if (eventObj.bubbles && this.parent) {
      this.parent.dispatchEvent(eventObj);
    }
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches(selector)) return curr;
      curr = curr.parent;
    }
    return null;
  }

  matches(selector) {
    if (selector.includes(' ')) {
      const tokens = selector.split(/\s+/);
      return this.matches(tokens[tokens.length - 1]) && Boolean(this.closest(tokens[0]));
    }
    if (selector === 'a[href]' || selector.includes('a[href]')) {
      return this.tagName === 'A' && this.hasAttribute('href');
    }
    if (selector.includes('.')) {
      const parts = selector.split('.');
      const tagMatch = !parts[0] || this.tagName.toLowerCase() === parts[0].toLowerCase();
      const classMatch = this.classes.has(parts[1]);
      return tagMatch && classMatch;
    }
    if (selector.startsWith('#')) {
      return (this.attributes.id || '') === selector.slice(1);
    }
    const attrMatch = selector.match(/^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/);
    if (attrMatch) {
      const name = attrMatch[1];
      const val = attrMatch[2];
      if (val === undefined) {
        return this.hasAttribute(name);
      }
      return this.getAttribute(name) === val;
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
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

  focus() {}
}

/**
 * Builds a simulated DOM environment from the parsed HTML of site/dist/index.html
 */
function createSimulatedBrowser(initialUrl = 'http://localhost/index.html') {
  const root = new MockElement('root');

  // Parse edition tabs
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

  // Parse task filter chips and bar
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

  // Live region
  const liveRegionEl = new MockElement('div', { id: 'task-filter-live' });
  root.appendChild(liveRegionEl);

  // Parse V2 and V3 sections
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

    // Parse cards in this section
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

      // Compare checkbox
      if (cardBody.includes('class="compare-select"')) {
        const cbEl = new MockElement('input', {
          type: 'checkbox',
          class: 'compare-select',
          'data-compare-id': cardId,
        });
        cardEl.appendChild(cbEl);
      }

      // Card links
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

    // Empty state element
    const emptyEl = new MockElement('div', {
      class: 'task-empty-state task-filter-empty',
      hidden: '',
    });
    panelEl.appendChild(emptyEl);
  }

  // Parse Compare Tray elements from HTML
  const compareTrayEl = new MockElement('aside', {
    id: 'compare-tray',
    class: 'compare-tray',
    hidden: '',
  });
  root.appendChild(compareTrayEl);

  const trayCountEl = new MockElement('span', { id: 'compare-tray-count' });
  trayCountEl.textContent = '已选 0 / 3 项';
  compareTrayEl.appendChild(trayCountEl);

  const trayChipsEl = new MockElement('div', { id: 'compare-tray-chips' });
  compareTrayEl.appendChild(trayChipsEl);

  const clearBtnEl = new MockElement('button', {
    id: 'compare-clear-btn',
    class: 'button button-ghost button-sm',
  });
  compareTrayEl.appendChild(clearBtnEl);

  const launchBtnEl = new MockElement('button', {
    id: 'compare-launch-btn',
    class: 'button button-primary button-sm',
    disabled: true,
  });
  compareTrayEl.appendChild(launchBtnEl);

  // Parse Compare Modal elements
  const modalBackdropEl = new MockElement('div', {
    id: 'compare-modal-backdrop',
    class: 'compare-modal-backdrop',
    hidden: '',
  });
  root.appendChild(modalBackdropEl);

  const modalEditionLabel = new MockElement('strong', { id: 'compare-modal-edition-label' });
  modalBackdropEl.appendChild(modalEditionLabel);

  const modalGridEl = new MockElement('div', { id: 'compare-matrix-grid' });
  modalBackdropEl.appendChild(modalGridEl);

  const modalCloseBtn = new MockElement('button', {
    id: 'compare-modal-close',
    class: 'button button-ghost compare-modal-close',
  });
  modalBackdropEl.appendChild(modalCloseBtn);

  // Setup simulated Window & Document
  const currentUrl = new URL(initialUrl);

  const documentMock = {
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    querySelector: (sel) => root.querySelector(sel),
    getElementById: (id) => root.querySelector(`#${id}`),
  };

  const alertLog = [];
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
    alert: (msg) => {
      alertLog.push(msg);
    },
  };

  const sandbox = {
    window: windowMock,
    document: documentMock,
    URLSearchParams,
    alert: windowMock.alert,
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(clientScriptSource, sandbox);

  return { root, window: windowMock, document: documentMock, alertLog };
}

describe('Challenger M3-2: Empirical URL Persistence & History Stress Suite', () => {

  describe('1. URL Synchronization on Initial Load', () => {
    it('1.1 boots with ?compare=01-frontend-design,02-ui-ux-pro-max&edition=v2&task=landing', () => {
      const url = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max&edition=v2&task=landing';
      const env = createSimulatedBrowser(url);
      const doc = env.document;

      // Edition v2 active
      const v2Tab = doc.querySelector('[data-edition-tab="v2"]');
      const v3Tab = doc.querySelector('[data-edition-tab="v3"]');
      const v2Panel = doc.querySelector('[data-edition="v2"]');
      const v3Panel = doc.querySelector('[data-edition="v3"]');

      assert.equal(v2Tab.classList.contains('is-active'), true, 'v2 tab must be active');
      assert.equal(v3Tab.classList.contains('is-active'), false, 'v3 tab must not be active');
      assert.equal(v2Panel.hasAttribute('hidden'), false, 'v2 panel must be visible');
      assert.equal(v3Panel.hasAttribute('hidden'), true, 'v3 panel must be hidden');

      // Task landing active
      const landingChip = doc.querySelector('[data-task-filter="landing"]');
      assert.equal(landingChip.classList.contains('is-active'), true, 'landing chip must be active');
      assert.equal(landingChip.getAttribute('aria-selected'), 'true');

      // Compare candidates checked
      const checkedBoxes = doc.querySelectorAll('.compare-select').filter((cb) => cb.checked);
      // Both v2 and v3 have checkboxes for each candidate, so 2 candidates * 2 editions = 4 checked
      const checkedIds = Array.from(new Set(checkedBoxes.map((cb) => cb.getAttribute('data-compare-id'))));
      assert.deepEqual(checkedIds.sort(), ['01-frontend-design', '02-ui-ux-pro-max'].sort());

      // Floating Tray verification
      const tray = doc.getElementById('compare-tray');
      assert.equal(tray.hasAttribute('hidden'), false, 'compare tray must be visible');

      const countEl = doc.getElementById('compare-tray-count');
      assert.equal(countEl.textContent, '已选 2 / 3 项');

      const launchBtn = doc.getElementById('compare-launch-btn');
      assert.equal(launchBtn.disabled, false, 'launch button must be enabled when 2 items selected');
      assert.ok(launchBtn.textContent.includes('2项并排'));

      // Check chips in tray
      const chips = doc.getElementById('compare-tray-chips').querySelectorAll('.compare-chip');
      assert.equal(chips.length, 2, '2 chips should be rendered in compare tray');
    });

    it('1.2 limits candidates to MAX 3 if URL contains more than 3', () => {
      const url = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max,03-baoyu-design,04-oil-ui,05-ai-design-skills';
      const env = createSimulatedBrowser(url);
      const doc = env.document;

      const countEl = doc.getElementById('compare-tray-count');
      assert.equal(countEl.textContent, '已选 3 / 3 项', 'must cap compare items to 3');

      const chips = doc.getElementById('compare-tray-chips').querySelectorAll('.compare-chip');
      assert.equal(chips.length, 3);
    });

    it('1.3 gracefully handles empty, malformed, or non-existent compare parameters', () => {
      const url = 'http://localhost/index.html?compare=&task=all';
      const env = createSimulatedBrowser(url);
      const doc = env.document;

      const tray = doc.getElementById('compare-tray');
      assert.equal(tray.hasAttribute('hidden'), true, 'tray must remain hidden when compare is empty');

      const url2 = 'http://localhost/index.html?compare=non-existent-skill-999';
      const env2 = createSimulatedBrowser(url2);
      const tray2 = env2.document.getElementById('compare-tray');
      assert.equal(tray2.hasAttribute('hidden'), false, 'tray displays even for unrecognized skill ID gracefully');
    });
  });

  describe('2. Interactive Candidate Selection & URL Dynamic Sync', () => {
    it('2.1 selecting a 3rd candidate updates URL query and tray count', () => {
      const url = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max&edition=v2&task=landing';
      const env = createSimulatedBrowser(url);
      const doc = env.document;

      // Find unchecked checkbox for 03-baoyu-design
      const cb03 = doc.querySelectorAll('.compare-select').find((cb) => cb.getAttribute('data-compare-id') === '03-baoyu-design');
      assert.ok(cb03);
      assert.equal(cb03.checked, false);

      // Check it
      cb03.checked = true;
      cb03.dispatchEvent({ type: 'change', bubbles: true });

      // Tray count updates to 3
      const countEl = doc.getElementById('compare-tray-count');
      assert.equal(countEl.textContent, '已选 3 / 3 项');

      // URL search is updated with all 3
      assert.ok(env.window.location.search.includes('03-baoyu-design'));
      assert.ok(env.window.location.search.includes('01-frontend-design'));
      assert.ok(env.window.location.search.includes('02-ui-ux-pro-max'));
    });

    it('2.2 attempting to select a 4th candidate triggers alert and blocks selection', () => {
      const url = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max,03-baoyu-design';
      const env = createSimulatedBrowser(url);
      const doc = env.document;

      const cb04 = doc.querySelectorAll('.compare-select').find((cb) => cb.getAttribute('data-compare-id') === '04-oil-ui');
      assert.ok(cb04);

      cb04.checked = true;
      cb04.dispatchEvent({ type: 'change', bubbles: true });

      // Must trigger alert
      assert.equal(env.alertLog.length, 1);
      assert.ok(env.alertLog[0].includes('最多同时选择 3 个候选项目'));

      // Checkbox is reverted to false
      assert.equal(cb04.checked, false);

      // URL still contains only original 3
      assert.ok(!env.window.location.search.includes('04-oil-ui'));
    });

    it('2.3 unselecting a candidate updates tray, launch button, and URL', () => {
      const url = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max';
      const env = createSimulatedBrowser(url);
      const doc = env.document;

      // Uncheck 02-ui-ux-pro-max
      const cb02 = doc.querySelectorAll('.compare-select').find((cb) => cb.getAttribute('data-compare-id') === '02-ui-ux-pro-max');
      cb02.checked = false;
      cb02.dispatchEvent({ type: 'change', bubbles: true });

      const countEl = doc.getElementById('compare-tray-count');
      assert.equal(countEl.textContent, '已选 1 / 3 项');

      const launchBtn = doc.getElementById('compare-launch-btn');
      assert.equal(launchBtn.disabled, true, 'launch button must be disabled when fewer than 2 candidates');
      assert.ok(launchBtn.textContent.includes('需选2-3项'));

      assert.ok(!env.window.location.search.includes('02-ui-ux-pro-max'));
      assert.ok(env.window.location.search.includes('01-frontend-design'));
    });

    it('2.4 removing a candidate via tray chip remove button updates state and URL', () => {
      const url = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max';
      const env = createSimulatedBrowser(url);
      const doc = env.document;

      const chipsContainer = doc.getElementById('compare-tray-chips');
      const removeBtn01 = chipsContainer.querySelector('[data-remove-id="01-frontend-design"]');
      assert.ok(removeBtn01, 'Remove button for 01-frontend-design must exist');

      removeBtn01.dispatchEvent({ type: 'click', bubbles: true });

      const countEl = doc.getElementById('compare-tray-count');
      assert.equal(countEl.textContent, '已选 1 / 3 项');
      assert.ok(!env.window.location.search.includes('01-frontend-design'));
      assert.ok(env.window.location.search.includes('02-ui-ux-pro-max'));
    });

    it('2.5 clicking clear button empties compare state and cleans URL', () => {
      const url = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max&edition=v2';
      const env = createSimulatedBrowser(url);
      const doc = env.document;

      const clearBtn = doc.getElementById('compare-clear-btn');
      assert.ok(clearBtn);

      clearBtn.dispatchEvent({ type: 'click', bubbles: true });

      const tray = doc.getElementById('compare-tray');
      assert.equal(tray.hasAttribute('hidden'), true, 'tray must be hidden after clear');

      const allChecked = doc.querySelectorAll('.compare-select').filter((cb) => cb.checked);
      assert.equal(allChecked.length, 0, 'all checkboxes must be unchecked');

      assert.ok(!env.window.location.search.includes('compare='), 'compare must be removed from URL search');
      assert.ok(env.window.location.search.includes('edition=v2'), 'other params like edition must be preserved');
    });

    it('2.6 updates card detail links with current edition, task, and compare query parameters', () => {
      const url = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max&edition=v2&task=landing';
      const env = createSimulatedBrowser(url);
      const doc = env.document;

      const cardLinks = doc.querySelectorAll('.card a[href], .card-link');
      assert.ok(cardLinks.length > 0);

      for (const link of cardLinks) {
        const href = link.getAttribute('href');
        assert.ok(href.includes('edition=v2'), `card link href ${href} must retain edition=v2`);
        assert.ok(href.includes('task=landing'), `card link href ${href} must retain task=landing`);
        assert.ok(href.includes('compare='), `card link href ${href} must retain compare`);
      }
    });
  });

  describe('3. Browser History Navigation (popstate & hashchange)', () => {
    it('3.1 popstate restores candidate selection and task filter', () => {
      const initialUrl = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max&edition=v2&task=landing';
      const env = createSimulatedBrowser(initialUrl);
      const doc = env.document;

      // User simulates forward navigation to another view
      env.window.location.search = '?task=admin';
      env.window.location.pathname = '/index.html';

      // Dispatch popstate back to initial URL
      env.window.location.search = '?compare=01-frontend-design,02-ui-ux-pro-max&edition=v2&task=landing';
      env.window.dispatchEvent({ type: 'popstate' });

      // Verify restored edition
      const v2Tab = doc.querySelector('[data-edition-tab="v2"]');
      assert.equal(v2Tab.classList.contains('is-active'), true);

      // Verify restored task filter
      const landingChip = doc.querySelector('[data-task-filter="landing"]');
      assert.equal(landingChip.classList.contains('is-active'), true);

      // Verify restored compare candidates
      const countEl = doc.getElementById('compare-tray-count');
      assert.equal(countEl.textContent, '已选 2 / 3 项');

      const tray = doc.getElementById('compare-tray');
      assert.equal(tray.hasAttribute('hidden'), false);
    });

    it('3.2 popstate back to clean root /index.html resets state to defaults', () => {
      const initialUrl = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max&edition=v2&task=landing';
      const env = createSimulatedBrowser(initialUrl);
      const doc = env.document;

      // Simulate browser back to root
      env.window.location.search = '';
      env.window.location.hash = '';
      env.window.dispatchEvent({ type: 'popstate' });

      // Restored to v3 default
      const v3Tab = doc.querySelector('[data-edition-tab="v3"]');
      assert.equal(v3Tab.classList.contains('is-active'), true);

      // Restored to all task filter
      const allChip = doc.querySelector('[data-task-filter="all"]');
      assert.equal(allChip.classList.contains('is-active'), true);

      // Tray is hidden
      const tray = doc.getElementById('compare-tray');
      assert.equal(tray.hasAttribute('hidden'), true);

      // All checkboxes unchecked
      const checkedBoxes = doc.querySelectorAll('.compare-select').filter((cb) => cb.checked);
      assert.equal(checkedBoxes.length, 0);
    });

    it('3.3 hashchange re-synchronizes task and edition state', () => {
      const env = createSimulatedBrowser('http://localhost/index.html');
      const doc = env.document;

      // Trigger hashchange with #task=prototype
      env.window.location.hash = '#task=prototype';
      env.window.dispatchEvent({ type: 'hashchange' });

      const prototypeChip = doc.querySelector('[data-task-filter="prototype"]');
      assert.equal(prototypeChip.classList.contains('is-active'), true);

      // Trigger hashchange with #v2
      env.window.location.hash = '#v2';
      env.window.dispatchEvent({ type: 'hashchange' });

      const v2Tab = doc.querySelector('[data-edition-tab="v2"]');
      assert.equal(v2Tab.classList.contains('is-active'), true);
    });
  });

  describe('4. Detail Page Return Link & Pager Memory', () => {
    it('4.1 detail.html back link retains full query params from window.location.search', () => {
      const detailHtmlPath = join(REPO_ROOT, 'site', 'dist', 'runs', '01-frontend-design', 'detail.html');
      assert.ok(existsSync(detailHtmlPath), 'detail.html for 01-frontend-design must exist');
      const detailHtml = readFileSync(detailHtmlPath, 'utf-8');

      // Extract client script from detail.html
      const detailScriptMatch = detailHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/main>/i) ||
                                detailHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i);
      assert.ok(detailScriptMatch, 'detail.html must contain return link script');
      const detailScript = detailScriptMatch[1];

      // Create simulated detail page DOM
      const backLink = new MockElement('a', {
        href: '../../index.html',
        class: 'back',
        'data-back': 'true',
      });
      const prevPager = new MockElement('a', {
        href: '../00-bare/detail.html',
      });
      const nextPager = new MockElement('a', {
        href: '../02-ui-ux-pro-max/detail.html',
      });
      const pagerSpan = new MockElement('span', { class: 'pager' });
      pagerSpan.appendChild(prevPager);
      pagerSpan.appendChild(nextPager);

      const root = new MockElement('root');
      root.appendChild(backLink);
      root.appendChild(pagerSpan);

      const qs = '?edition=v2&task=landing&compare=01-frontend-design,02-ui-ux-pro-max';
      const windowMock = {
        location: { search: qs },
        document: {
          querySelector: (sel) => root.querySelector(sel),
          querySelectorAll: (sel) => root.querySelectorAll(sel),
        },
      };
      windowMock.window = windowMock;

      vm.createContext(windowMock);
      vm.runInContext(detailScript, windowMock);

      // Assert back link retained query params
      assert.equal(
        backLink.getAttribute('href'),
        `../../index.html${qs}`,
        'detail.html back link must append window.location.search',
      );

      // Assert pager links retained query params
      assert.equal(
        prevPager.getAttribute('href'),
        `../00-bare/detail.html${qs}`,
        'prev pager link must retain search query',
      );
      assert.equal(
        nextPager.getAttribute('href'),
        `../02-ui-ux-pro-max/detail.html${qs}`,
        'next pager link must retain search query',
      );
    });

    it('4.2 detail.html back link falls back to document.referrer query string when search is empty', () => {
      const detailHtmlPath = join(REPO_ROOT, 'site', 'dist', 'runs', '01-frontend-design', 'detail.html');
      const detailHtml = readFileSync(detailHtmlPath, 'utf-8');
      const detailScriptMatch = detailHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/main>/i) ||
                                detailHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i);
      const detailScript = detailScriptMatch[1];

      const backLink = new MockElement('a', {
        href: '../../index.html',
        class: 'back',
        'data-back': 'true',
      });
      const root = new MockElement('root');
      root.appendChild(backLink);

      const referrer = 'http://localhost/site/dist/index.html?edition=v2&task=portfolio&compare=01-frontend-design';
      const windowMock = {
        location: { search: '' },
        document: {
          referrer: referrer,
          querySelector: (sel) => root.querySelector(sel),
          querySelectorAll: (sel) => root.querySelectorAll(sel),
        },
      };
      windowMock.window = windowMock;

      vm.createContext(windowMock);
      vm.runInContext(detailScript, windowMock);

      assert.equal(
        backLink.getAttribute('href'),
        '../../index.html?edition=v2&task=portfolio&compare=01-frontend-design',
        'back link must use referrer search params when location.search is empty',
      );
    });

    it('4.3 standalone compare.html redirects with preserved query parameters', () => {
      assert.ok(existsSync(DIST_COMPARE), 'site/dist/compare.html must exist');
      const compareHtml = readFileSync(DIST_COMPARE, 'utf-8');

      // Verify meta refresh tag
      assert.ok(compareHtml.includes('http-equiv="refresh"'));
      assert.ok(compareHtml.includes('url=index.html'));

      // Verify script preserves search params
      assert.ok(compareHtml.includes("window.location.replace('index.html' + window.location.search)"));
    });

    it('4.4 multi-hop pager navigation simulation preserves query parameters along chain', () => {
      // 00-bare -> 01-frontend-design -> 02-ui-ux-pro-max
      const search = '?edition=v2&task=portfolio&compare=01-frontend-design,02-ui-ux-pro-max';

      const script = `
        var search = window.location.search || (document.referrer && document.referrer.indexOf('?') !== -1 ? '?' + document.referrer.split('?')[1] : '');
        if (search) {
          var links = Array.prototype.slice.call(document.querySelectorAll('a.back, .pager a'));
          links.forEach(function (a) {
            var base = a.getAttribute('href').split('?')[0];
            a.setAttribute('href', base + search);
          });
        }
      `;

      // Hop 1: 00-bare
      const root1 = new MockElement('root');
      const back1 = new MockElement('a', { href: '../../index.html', class: 'back' });
      const next1 = new MockElement('a', { href: '../01-frontend-design/detail.html' });
      const pager1 = new MockElement('span', { class: 'pager' });
      pager1.appendChild(next1);
      root1.appendChild(back1);
      root1.appendChild(pager1);

      const win1 = {
        location: { search },
        document: { querySelectorAll: (s) => root1.querySelectorAll(s), querySelector: (s) => root1.querySelector(s) },
      };
      win1.window = win1;
      vm.createContext(win1);
      vm.runInContext(script, win1);

      assert.equal(next1.getAttribute('href'), `../01-frontend-design/detail.html${search}`);

      // Hop 2: 01-frontend-design loaded from Hop 1
      const root2 = new MockElement('root');
      const back2 = new MockElement('a', { href: '../../index.html', class: 'back' });
      const prev2 = new MockElement('a', { href: '../00-bare/detail.html' });
      const next2 = new MockElement('a', { href: '../02-ui-ux-pro-max/detail.html' });
      const pager2 = new MockElement('span', { class: 'pager' });
      pager2.appendChild(prev2);
      pager2.appendChild(next2);
      root2.appendChild(back2);
      root2.appendChild(pager2);

      const win2 = {
        location: { search: next1.getAttribute('href').split('?')[1] ? '?' + next1.getAttribute('href').split('?')[1] : '' },
        document: { querySelectorAll: (s) => root2.querySelectorAll(s), querySelector: (s) => root2.querySelector(s) },
      };
      win2.window = win2;
      vm.createContext(win2);
      vm.runInContext(script, win2);

      assert.equal(back2.getAttribute('href'), `../../index.html${search}`);
      assert.equal(next2.getAttribute('href'), `../02-ui-ux-pro-max/detail.html${search}`);
      assert.equal(prev2.getAttribute('href'), `../00-bare/detail.html${search}`);
    });

    it('4.5 handles terminal pager elements (disabled span) without error', () => {
      // 00-bare has no prev; 09 has no next
      const root = new MockElement('root');
      const back = new MockElement('a', { href: '../../index.html', class: 'back' });
      const disabledSpan = new MockElement('span', { class: 'disabled' });
      const next = new MockElement('a', { href: '../01-frontend-design/detail.html' });
      const pager = new MockElement('span', { class: 'pager' });
      pager.appendChild(disabledSpan);
      pager.appendChild(next);
      root.appendChild(back);
      root.appendChild(pager);

      const script = `
        var search = window.location.search || (document.referrer && document.referrer.indexOf('?') !== -1 ? '?' + document.referrer.split('?')[1] : '');
        if (search) {
          var links = Array.prototype.slice.call(document.querySelectorAll('a.back, .pager a'));
          links.forEach(function (a) {
            var base = a.getAttribute('href').split('?')[0];
            a.setAttribute('href', base + search);
          });
        }
      `;

      const win = {
        location: { search: '?edition=v2' },
        document: { querySelectorAll: (s) => root.querySelectorAll(s), querySelector: (s) => root.querySelector(s) },
      };
      win.window = win;
      vm.createContext(win);
      assert.doesNotThrow(() => vm.runInContext(script, win));
      assert.equal(next.getAttribute('href'), '../01-frontend-design/detail.html?edition=v2');
    });
  });

  describe('5. Modal Interactions & Cross-Edition Synchronization', () => {
    it('5.1 cross-edition checkbox selection synchronizes across both panels', () => {
      const env = createSimulatedBrowser('http://localhost/index.html');
      const doc = env.document;

      // Select 01-frontend-design in active V3 panel
      const cbV3 = doc.querySelectorAll('.compare-select').find(
        (cb) => cb.getAttribute('data-compare-id') === '01-frontend-design' && cb.closest('[data-edition="v3"]')
      );
      assert.ok(cbV3);
      cbV3.checked = true;
      cbV3.dispatchEvent({ type: 'change', bubbles: true });

      // Verify V2 checkbox for same candidate is also checked
      const cbV2 = doc.querySelectorAll('.compare-select').find(
        (cb) => cb.getAttribute('data-compare-id') === '01-frontend-design' && cb.closest('[data-edition="v2"]')
      );
      assert.ok(cbV2);
      assert.equal(cbV2.checked, true, 'V2 checkbox must synchronize with V3 selection');

      // Parent card in both panels has highlight class
      assert.equal(cbV3.closest('.card').classList.contains('is-selected-for-compare'), true);
      assert.equal(cbV2.closest('.card').classList.contains('is-selected-for-compare'), true);
    });

    it('5.2 modal closes on close button, backdrop click, and Escape key', () => {
      const url = 'http://localhost/index.html?compare=01-frontend-design,02-ui-ux-pro-max';
      const env = createSimulatedBrowser(url);
      const doc = env.document;

      const launchBtn = doc.getElementById('compare-launch-btn');
      launchBtn.dispatchEvent({ type: 'click', bubbles: true });

      const modal = doc.getElementById('compare-modal-backdrop');
      assert.equal(modal.hasAttribute('hidden'), false, 'modal should open on launch click');

      // Test Escape keydown
      env.window.dispatchEvent({ type: 'keydown', key: 'Escape' });
      assert.equal(modal.hasAttribute('hidden'), true, 'modal must close on Escape key');

      // Re-open and test close button
      launchBtn.dispatchEvent({ type: 'click', bubbles: true });
      assert.equal(modal.hasAttribute('hidden'), false);
      const closeBtn = doc.getElementById('compare-modal-close');
      closeBtn.dispatchEvent({ type: 'click', bubbles: true });
      assert.equal(modal.hasAttribute('hidden'), true, 'modal must close on close button click');

      // Re-open and test backdrop click
      launchBtn.dispatchEvent({ type: 'click', bubbles: true });
      assert.equal(modal.hasAttribute('hidden'), false);
      modal.dispatchEvent({ type: 'click', target: modal });
      assert.equal(modal.hasAttribute('hidden'), true, 'modal must close on backdrop click');
    });
  });

  describe('5. Horizontal vs Longitudinal Comparison Disambiguation (F12)', () => {
    it('5.1 ensures visible disambiguation on index.html', () => {
      // Must contain longitudinal comparison label in edition switcher
      assert.ok(indexHtml.includes('跨实验纵向对比'), 'index.html must display longitudinal comparison header');
      assert.ok(indexHtml.includes('同版本横向比对'), 'index.html must display horizontal comparison badges/labels');
    });

    it('5.2 ensures visible disambiguation on detail.html', () => {
      const detailHtmlPath = join(REPO_ROOT, 'site', 'dist', 'runs', '01-frontend-design', 'detail.html');
      const detailHtml = readFileSync(detailHtmlPath, 'utf-8');

      assert.ok(detailHtml.includes('单 Skill 跨实验纵向对比'), 'detail.html eyebrow must state longitudinal comparison');
      assert.ok(detailHtml.includes('同版本横向比对'), 'detail.html lede must refer to horizontal comparison');
    });
  });

});
