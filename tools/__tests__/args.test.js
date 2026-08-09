/**
 * The shared argument parser. Its contract is "never throw, report everything" — the callers turn
 * findings into failures, and they disagree about what counts as one, so the cases that matter are
 * the ones where a caller's choice depends on the distinction.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs, argsError } from '../lib/args.js';

const SPEC = {
  booleans: { '--auto': 'auto', '--dry-run': 'dryRun' },
  values: { '--base': 'base', '-m': 'message', '--message': 'message' },
  defaults: { auto: false, dryRun: false, base: 'main', message: null },
};

test('defaults apply when nothing is passed', () => {
  const { flags, positional } = parseArgs([], SPEC);
  assert.deepEqual(flags, { auto: false, dryRun: false, base: 'main', message: null });
  assert.deepEqual(positional, []);
});

test('booleans set, values consume the next argument, positionals collect in order', () => {
  const { flags, positional } = parseArgs(
    ['deploy-process', '--auto', '--base', 'trunk', 'extra'],
    SPEC
  );
  assert.equal(flags.auto, true);
  assert.equal(flags.base, 'trunk');
  assert.deepEqual(positional, ['deploy-process', 'extra']);
});

test('aliases resolve to the same key', () => {
  assert.equal(parseArgs(['-m', 'hello'], SPEC).flags.message, 'hello');
  assert.equal(parseArgs(['--message', 'hello'], SPEC).flags.message, 'hello');
});

test('a value that looks like a flag is still consumed as the value', () => {
  // Otherwise `-m --auto` would silently produce a null message and set an unrelated boolean.
  const { flags, unknown } = parseArgs(['-m', '--auto'], SPEC);
  assert.equal(flags.message, '--auto');
  assert.equal(flags.auto, false);
  assert.deepEqual(unknown, []);
});

test('an unknown flag is reported, never treated as a positional', () => {
  // This is the whole point of the split: a typo'd flag falling into `positional` would be read as
  // compendium-push's slug — the argument that decides what gets published.
  const { positional, unknown } = parseArgs(['--dry-runn', 'my-slug'], SPEC);
  assert.deepEqual(positional, ['my-slug']);
  assert.deepEqual(unknown, ['--dry-runn']);
});

test('a value flag at the end of argv is reported rather than yielding undefined', () => {
  const parsed = parseArgs(['--base'], SPEC);
  assert.deepEqual(parsed.missingValues, ['--base']);
  assert.equal(parsed.flags.base, 'main', 'the default must survive a missing value');
});

test('a bare dash is a positional, not an unknown flag', () => {
  const { positional, unknown } = parseArgs(['-'], SPEC);
  assert.deepEqual(positional, ['-']);
  assert.deepEqual(unknown, []);
});

test('negative-number-looking arguments after a value flag survive', () => {
  const { flags } = parseArgs(['--base', '-1'], SPEC);
  assert.equal(flags.base, '-1');
});

test('parsing never throws, whatever it is handed', () => {
  assert.doesNotThrow(() => parseArgs(['--', '-x', '--base'], SPEC));
  assert.doesNotThrow(() => parseArgs(['--base'], {}));
});

test('argsError reports the missing value before the unknown flag', () => {
  // Both wrong at once: the missing value is the more actionable message, so it wins.
  const parsed = parseArgs(['--nope', '--base'], SPEC);
  assert.equal(argsError(parsed), '--base requires a value.');
});

test('argsError returns null for a clean parse', () => {
  assert.equal(argsError(parseArgs(['slug', '--auto'], SPEC)), null);
});

test('prototype keys cannot be smuggled in as flags', () => {
  const { unknown, positional } = parseArgs(['--constructor', 'constructor'], SPEC);
  assert.deepEqual(unknown, ['--constructor']);
  assert.deepEqual(positional, ['constructor']);
});
