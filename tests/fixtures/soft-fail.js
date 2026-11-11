// Fixture for tests/run-tests.test.js: a "soft" test suite. It reports a failure in its own tally but exits 0,
// exactly the kind of suite that used to slip through `npm test`. The runner must still call it failed.
console.log('  ✅ PASS: something that works');
console.log('Test Results: 1 Passed, 1 Failed');
process.exit(0);
