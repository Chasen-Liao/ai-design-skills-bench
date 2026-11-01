// tests/e2e.test.mjs
// Master Entry Point for 4-Tier E2E Test Suite
// Run via: node tests/e2e.test.mjs  OR  node --test tests/e2e.test.mjs

import './tier1-feature-coverage.test.mjs';
import './tier2-boundary-cases.test.mjs';
import './tier3-cross-combinations.test.mjs';
import './tier4-workload-scenarios.test.mjs';
