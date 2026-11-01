// tests/challenger-m2-adversarial-filter.test.mjs
// Adversarial test for client-side filter logic and regex escaping

import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PROJECTS } from '../site/data/projects.mjs';

const REPO_ROOT = resolve('.');
const DIST_INDEX = join(REPO_ROOT, 'site', 'dist', 'index.html');

describe('Adversarial Filter Stress Test', () => {
  const indexHtml = readFileSync(DIST_INDEX, 'utf-8');

  it('checks if client-side regex in site/dist/index.html splits by literal "s" or whitespace', () => {
    const scriptMatch = indexHtml.match(/function applyTaskFilter\(taskId\)[\s\S]*?rawTasks\s*\.split\(([^)]+)\)/);
    assert.ok(scriptMatch, 'applyTaskFilter must exist in index.html');
    const regexLiteral = scriptMatch[1].trim();

    // Check what the regex literal is in the HTML
    assert.notEqual(
      regexLiteral,
      '/[,s]+/',
      'BUG CONFIRMED: index.html contains .split(/[,s]+/) which splits strings on the letter "s" instead of whitespace \\s!',
    );
  });

  it('empirically verifies browser filtering behavior for every task category', () => {
    // Extract cards from V3 panel
    const v3Match = indexHtml.match(/id="v3"[\s\S]*?(?:id="v2"|<\/main>)/i);
    assert.ok(v3Match, 'V3 section must exist');
    const cards = [...v3Match[0].matchAll(/<article\s+class="card"[^>]*data-project-id="([^"]+)"[^>]*data-tasks="([^"]*)"/g)];
    assert.equal(cards.length, 10, 'Expected 10 cards in V3');

    // Extract the exact split regex from index.html
    const scriptMatch = indexHtml.match(/function applyTaskFilter\(taskId\)[\s\S]*?rawTasks\s*\.split\(([^)]+)\)/);
    const regexLiteral = scriptMatch[1].trim();
    const splitRegex = eval(regexLiteral);

    const tasksToTest = ['all', 'portfolio', 'landing', 'admin', 'prototype', 'style-ref'];

    for (const taskId of tasksToTest) {
      const matchingCards = [];
      for (const card of cards) {
        const projectId = card[1];
        const rawTasks = card[2];
        const cardTasks = rawTasks
          .split(splitRegex)
          .map((t) => t.trim().toLowerCase());

        const isMatch = taskId === 'all' || cardTasks.indexOf(taskId) !== -1;
        if (isMatch) {
          matchingCards.push(projectId);
        }
      }

      const expectedMatchingProjects = PROJECTS
        .filter((p) => taskId === 'all' || (p.tasks && p.tasks.includes(taskId)))
        .map((p) => p.id);

      assert.deepEqual(
        matchingCards,
        expectedMatchingProjects,
        `Task filter "${taskId}" failed: expected projects [${expectedMatchingProjects.join(', ')}], but got [${matchingCards.join(', ')}]`,
      );
    }
  });
});
