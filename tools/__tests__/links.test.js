import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractRelativeLinks, existsCaseSensitive, findBrokenLinks } from '../lib/links.js';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'links');
const fixture = (name) => path.join(FIXTURES, name);
const read = (name) => fs.readFileSync(fixture(name), 'utf8');

test('extracts relative links and ignores URLs and anchors', () => {
  const links = extractRelativeLinks(read('good-links.md')).map((l) => l.target);

  assert.deepEqual(links, ['./target.md', './target.md#target']);
});

test('resolving links produce no findings', () => {
  const broken = findBrokenLinks(fixture('good-links.md'), read('good-links.md'));

  assert.deepEqual(broken, []);
});

test('a missing target is reported', () => {
  const broken = findBrokenLinks(fixture('broken-link.md'), read('broken-link.md'));

  assert.equal(broken.length, 1);
  assert.equal(broken[0].target, './no-such-file.md');
  assert.equal(broken[0].reason, 'missing');
});

test('a case-mismatched link is reported on every filesystem', () => {
  const broken = findBrokenLinks(fixture('case-mismatch.md'), read('case-mismatch.md'));

  assert.equal(broken.length, 1, 'case mismatch must fail even where existsSync would pass');
  assert.equal(broken[0].target, './Target.md');
});

test('links inside fenced blocks and inline code are not resolved', () => {
  const links = extractRelativeLinks(read('fenced-example.md')).map((l) => l.target);
  assert.deepEqual(links, ['./target.md'], 'only the real link outside any fence should be extracted');

  const broken = findBrokenLinks(fixture('fenced-example.md'), read('fenced-example.md'));
  assert.deepEqual(broken, []);
});

test('existsCaseSensitive rejects a wrong-case path whose lowercase form exists', () => {
  assert.equal(existsCaseSensitive(fixture('target.md')), true);
  assert.equal(existsCaseSensitive(fixture('Target.md')), false);
});
