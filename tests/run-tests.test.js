/**
 * @file tests/run-tests.test.js
 * @description Tests for scripts/run-tests.mjs (the `npm test` runner): failure detection (including "soft"
 * suites that exit 0), the orphan guard, quarantine, timeouts and the report. The runner is driven on throwaway
 * temp trees (`--root`), never on the real manifest, so this suite cannot recurse into `npm test`.
 *
 * Careful: the runner flags any suite whose OUTPUT contains "<n> Failed" (n > 0) or the failure marker, test
 * titles included. So the titles below describe those patterns in words instead of printing them.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateSuiteResult, countPassed, findOrphans, validateManifest, parseArgs, REPO_ROOT
} from '../scripts/run-tests.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(REPO_ROOT, 'scripts', 'run-tests.mjs');
const SOFT_FAIL_FIXTURE = path.join(here, 'fixtures', 'soft-fail.js');

const PASSING = "console.log('Test Results: 3 Passed, 0 Failed');\n";
const FAILING = "console.error('boom'); process.exit(1);\n";
const HANGING = 'setInterval(() => {}, 1000);\n';

let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log(`  ✅ PASS: ${name}`);
}

const tempRoots = [];
/** Build a throwaway tree: `files` is {relativePath: content}, `manifest` is written to tests/manifest.json. */
function makeTree(files, manifest) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-tests-'));
  tempRoots.push(root);
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tests', 'manifest.json'), JSON.stringify(manifest));
  return root;
}

function runRunner(root, args = []) {
  const run = spawnSync(process.execPath, [RUNNER, '--root', root, ...args], { encoding: 'utf8', timeout: 60000 });
  return { status: run.status, out: run.stdout || '', err: run.stderr || '' };
}

const suite = (id, file) => ({ id, file, area: 'test' });
const quarantined = (id, file) => ({ id, file, reason: 'known broken', task: 'TST-XX' });

