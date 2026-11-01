// tests/helpers/client-sim.mjs
// Simulator for client-side state machine, URL serialization, and candidate selection contracts.

export const VALID_TASKS = ['all', 'portfolio', 'landing', 'admin', 'prototype', 'style-ref'];
export const VALID_EDITIONS = ['v3', 'v2'];
export const MAX_COMPARE_CANDIDATES = 3;

/**
 * Parse URL query/hash string into structured application state.
 * Supports: `?task=portfolio&edition=v3&compare=01-frontend-design,02-ui-ux-pro-max`
 * or hash variants `#task=...` or `#v2`.
 */
export function parseStateFromUrl(urlString) {
  let queryPart = '';
  let hashPart = '';

  try {
    const parsed = new URL(urlString, 'http://localhost');
    queryPart = parsed.search.replace(/^\?/, '');
    hashPart = parsed.hash.replace(/^#/, '');
  } catch {
    const qIdx = urlString.indexOf('?');
    const hIdx = urlString.indexOf('#');
    if (qIdx !== -1) {
      queryPart = urlString.slice(qIdx + 1, hIdx !== -1 ? hIdx : undefined);
    }
    if (hIdx !== -1) {
      hashPart = urlString.slice(hIdx + 1);
    }
  }

  const queryParams = new URLSearchParams(queryPart);

  // Default state
  let edition = 'v3';
  let task = 'all';
  let compare = [];

  // Parse edition from query or hash
  if (queryParams.has('edition')) {
    const ed = queryParams.get('edition').toLowerCase();
    if (VALID_EDITIONS.includes(ed)) {
      edition = ed;
    }
  } else if (VALID_EDITIONS.includes(hashPart.toLowerCase())) {
    edition = hashPart.toLowerCase();
  }

  // Parse task from query
  if (queryParams.has('task')) {
    const t = queryParams.get('task').toLowerCase();
    if (VALID_TASKS.includes(t)) {
      task = t;
    } else {
      // Unknown task fallback
      task = 'all';
    }
  }

  // Parse compare candidates from query
  if (queryParams.has('compare')) {
    const rawCompare = queryParams.get('compare');
    if (rawCompare) {
      const candidates = rawCompare
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      // Cap at MAX_COMPARE_CANDIDATES
      compare = candidates.slice(0, MAX_COMPARE_CANDIDATES);
    }
  }

  return { edition, task, compare };
}

/**
 * Serialize application state into canonical URL query string.
 */
export function serializeStateToUrl(state, basePath = 'index.html') {
  const params = new URLSearchParams();

  if (state.edition && state.edition !== 'v3') {
    params.set('edition', state.edition);
  }
  if (state.task && state.task !== 'all') {
    params.set('task', state.task);
  }
  if (Array.isArray(state.compare) && state.compare.length > 0) {
    const capped = state.compare.slice(0, MAX_COMPARE_CANDIDATES);
    params.set('compare', capped.join(','));
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/**
 * Simulate toggling a candidate in the compare list.
 * Enforces maximum 3 candidates limit.
 */
export function toggleCompareCandidate(currentList, candidateId) {
  const list = [...(currentList || [])];
  const idx = list.indexOf(candidateId);
  if (idx !== -1) {
    list.splice(idx, 1);
    return { list, added: false, removed: true, reachedLimit: false };
  }
  if (list.length >= MAX_COMPARE_CANDIDATES) {
    return { list, added: false, removed: false, reachedLimit: true };
  }
  list.push(candidateId);
  return { list, added: true, removed: false, reachedLimit: false };
}

/**
 * Filter projects by task category.
 */
export function filterProjectsByTask(projects, taskCategory) {
  if (!taskCategory || taskCategory === 'all') return [...projects];
  return projects.filter((p) => {
    if (!Array.isArray(p.tasks)) return false;
    return p.tasks.includes(taskCategory);
  });
}

/**
 * Generate detail page return link preserving state.
 */
export function buildReturnLink(state, relativePrefix = '../../index.html') {
  const params = new URLSearchParams();
  if (state?.edition) params.set('edition', state.edition);
  if (state?.task && state.task !== 'all') params.set('task', state.task);
  if (state?.compare && state.compare.length > 0) {
    params.set('compare', state.compare.slice(0, MAX_COMPARE_CANDIDATES).join(','));
  }
  const qs = params.toString();
  return qs ? `${relativePrefix}?${qs}` : relativePrefix;
}
