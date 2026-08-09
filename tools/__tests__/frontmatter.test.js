import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFrontmatter } from '../lib/frontmatter.js';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'frontmatter');
const read = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

test('parses a well-formed block', () => {
  const result = parseFrontmatter(read('valid.md'));

  assert.equal(result.found, true);
  assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
  assert.equal(result.data.name, 'valid-skill');
  assert.equal(result.data.model, 'sonnet');
  assert.deepEqual(result.data.tags, ['alpha', 'beta']);
});

test('reports a missing required key as absent rather than inventing one', () => {
  const result = parseFrontmatter(read('missing-key.md'));

  assert.equal(result.found, true);
  assert.equal(result.data.name, undefined);
  assert.ok(result.data.description);
});

test('warns on a duplicate key instead of silently overwriting', () => {
  const result = parseFrontmatter(read('duplicate-key.md'));

  const dupeWarnings = result.warnings.filter((w) => w.message.includes('Duplicate key'));
  assert.equal(dupeWarnings.length, 1, 'expected exactly one duplicate-key warning');
  assert.match(dupeWarnings[0].message, /description/);
});

test('joins a multi-line value instead of truncating it', () => {
  const result = parseFrontmatter(read('multiline-description.md'));

  assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
  assert.match(result.data.description, /^This description runs across several physical lines/);
  assert.match(result.data.description, /silently truncate two thirds of it\.$/);
  assert.equal(
    result.data.resource,
    'https://example.com/a/very/long/path/that/keeps/going/and/going/reference'
  );
});

test('errors on an unparseable line rather than dropping it', () => {
  const result = parseFrontmatter(read('unparseable.md'));

  assert.equal(result.errors.length, 1, JSON.stringify(result.errors));
  assert.match(result.errors[0].message, /Cannot parse frontmatter line/);
  assert.equal(result.errors[0].line, 3);
});

test('errors when the block is opened but never closed', () => {
  const result = parseFrontmatter('---\nname: x\n\n# No closing delimiter\n');

  assert.equal(result.found, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /never closed/);
});

test('reports no frontmatter when the file does not start with the delimiter', () => {
  const result = parseFrontmatter('# Just a heading\n\nSome prose.\n');

  assert.equal(result.found, false);
  assert.equal(result.errors.length, 0);
});
