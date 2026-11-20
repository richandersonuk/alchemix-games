// Sanity checks for the shared client/server modules. Run: npm run test:shared (Node ≥ 22.18)
import assert from 'node:assert/strict';
import { WAVES } from '../src/data/waves.ts';
import { WAVE_THREATS, computeScore, validateSummary } from '../shared/scoring.js';
import { checkName, randomAlias } from '../shared/nameFilter.js';

// 1. Wave sizes in shared/scoring.js match the game data
assert.deepEqual(WAVE_THREATS, WAVES.map((w) => w.groups.reduce((a, g) => a + g.count, 0)), 'WAVE_THREATS out of sync with src/data/waves.ts');

// 2. Name filter — allowed names (Scunthorpe-style false positives)
for (const n of ['Rich', 'Crystal Kid', 'MgO_Master', 'Class 10B', 'Grape Ape', 'Arsenal Fan', 'Scientist', 'Titanium', 'Methane Max', 'Crisis Avert', 'Raccoon', 'Peacock', 'Sussex Sam', 'J.Smith', 'Analytical'])
  assert.ok(checkName(n).ok, `false positive: ${n}`);

// 3. Blocked: personal info, impersonation, charset, length
for (const n of ['my snap is x', 'insta_jo', 'call 07712345678', 'www.site.com', 'mysite.com', 'admin', 'Teacher', 'ab', 'x'.repeat(20), '<script>'])
  assert.equal(checkName(n).ok, false, `should block: ${n}`);

// 4. Blocked: profanity + evasion (encoded so the test file stays clean)
for (const n of JSON.parse(Buffer.from('WyJmdWNrIiwiRnVVdUNrIHlvdSIsInNoMXQiLCJiMXRjaCIsIm4xZ2c0IiwiYSBzIHMiLCJCaWdBc3MiLCJreXMiLCJjIHUgbiB0IiwiRsO8Y2siLCJwcjFjayIsIm1ldGgiXQ==', 'base64').toString('utf8')))
  assert.equal(checkName(n).ok, false, 'profanity sample slipped through');

for (let i = 0; i < 500; i++) assert.ok(checkName(randomAlias()).ok, 'alias failed filter');

// 5. Score validation
const good = { wavesCleared: 3, marks: 9, neutralised: 40, coreRemaining: 72, victory: false, durationSec: 120, towersLost: 2 };
assert.ok(validateSummary(good).ok);
assert.equal(computeScore(good), 9 * 150 + 3 * 400 + 40 * 10);
assert.equal(validateSummary({ ...good, neutralised: 9999 }).ok, false);
assert.equal(validateSummary({ ...good, victory: true }).ok, false);
assert.equal(validateSummary({ ...good, durationSec: 5 }).ok, false);
assert.equal(validateSummary({ ...good, marks: 1.5 }).ok, false);

console.log('shared checks passed');
