#!/usr/bin/env node
/**
 * @file scripts/run-tests.mjs
 * @description Runs every Node test suite listed in tests/manifest.json and reports honestly.
 *
 * Why it exists: `npm test` used to be one long `a && b && c` chain. A red suite hid every suite after it, six
 * test files were not in the chain at all, and "soft" suites that only print `1 Failed` exited 0.
 *
 *  - Every suite runs (no stop at the first failure); the exit code is 1 if any non-quarantined suite failed.
 *  - A suite fails when it exits non-zero, times out, prints `N Failed` with N > 0, or prints `❌ FAIL`.
 *    (The whole output is scanned, so a suite must not print "<n> Failed" with n > 0 or the failure marker
 *    for any other reason, test titles included.)
 *  - Orphan guard: a file matching test-*.js, scripts/test-*.js or tests/*.test.js that is in neither `suites`
 *    nor `quarantine` makes the run fail, so a new test can never be forgotten.
 *  - Quarantined suites are known-broken (each names the task that fixes it). They are listed, not run, unless
 *    --include-quarantine is passed; then their failures count.
 *
 * Usage:  node scripts/run-tests.mjs [--only <id>] [--include-quarantine] [--report <path>]
 *                                    [--root <dir>] [--manifest <path>] [--timeout <seconds>]
 *   --root / --manifest / --timeout exist mainly so tests/run-tests.test.js can drive the runner on a temp tree.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_TIMEOUT_S = 180;
const MAX_BUFFER = 64 * 1024 * 1024;
const FAILURE_TAIL_LINES = 60;

/** Where test files may live, as [directory relative to the root, file-name test]. Keep in sync with the docs above. */
const SUITE_LOCATIONS = [
  ['.', (name) => /^test-.+\.js$/.test(name)],
  ['scripts', (name) => /^test-.+\.js$/.test(name)],
  ['tests', (name) => /^.+\.test\.js$/.test(name)]
];

/**
 * Decide whether a finished suite passed, from what it printed and how it exited.
 * @param {{status: number|null, signal?: string|null, error?: Error|null, stdout?: string, stderr?: string}} result
 * @returns {{ok: boolean, reasons: string[]}}
 */
export function evaluateSuiteResult(result) {
  const reasons = [];
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;

  if (result.error) reasons.push(result.error.code === 'ETIMEDOUT' ? 'timed out' : `could not run: ${result.error.message}`);
  else if (result.signal) reasons.push(`killed by ${result.signal}`);
  else if (result.status !== 0) reasons.push(`exit code ${result.status}`);

  // Soft tests print their own tally ("12 Passed, 1 Failed") and may still exit 0.
  let softFailed = 0;
  for (const match of output.matchAll(/\b(\d+)\s+failed\b/gi)) softFailed = Math.max(softFailed, Number(match[1]));
  if (softFailed > 0) reasons.push(`reports ${softFailed} failed`);
  if (output.includes('❌ FAIL')) reasons.push("prints '❌ FAIL'");

  return { ok: reasons.length === 0, reasons };
}

/** Best-effort count of passed assertions: the last "N passed" the suite printed. Not authoritative. */
export function countPassed(output) {
  let last = null;
  for (const match of String(output).matchAll(/\b(\d+)\s+passed\b/gi)) last = Number(match[1]);
  return last;
}

/**
 * Test files on disk that the manifest does not know about.
 * @param {string} root
 * @param {{suites?: Array<{file: string}>, quarantine?: Array<{file: string}>}} manifest
 * @returns {string[]} root-relative POSIX paths
 */
export function findOrphans(root, manifest) {
  const known = new Set([...(manifest.suites || []), ...(manifest.quarantine || [])].map((entry) => entry.file));
  const orphans = [];
  for (const [dir, matches] of SUITE_LOCATIONS) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isFile() || !matches(entry.name)) continue;
      const rel = dir === '.' ? entry.name : `${dir}/${entry.name}`;
      if (!known.has(rel)) orphans.push(rel);
    }
  }
  return orphans.sort();
}