try {
  // ---- evaluateSuiteResult: how a finished suite is judged ----------------------------------------------------
  check('a clean exit with a zero-failure tally is a pass', () => {
    assert.deepEqual(evaluateSuiteResult({ status: 0, stdout: 'Test Results: 12 Passed, 0 Failed' }), { ok: true, reasons: [] });
    assert.equal(evaluateSuiteResult({ status: 0, stdout: '13 passed, 0 failed' }).ok, true);
  });
  check('a non-zero exit code is a failure', () => {
    const verdict = evaluateSuiteResult({ status: 1, stdout: '' });
    assert.equal(verdict.ok, false);
    assert.match(verdict.reasons[0], /exit code 1/);
  });
  check('a soft suite that tallies failures but exits 0 is a failure', () => {
    const verdict = evaluateSuiteResult({ status: 0, stdout: 'Test Results: 5 Passed, 2 Failed' });
    assert.equal(verdict.ok, false);
    assert.match(verdict.reasons.join(), /reports 2 failed/);
  });
  check('a failure marker line is a failure even without a tally', () => {
    assert.equal(evaluateSuiteResult({ status: 0, stderr: '  ❌ FAIL: something broke' }).ok, false);
  });
  check('a timeout or a signal is a failure', () => {
    assert.match(evaluateSuiteResult({ status: null, error: Object.assign(new Error('x'), { code: 'ETIMEDOUT' }) }).reasons[0], /timed out/);
    assert.match(evaluateSuiteResult({ status: null, signal: 'SIGKILL' }).reasons[0], /SIGKILL/);
  });
  check('countPassed reads the last "N passed" in the output', () => {
    assert.equal(countPassed('a\n10 Passed, 0 Failed\nTotal: 25 Passed, 0 Failed'), 25);
    assert.equal(countPassed('no tally here'), null);
  });
  check('parseArgs accepts the documented flags and rejects the rest', () => {
    const options = parseArgs(['--only', 'x', '--include-quarantine', '--report', 'r.json', '--timeout', '5']);
    assert.equal(options.only, 'x');
    assert.equal(options.includeQuarantine, true);
    assert.equal(options.timeoutS, 5);
    assert.throws(() => parseArgs(['--nope']), /unknown argument/);
    assert.throws(() => parseArgs(['--only']), /needs a value/);
  });

  // ---- the real repository: manifest sound, no orphan --------------------------------------------------------
  const realManifest = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
  check('the real manifest is sound (ids unique, every file exists)', () => {
    assert.deepEqual(validateManifest(REPO_ROOT, realManifest), []);
  });
  check('the real repository has no orphan test file', () => {
    assert.deepEqual(findOrphans(REPO_ROOT, realManifest), []);
  });

  // ---- the runner end to end, on temp trees ------------------------------------------------------------------
  check('an all-green tree exits 0 and says GREEN', () => {
    const root = makeTree({ 'test-a.js': PASSING, 'scripts/test-b.js': PASSING }, { suites: [suite('a', 'test-a.js'), suite('b', 'scripts/test-b.js')], quarantine: [] });
    const { status, out } = runRunner(root);
    assert.equal(status, 0, out);
    assert.match(out, /2\/2 suites passed/);
    assert.match(out, /GREEN/);
  });

  check('a red suite does not stop the later suites, and the run exits 1', () => {
    const root = makeTree({ 'test-a.js': FAILING, 'test-b.js': PASSING }, { suites: [suite('a', 'test-a.js'), suite('b', 'test-b.js')], quarantine: [] });
    const { status, out, err } = runRunner(root);
    assert.equal(status, 1);
    assert.match(out, /▶ a \.\.\. ❌/);
    assert.match(out, /▶ b \.\.\. ✅/);
    assert.match(err, /NOT GREEN — failed suites: a/);
  });

  check('the soft-fail fixture (tallies a failure, exits 0) is caught as a failure', () => {
    const direct = spawnSync(process.execPath, [SOFT_FAIL_FIXTURE], { encoding: 'utf8' });
    assert.equal(direct.status, 0, 'the fixture itself must exit 0, that is the whole point of it');
    const root = makeTree({ 'test-soft.js': fs.readFileSync(SOFT_FAIL_FIXTURE, 'utf8') }, { suites: [suite('soft', 'test-soft.js')], quarantine: [] });
    const { status, out } = runRunner(root);
    assert.equal(status, 1, out);
    assert.match(out, /reports 1 failed/);
  });

  check('orphan guard: an unlisted test-dummy.js fails the run, listing it fixes it', () => {
    const files = { 'test-a.js': PASSING, 'test-dummy.js': PASSING };
    const root = makeTree(files, { suites: [suite('a', 'test-a.js')], quarantine: [] });
    const bad = runRunner(root);
    assert.equal(bad.status, 1);
    assert.match(bad.err, /orphan test file: test-dummy\.js/);
    const good = makeTree(files, { suites: [suite('a', 'test-a.js'), suite('dummy', 'test-dummy.js')], quarantine: [] });
    assert.equal(runRunner(good).status, 0);
  });

  check('orphan guard covers scripts/test-*.js and tests/*.test.js but not fixtures or helpers', () => {
    const root = makeTree(
      { 'scripts/test-x.js': PASSING, 'tests/y.test.js': PASSING, 'tests/fixtures/z.js': PASSING, 'scripts/helper.js': PASSING, 'notes-test.js': PASSING },
      { suites: [], quarantine: [] }
    );
    assert.deepEqual(findOrphans(root, { suites: [], quarantine: [] }), ['scripts/test-x.js', 'tests/y.test.js']);
  });

  check('a manifest entry pointing at a missing file fails the run', () => {
    const root = makeTree({}, { suites: [suite('ghost', 'test-ghost.js')], quarantine: [] });
    const { status, err } = runRunner(root);
    assert.equal(status, 1);
    assert.match(err, /missing file: test-ghost\.js/);
  });

  check('quarantine: a broken quarantined suite is listed, not run, and does not fail the run', () => {
    const root = makeTree({ 'test-a.js': PASSING, 'test-q.js': FAILING }, { suites: [suite('a', 'test-a.js')], quarantine: [quarantined('q', 'test-q.js')] });
    const { status, out } = runRunner(root);
    assert.equal(status, 0, out);
    assert.match(out, /QUARANTINED.*TST-XX: known broken/);
    assert.doesNotMatch(out, /▶ q/);
  });

  check('--include-quarantine runs it and its failure now counts', () => {
    const root = makeTree({ 'test-a.js': PASSING, 'test-q.js': FAILING }, { suites: [suite('a', 'test-a.js')], quarantine: [quarantined('q', 'test-q.js')] });
    const { status, out } = runRunner(root, ['--include-quarantine']);
    assert.equal(status, 1);
    assert.match(out, /▶ q \.\.\. ❌/);
    assert.match(out, /FAIL \(quar\.\)/);
  });

  check('a hanging suite is killed by --timeout and counts as failed', () => {
    const root = makeTree({ 'test-hang.js': HANGING }, { suites: [suite('hang', 'test-hang.js')], quarantine: [] });
    const { status, out } = runRunner(root, ['--timeout', '1']);
    assert.equal(status, 1);
    assert.match(out, /timed out/);
  });

  check('--only runs a single suite; an unknown id is an error', () => {
    const root = makeTree({ 'test-a.js': PASSING, 'test-b.js': FAILING }, { suites: [suite('a', 'test-a.js'), suite('b', 'test-b.js')], quarantine: [] });
    const only = runRunner(root, ['--only', 'a']);
    assert.equal(only.status, 0, only.out);
    assert.doesNotMatch(only.out, /▶ b/);
    assert.equal(runRunner(root, ['--only', 'nope']).status, 2);
  });

  check('--report writes a JSON report without the suite output', () => {
    const root = makeTree({ 'test-a.js': PASSING }, { suites: [suite('a', 'test-a.js')], quarantine: [] });
    const reportPath = path.join(root, 'out', 'report.json');
    assert.equal(runRunner(root, ['--report', reportPath]).status, 0);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.ok, true);
    assert.equal(report.results.length, 1);
    assert.equal(report.results[0].id, 'a');
    assert.equal('output' in report.results[0], false);
  });

  check('a bad argument exits 2', () => {
    const root = makeTree({}, { suites: [], quarantine: [] });
    assert.equal(runRunner(root, ['--bogus']).status, 2);
  });

  console.log(`\nRunner Tests: ${checks} Passed, 0 Failed`);
} finally {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
}
