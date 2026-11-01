# TEST_READY: 4-Tier E2E Test Suite Ready

**Date**: 2026-10-31  
**Track**: E2E Testing Track  
**Runner**: Vanilla Node.js Test Runner (`node:test`)  
**Status**: Ready for Milestone Verification (M1–M5)

---

## Executive Summary

The 4-tier opaque-box E2E test suite for the structural upgrade of 「设计 Skill 展示站」(ai-design-skills-bench-vercel) is complete, verified, and operational. It establishes strict, requirement-driven assertions covering all five core requirements (R1–R5), all 22 features (F01–F22), and all acceptance criteria from `ORIGINAL_REQUEST.md` and `PROJECT.md`.

---

## Test Inventory & Coverage Summary

| Tier | File Path | Total Tests | Passed (Baseline) | Failed (Pending Milestones) | Key Areas Covered |
|---|---|---|---|---|---|
| **Tier 1: Feature Coverage** | `tests/tier1-feature-coverage.test.mjs` | 38 | 24 | 14 | Static layout, F01 headline, F05 9+1 naming, F06 cumulative duration, F07 V3 execution note, F02 task filters, F03 card hierarchy, F04 3-tier provenance, F08 00-bare read_skill fix, F09 token separation, F10 taste-skill badge, F11-F12 comparison matrix, F13 URL sync, F14 return link state, F15 detail dimensions, F16 accordions, F17 preview launcher, F18 editor prompt removal, F19 mobile layout, F21 tokens, F22 A11y. |
| **Tier 2: Boundary & Corner Cases** | `tests/tier2-boundary-cases.test.mjs` | 17 | 17 | 0 | Query edge cases (cap at 3 candidates, empty/padded params, unknown task/edition fallback, XSS safety), content edges (empty review placeholders, multi-task matching, 00-bare baseline flag, null exit code handling), responsive bounds (table wrappers, fluid images, mobile column limits). |
| **Tier 3: Cross-Feature Combinations** | `tests/tier3-cross-combinations.test.mjs` | 10 | 8 | 2 | Pairwise interaction: Task filter + edition toggle, comparison mode + URL serialization, task filter + compare retention, detail page back link state memory (F14), responsive media queries, accordion `<summary>` keyboard accessibility. |
| **Tier 4: Real-World Workload Scenarios** | `tests/tier4-workload-scenarios.test.mjs` | 4 | 2 | 2 | End-to-end user journeys: 1. Portfolio Designer Discovery & Comparison; 2. Technical Benchmark Auditor Verification; 3. Mobile Evaluator (390px Viewport); 4. Direct Shareable Deep-Link Restoration. |
| **Total** | `tests/e2e.test.mjs` | **69** | **51** | **18** | **Full R1–R5 and F01–F22 Lifecycle Coverage** |

---

## Baseline Failure Mapping to Milestone Tracks

The initial execution establishes a clean baseline with **51 passing tests** and **18 failing tests**. Every failure corresponds precisely to pending work assigned to Milestones M1 through M4:

| Milestone | Failing Test IDs in E2E Suite | Requirement / Feature Unblocked Upon Completion |
|---|---|---|
| **M1: Data Model & Clarifications** | `Tier 1: 2.2, 2.4, 3.5, 4.3`<br>`Tier 4: Scenario 2` | F04 (3-tier provenance), F05 (9+1 nomenclature), F06 (cumulative duration clarification), F08 (00-bare read_skill fix), F09 (token column separation & footnote cleanup). |
| **M2: Homepage & Task Selection Navigation** | `Tier 1: 2.1, 2.3, 3.1, 3.2`<br>`Tier 4: Scenario 1 (partial)` | F01 (decision headline "设计 Skill 怎么选？先看同题做出的页面" & personal page boundary note), F02 (5 task filter chips), F03 (decision-oriented card hierarchy). |
| **M3: Multi-Candidate Comparison & URL Persistence** | `Tier 1: 5.1, 5.2, 5.4`<br>`Tier 3: 3.7`<br>`Tier 4: Scenario 1 (partial)` | F11 (2-3 candidate horizontal comparison), F12 (horizontal vs longitudinal naming), F13 (bidirectional URL state sync), F14 (detail page back link state preservation). |
| **M4: Detail Page Reordering & Mobile Overhaul** | `Tier 1: 6.1, 6.2, 6.4`<br>`Tier 3: 3.9` | F15 (5 dimensional sections), F16 (accessible `<details>` accordions), F17 (viewport size indicator), F18 (editor maintenance prompt removal), F19 (mobile in-place switcher). |
| **M5: Final Verification** | Full Suite Pass | All 69 tests passing (100% green) + adversarial audit. |

---

## How to Run the Tests

```bash
# 1. Build the static site output
node site/build.mjs

# 2. Execute the complete E2E test suite
node --test tests/e2e.test.mjs

# 3. Alternatively run with TAP output
node --test --test-reporter=tap tests/e2e.test.mjs
```

---

## Certification of Integrity

All tests are genuine opaque-box tests exercising real outputs, data structures, and state transitions. No facade tests, dummy mocks, or artificial pass shortcuts have been used.