/**
 * Structural problems in the manifest itself: duplicate ids/files, files that do not exist, malformed entries.
 * @returns {string[]} human-readable problems (empty when the manifest is sound)
 */
export function validateManifest(root, manifest) {
  const problems = [];
  const ids = new Set();
  const files = new Set();
  const lists = [['suites', manifest.suites], ['quarantine', manifest.quarantine]];
  for (const [listName, entries] of lists) {
    if (!Array.isArray(entries)) { problems.push(`manifest.${listName} must be an array`); continue; }
    for (const entry of entries) {
      if (!entry || typeof entry.id !== 'string' || typeof entry.file !== 'string') {
        problems.push(`manifest.${listName} has an entry without string "id" and "file": ${JSON.stringify(entry)}`);
        continue;
      }
      if (listName === 'quarantine' && (!entry.reason || !entry.task)) problems.push(`quarantine "${entry.id}" needs a "reason" and a "task"`);
      if (ids.has(entry.id)) problems.push(`duplicate suite id "${entry.id}"`);
      if (files.has(entry.file)) problems.push(`file listed twice: ${entry.file}`);
      ids.add(entry.id);
      files.add(entry.file);
      if (!fs.existsSync(path.join(root, entry.file))) problems.push(`${listName} "${entry.id}" points to a missing file: ${entry.file}`);
    }
  }
  return problems;
}

