// tests/challenger-m2-multi-panel-url.test.mjs
// Adversarial Stress Test Suite: Multi-Panel Edition Switching & URL Parameter Initialization
// Executes the exact client-side runtime script from site/dist/index.html against a simulated DOM.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import vm from 'node:vm';
import { PROJECTS } from '../site/data/projects.mjs';

const REPO_ROOT = resolve('.');
const DIST_INDEX = join(REPO_ROOT, 'site', 'dist', 'index.html');
const indexHtml = readFileSync(DIST_INDEX, 'utf-8');

// Extract the inline script from index.html
const scriptMatch = indexHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i);
assert.ok(scriptMatch, 'site/dist/index.html must contain the client script');
const clientScriptSource = scriptMatch[1];

/**
 * Lightweight DOM element simulator for testing index.html runtime behavior
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
    this.checked = attrs.checked !== undefined ? true : false;
    this.textContent = '';
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
    const list = this.listeners[event.type] || [];
    for (const cb of list) {
      cb.call(this, event);
    }
    if (event.bubbles && this.parent) {
      this.parent.dispatchEvent(event);
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
    if (selector.startsWith('.')) {
      return this.classes.has(selector.slice(1));
    }
    if (selector.startsWith('#')) {
      return this.attributes.id === selector.slice(1);
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

  // Parse edition tabs: <button ... data-edition-tab="v2/v3" ...>
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

  // Match all task chips: <button ... data-task-filter="key" ...>
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

  // Deterministically slice V2 and V3 sections
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

      // Card links: handle any attribute order
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
      class: 'task-empty-state',
      hidden: '',
    });
    panelEl.appendChild(emptyEl);
  }

  // Create Window & Document Mock
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
    alert: () => {},
  };

  // Run the client script in this sandbox
  const sandbox = {
    window: windowMock,
    document: documentMock,
    URLSearchParams,
    alert: windowMock.alert,
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(clientScriptSource, sandbox);

  return { root, window: windowMock, document: documentMock };
}

describe('Challenger M2-5: Multi-Panel & URL Stress Testing', () => {

  describe('1. Task Filter Retention across V2 and V3 Panel Switching', () => {
    it('1.1 preserves active task filter selection when clicking from V3 to V2', () => {
      const env = createSimulatedBrowser('http://localhost/index.html');
      const doc = env.document;

      // Click filter chip 'style-ref'
      const styleRefChip = doc.querySelector('[data-task-filter="style-ref"]');
      assert.ok(styleRefChip, 'Chip style-ref must exist');
      styleRefChip.dispatchEvent({ type: 'click', bubbles: true, target: styleRefChip });

      // Verify chip is active
      assert.equal(styleRefChip.classList.contains('is-active'), true);
      assert.equal(styleRefChip.getAttribute('aria-selected'), 'true');

      // Verify cards in V3 panel
      const v3Panel = doc.querySelector('[data-edition="v3"]');
      assert.equal(v3Panel.hasAttribute('hidden'), false, 'V3 panel should be active initially');
      const v3Cards = v3Panel.querySelectorAll('.card');
      const v3VisibleCards = v3Cards.filter((c) => !c.hasAttribute('hidden')).map((c) => c.getAttribute('data-project-id'));
      assert.deepEqual(v3VisibleCards, ['02-ui-ux-pro-max', '04-oil-ui', '09-awesome-design-md']);

      // Now click V2 edition tab
      const v2Tab = doc.querySelector('[data-edition-tab="v2"]');
      assert.ok(v2Tab, 'V2 edition tab must exist');
      v2Tab.dispatchEvent({ type: 'click', bubbles: true, target: v2Tab });

      // Verify V2 tab and panel are now active
      assert.equal(v2Tab.classList.contains('is-active'), true, 'V2 tab must be active');
      assert.equal(v2Tab.getAttribute('aria-pressed'), 'true');
      const v2Panel = doc.querySelector('[data-edition="v2"]');
      assert.equal(v2Panel.hasAttribute('hidden'), false, 'V2 panel must be visible');
      assert.equal(v3Panel.hasAttribute('hidden'), true, 'V3 panel must now be hidden');

      // CRITICAL CHECK: Does style-ref filter chip STILL remain active?
      assert.equal(styleRefChip.classList.contains('is-active'), true, 'Task filter chip must remain active after switching panel');
      assert.equal(styleRefChip.getAttribute('aria-selected'), 'true');

      // CRITICAL CHECK: Are V2 panel cards PRESERVED with style-ref filter?
      const v2Cards = v2Panel.querySelectorAll('.card');
      const v2VisibleCards = v2Cards.filter((c) => !c.hasAttribute('hidden')).map((c) => c.getAttribute('data-project-id'));
      assert.deepEqual(
        v2VisibleCards,
        ['02-ui-ux-pro-max', '04-oil-ui', '09-awesome-design-md'],
        'V2 panel must preserve style-ref filter and display exactly matching cards',
      );
      const v2HiddenCards = v2Cards.filter((c) => c.hasAttribute('hidden'));
      assert.equal(v2HiddenCards.length, 7, 'Non-matching 7 cards in V2 panel must remain hidden');

      // Check URL synchronization retains both edition and task
      assert.ok(env.window.location.search.includes('edition=v2'), 'URL search must include edition=v2');
      assert.ok(env.window.location.search.includes('task=style-ref'), 'URL search must include task=style-ref');
    });

    it('1.2 preserves active task filter when switching back from V2 to V3', () => {
      const env = createSimulatedBrowser('http://localhost/index.html?edition=v2&task=portfolio');
      const doc = env.document;

      const portfolioChip = doc.querySelector('[data-task-filter="portfolio"]');
      assert.equal(portfolioChip.classList.contains('is-active'), true);

      // Verify V2 visible cards for portfolio
      const expectedPortfolio = PROJECTS.filter((p) => p.tasks && p.tasks.includes('portfolio')).map((p) => p.id);
      const v2Panel = doc.querySelector('[data-edition="v2"]');
      const v2Cards = v2Panel.querySelectorAll('.card');
      const v2VisibleCards = v2Cards.filter((c) => !c.hasAttribute('hidden')).map((c) => c.getAttribute('data-project-id'));
      assert.deepEqual(v2VisibleCards, expectedPortfolio);

      // Switch to V3
      const v3Tab = doc.querySelector('[data-edition-tab="v3"]');
      v3Tab.dispatchEvent({ type: 'click', bubbles: true, target: v3Tab });

      const v3Panel = doc.querySelector('[data-edition="v3"]');
      assert.equal(v3Panel.hasAttribute('hidden'), false);
      assert.equal(v2Panel.hasAttribute('hidden'), true);

      // Verify portfolio filter is still active
      assert.equal(portfolioChip.classList.contains('is-active'), true);

      // Verify V3 visible cards for portfolio
      const v3Cards = v3Panel.querySelectorAll('.card');
      const v3VisibleCards = v3Cards.filter((c) => !c.hasAttribute('hidden')).map((c) => c.getAttribute('data-project-id'));
      assert.deepEqual(v3VisibleCards, expectedPortfolio);
    });

    it('1.3 stress-tests switching across ALL task categories in sequence', () => {
      const env = createSimulatedBrowser('http://localhost/index.html');
      const doc = env.document;

      const categories = ['portfolio', 'landing', 'admin', 'prototype', 'style-ref', 'all'];

      for (const cat of categories) {
        // Select category
        const chip = doc.querySelector(`[data-task-filter="${cat}"]`);
        assert.ok(chip, `Chip ${cat} must exist`);
        chip.dispatchEvent({ type: 'click', bubbles: true, target: chip });

        // Switch to V2
        const v2Tab = doc.querySelector('[data-edition-tab="v2"]');
        v2Tab.dispatchEvent({ type: 'click', bubbles: true, target: v2Tab });

        // Verify chip still active
        assert.equal(chip.classList.contains('is-active'), true, `Chip ${cat} must be active on V2`);

        // Switch back to V3
        const v3Tab = doc.querySelector('[data-edition-tab="v3"]');
        v3Tab.dispatchEvent({ type: 'click', bubbles: true, target: v3Tab });

        // Verify chip still active
        assert.equal(chip.classList.contains('is-active'), true, `Chip ${cat} must be active on V3`);
      }
    });
  });

  describe('2. URL Query Parameter Initialization on Page Load', () => {
    it('2.1 boots with ?task=style-ref&edition=v2 and initializes tab, panel, chip, and card states', () => {
      const env = createSimulatedBrowser('http://localhost/index.html?task=style-ref&edition=v2');
      const doc = env.document;

      // 1. Active Tab
      const v2Tab = doc.querySelector('[data-edition-tab="v2"]');
      const v3Tab = doc.querySelector('[data-edition-tab="v3"]');
      assert.equal(v2Tab.classList.contains('is-active'), true, 'V2 tab must have is-active');
      assert.equal(v2Tab.getAttribute('aria-pressed'), 'true', 'V2 tab must have aria-pressed="true"');
      assert.equal(v3Tab.classList.contains('is-active'), false, 'V3 tab must NOT have is-active');
      assert.equal(v3Tab.getAttribute('aria-pressed'), 'false', 'V3 tab must have aria-pressed="false"');

      // 2. Visible Panel
      const v2Panel = doc.querySelector('[data-edition="v2"]');
      const v3Panel = doc.querySelector('[data-edition="v3"]');
      assert.equal(v2Panel.hasAttribute('hidden'), false, 'V2 panel must NOT have hidden attribute');
      assert.equal(v3Panel.hasAttribute('hidden'), true, 'V3 panel MUST have hidden attribute');

      // 3. Active Task Chip
      const styleRefChip = doc.querySelector('[data-task-filter="style-ref"]');
      const allChip = doc.querySelector('[data-task-filter="all"]');
      assert.equal(styleRefChip.classList.contains('is-active'), true, 'style-ref chip must have is-active');
      assert.equal(styleRefChip.getAttribute('aria-selected'), 'true', 'style-ref chip must have aria-selected="true"');
      assert.equal(allChip.classList.contains('is-active'), false, 'all chip must NOT have is-active');

      // 4. Filtered Cards in V2 Panel
      const v2Cards = v2Panel.querySelectorAll('.card');
      const v2Visible = v2Cards.filter((c) => !c.hasAttribute('hidden')).map((c) => c.getAttribute('data-project-id'));
      const v2Hidden = v2Cards.filter((c) => c.hasAttribute('hidden')).map((c) => c.getAttribute('data-project-id'));

      assert.deepEqual(v2Visible, ['02-ui-ux-pro-max', '04-oil-ui', '09-awesome-design-md']);
      assert.equal(v2Hidden.length, 7);

      // Verify aria-hidden attributes
      for (const card of v2Cards) {
        const pid = card.getAttribute('data-project-id');
        if (v2Visible.includes(pid)) {
          assert.equal(card.getAttribute('aria-hidden'), 'false');
          assert.equal(card.classList.contains('is-filtered-out'), false);
        } else {
          assert.equal(card.getAttribute('aria-hidden'), 'true');
          assert.equal(card.classList.contains('is-filtered-out'), true);
        }
      }

      // 5. Live Region
      const liveRegion = doc.querySelector('#task-filter-live');
      assert.ok(liveRegion.textContent.includes('已有风格参考'), 'Live region text must announce style-ref');
      assert.ok(liveRegion.textContent.includes('展示 3 个项目'), 'Live region text must announce 3 projects');

      // 6. Card Links
      const cardLinks = v2Panel.querySelectorAll('a');
      assert.ok(cardLinks.length > 0, 'Card links must exist in V2 panel');
      for (const link of cardLinks) {
        const href = link.getAttribute('href');
        assert.ok(href.includes('edition=v2'), `Link ${href} must have edition=v2`);
        assert.ok(href.includes('task=style-ref'), `Link ${href} must have task=style-ref`);
      }
    });

    it('2.2 boots with reversed query order ?edition=v2&task=landing', () => {
      const env = createSimulatedBrowser('http://localhost/index.html?edition=v2&task=landing');
      const doc = env.document;

      const v2Tab = doc.querySelector('[data-edition-tab="v2"]');
      assert.equal(v2Tab.classList.contains('is-active'), true);

      const landingChip = doc.querySelector('[data-task-filter="landing"]');
      assert.equal(landingChip.classList.contains('is-active'), true);

      const expectedLanding = PROJECTS.filter((p) => p.tasks && p.tasks.includes('landing')).map((p) => p.id);
      const v2Panel = doc.querySelector('[data-edition="v2"]');
      const v2Visible = v2Panel.querySelectorAll('.card').filter((c) => !c.hasAttribute('hidden')).map((c) => c.getAttribute('data-project-id'));
      assert.deepEqual(v2Visible, expectedLanding);
    });

    it('2.3 fallback: boots with invalid task ?task=nonexistent&edition=v2', () => {
      const env = createSimulatedBrowser('http://localhost/index.html?task=nonexistent&edition=v2');
      const doc = env.document;

      // Edition should still be V2
      const v2Tab = doc.querySelector('[data-edition-tab="v2"]');
      assert.equal(v2Tab.classList.contains('is-active'), true);

      // Task should fallback to 'all'
      const allChip = doc.querySelector('[data-task-filter="all"]');
      assert.equal(allChip.classList.contains('is-active'), true);

      // All 10 cards visible in V2
      const v2Panel = doc.querySelector('[data-edition="v2"]');
      const v2Visible = v2Panel.querySelectorAll('.card').filter((c) => !c.hasAttribute('hidden'));
      assert.equal(v2Visible.length, 10);
    });

    it('2.4 boots with hash fallback #v2', () => {
      const env = createSimulatedBrowser('http://localhost/index.html#v2');
      const doc = env.document;

      const v2Tab = doc.querySelector('[data-edition-tab="v2"]');
      assert.equal(v2Tab.classList.contains('is-active'), true);
      const v2Panel = doc.querySelector('[data-edition="v2"]');
      assert.equal(v2Panel.hasAttribute('hidden'), false);
    });

    it('2.5 browser history navigation (popstate event)', () => {
      const env = createSimulatedBrowser('http://localhost/index.html?edition=v2&task=style-ref');
      const doc = env.document;

      // Initial state is V2, style-ref
      let v2Panel = doc.querySelector('[data-edition="v2"]');
      assert.equal(v2Panel.hasAttribute('hidden'), false);

      // Simulate popstate navigation back to default (V3, all)
      env.window.location.search = '';
      env.window.dispatchEvent({ type: 'popstate' });

      const v3Panel = doc.querySelector('[data-edition="v3"]');
      v2Panel = doc.querySelector('[data-edition="v2"]');
      assert.equal(v3Panel.hasAttribute('hidden'), false, 'V3 panel must be active after popstate to default');
      assert.equal(v2Panel.hasAttribute('hidden'), true, 'V2 panel must be hidden after popstate to default');

      const allChip = doc.querySelector('[data-task-filter="all"]');
      assert.equal(allChip.classList.contains('is-active'), true, 'all chip must be active after popstate to default');
    });

    it('2.6 boots with uppercase URL params and extra query parameters', () => {
      const env = createSimulatedBrowser('http://localhost/index.html?task=STYLE-REF&edition=V2&utm_source=twitter&ref=hackernews');
      const doc = env.document;

      const v2Tab = doc.querySelector('[data-edition-tab="v2"]');
      assert.equal(v2Tab.classList.contains('is-active'), true);
      const v2Panel = doc.querySelector('[data-edition="v2"]');
      assert.equal(v2Panel.hasAttribute('hidden'), false);

      const styleRefChip = doc.querySelector('[data-task-filter="style-ref"]');
      assert.equal(styleRefChip.classList.contains('is-active'), true);

      const v2Visible = v2Panel.querySelectorAll('.card').filter((c) => !c.hasAttribute('hidden')).map((c) => c.getAttribute('data-project-id'));
      assert.deepEqual(v2Visible, ['02-ui-ux-pro-max', '04-oil-ui', '09-awesome-design-md']);
    });

    it('2.7 multi-feature URL initialization (task + edition + compare candidates)', () => {
      const env = createSimulatedBrowser('http://localhost/index.html?task=style-ref&edition=v2&compare=02-ui-ux-pro-max,04-oil-ui');
      const doc = env.document;

      // Edition & Task
      assert.equal(doc.querySelector('[data-edition-tab="v2"]').classList.contains('is-active'), true);
      assert.equal(doc.querySelector('[data-task-filter="style-ref"]').classList.contains('is-active'), true);

      // Compare Checkboxes
      const cb02 = doc.querySelector('[data-compare-id="02-ui-ux-pro-max"]');
      const cb04 = doc.querySelector('[data-compare-id="04-oil-ui"]');
      const cb09 = doc.querySelector('[data-compare-id="09-awesome-design-md"]');
      assert.ok(cb02 && cb04 && cb09, 'Checkboxes for style-ref cards must exist');
      assert.equal(cb02.checked, true, '02 must be checked');
      assert.equal(cb04.checked, true, '04 must be checked');
      assert.equal(cb09.checked, false, '09 must NOT be checked');
    });
  });
});