export function parseArgs(argv) {
  const options = { only: null, includeQuarantine: false, report: null, root: REPO_ROOT, manifest: null, timeoutS: DEFAULT_TIMEOUT_S };
  const needsValue = (flag, value) => {
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--include-quarantine') options.includeQuarantine = true;
    else if (arg === '--only') options.only = needsValue(arg, argv[++i]);
    else if (arg === '--report') options.report = needsValue(arg, argv[++i]);
    else if (arg === '--root') options.root = path.resolve(needsValue(arg, argv[++i]));
    else if (arg === '--manifest') options.manifest = path.resolve(needsValue(arg, argv[++i]));
    else if (arg === '--timeout') {
      options.timeoutS = Number(needsValue(arg, argv[++i]));
      if (!(options.timeoutS > 0)) throw new Error('--timeout needs a positive number of seconds');
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function runSuite(root, entry, timeoutS) {
  const started = process.hrtime.bigint();
  const run = spawnSync(process.execPath, [entry.file], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    timeout: timeoutS * 1000,
    env: process.env
  });
  const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const verdict = evaluateSuiteResult(run);
  return { ...entry, ok: verdict.ok, reasons: verdict.reasons, durationMs, passed: countPassed(output), output };
}

const pad = (text, width) => String(text).padEnd(width);
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

export function main(argv = process.argv.slice(2)) {
  let options;
  try { options = parseArgs(argv); } catch (error) { console.error(`run-tests: ${error.message}`); return 2; }

  const manifestPath = options.manifest || path.join(options.root, 'tests', 'manifest.json');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (error) {
    console.error(`run-tests: cannot read manifest ${manifestPath}: ${error.message}`);
    return 2;
  }

  // Structural problems and orphans fail the run before (and in addition to) any suite result.
  const problems = validateManifest(options.root, manifest);
  const orphans = findOrphans(options.root, manifest);
  for (const problem of problems) console.error(`❌ manifest: ${problem}`);
  for (const orphan of orphans) {
    console.error(`❌ orphan test file: ${orphan} is in neither "suites" nor "quarantine" of ${path.relative(options.root, manifestPath) || manifestPath}`);
  }

  const suites = manifest.suites || [];
  const quarantine = manifest.quarantine || [];
  let toRun = suites.map((entry) => ({ ...entry, quarantined: false }));
  if (options.includeQuarantine) toRun = toRun.concat(quarantine.map((entry) => ({ ...entry, quarantined: true })));
  if (options.only) {
    const wanted = [...suites, ...quarantine].find((entry) => entry.id === options.only);
    if (!wanted) { console.error(`run-tests: no suite or quarantine entry with id "${options.only}"`); return 2; }
    toRun = [{ ...wanted, quarantined: quarantine.includes(wanted) }];
  }

  const results = [];
  for (const entry of toRun) {
    process.stdout.write(`▶ ${entry.id} ... `);
    if (!fs.existsSync(path.join(options.root, entry.file))) {
      const missing = { ...entry, ok: false, reasons: ['file is missing'], durationMs: 0, passed: null, output: '' };
      results.push(missing);
      console.log('❌ missing');
      continue;
    }
    const result = runSuite(options.root, entry, options.timeoutS);
    results.push(result);
    console.log(`${result.ok ? '✅' : '❌'} ${seconds(result.durationMs)}${result.ok ? '' : ` (${result.reasons.join('; ')})`}`);
  }

  // Show the tail of every failing suite so a CI log is enough to diagnose it.
  for (const result of results.filter((r) => !r.ok && r.output)) {
    const tail = result.output.trimEnd().split('\n').slice(-FAILURE_TAIL_LINES).join('\n');
    console.log(`\n----- ${result.id} (${result.file}) — last ${FAILURE_TAIL_LINES} lines -----\n${tail}\n`);
  }

  const failures = results.filter((r) => !r.ok);
  const quarantineNotRun = options.only ? [] : (options.includeQuarantine ? [] : quarantine);
  const idWidth = Math.max(8, ...results.map((r) => r.id.length), ...quarantineNotRun.map((q) => q.id.length));

  console.log('\n=== Test summary ===');
  console.log(`${pad('suite', idWidth)}  ${pad('result', 14)}  ${pad('passed', 7)}  time`);
  for (const r of results) {
    const label = (r.ok ? 'PASS' : 'FAIL') + (r.quarantined ? ' (quar.)' : '');
    console.log(`${pad(r.id, idWidth)}  ${pad(label, 14)}  ${pad(r.passed ?? '-', 7)}  ${seconds(r.durationMs)}`);
  }
  for (const q of quarantineNotRun) {
    console.log(`${pad(q.id, idWidth)}  ${pad('QUARANTINED', 14)}  ${pad('-', 7)}  not run — ${q.task}: ${q.reason}`);
  }

  const totalPassed = results.reduce((sum, r) => sum + (r.passed || 0), 0);
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  console.log(`\n${results.length - failures.length}/${results.length} suites passed, ${failures.length} failed` +
    `${quarantineNotRun.length ? `, ${quarantineNotRun.length} quarantined (not run; use --include-quarantine)` : ''}` +
    ` | ~${totalPassed} assertions reported passed (parsed from output) | ${seconds(totalMs)}`);

  const ok = failures.length === 0 && problems.length === 0 && orphans.length === 0;
  if (!ok) {
    const parts = [];
    if (failures.length) parts.push(`failed suites: ${failures.map((f) => f.id).join(', ')}`);
    if (orphans.length) parts.push(`orphan test files: ${orphans.join(', ')}`);
    if (problems.length) parts.push(`${problems.length} manifest problem(s)`);
    console.error(`\n❌ NOT GREEN — ${parts.join(' | ')}`);
  } else {
    console.log('\n✅ GREEN');
  }

  if (options.report) {
    const report = {
      generatedAt: new Date().toISOString(),
      ok,
      orphans,
      manifestProblems: problems,
      quarantinedNotRun: quarantineNotRun.map(({ id, file, task, reason }) => ({ id, file, task, reason })),
      results: results.map(({ output, ...rest }) => rest)
    };
    fs.mkdirSync(path.dirname(path.resolve(options.report)), { recursive: true });
    fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
  }

  return ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
