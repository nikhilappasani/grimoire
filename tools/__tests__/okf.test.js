import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFrontmatter } from '../lib/frontmatter.js';
import {
  validateConcept,
  verifyVocabularyAgainstDoc,
  extractVocabulary,
  checkPlacement,
  TYPE_VOCABULARY,
  TYPE_DIRECTORIES,
} from '../lib/okf.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures', 'okf');
const OKF_DOC = path.join(
  HERE,
  '..',
  '..',
  'skills',
  'loreweaver',
  'references',
  'KNOWLEDGE-CAPTURE-OKF.md'
);

function loadConcept(name) {
  const source = fs.readFileSync(path.join(FIXTURES, name), 'utf8');
  const parsed = parseFrontmatter(source);
  const body = source.split(/\r?\n/).slice(parsed.bodyStartLine - 1).join('\n');
  return validateConcept({ data: parsed.data, body });
}

test('the code vocabulary matches the reference document (M-1 single source)', () => {
  const doc = fs.readFileSync(OKF_DOC, 'utf8');
  const result = verifyVocabularyAgainstDoc(doc);

  assert.equal(result.ok, true, result.message);
});

test('a well-formed concept passes clean', () => {
  const { errors, warnings } = loadConcept('valid-concept.md');

  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('a type outside the vocabulary is an error, not a pass', () => {
  const { errors } = loadConcept('invalid-type.md');

  assert.equal(errors.length, 1);
  assert.match(errors[0], /Invalid `type`: "Cheatsheet"/);
  for (const permitted of TYPE_VOCABULARY) {
    assert.ok(errors[0].includes(permitted), `error should list ${permitted}`);
  }
});

test('confidential without a resource link is an error', () => {
  const { errors } = loadConcept('confidential-without-resource.md');

  assert.equal(errors.length, 1);
  assert.match(errors[0], /link-only/);
});

test('a pending stub is a notice, not a failure', () => {
  const { errors, notices } = loadConcept('pending-stub.md');

  assert.deepEqual(errors, []);
  assert.ok(notices.some((n) => /Pending extraction/.test(n)));
  assert.ok(notices.some((n) => /OPEN:/.test(n)));
});

test('missing type is an error', () => {
  const { errors } = validateConcept({ data: {}, body: '' });

  assert.ok(errors.some((e) => /Missing required field `type`/.test(e)));
});

test('provenance that identifies the source is an error; the rest warn', () => {
  // Deliberately split. `source_system` and `category` are what make a fact traceable and
  // classifiable, so their absence fails the bundle. `resource` and `timestamp` are still valuable
  // but a concept without them is legible — those warn.
  const { errors, warnings } = validateConcept({ data: { type: 'Policy' }, body: 'x' });

  assert.ok(errors.some((e) => /Missing `source_system`/.test(e)));
  assert.ok(errors.some((e) => /Missing required field `category`/.test(e)));
  assert.ok(warnings.some((w) => /resource/.test(w)));
  assert.ok(warnings.some((w) => /timestamp/.test(w)));
});

test('every type in the vocabulary has a directory, and no directory is orphaned', () => {
  // A type with no directory would be unplaceable; a directory with no type would be a folder the
  // gate accepts but nothing can legitimately fill. Both are how invented folders creep back in.
  assert.deepEqual(Object.keys(TYPE_DIRECTORIES).sort(), [...TYPE_VOCABULARY].sort());
  const dirs = Object.values(TYPE_DIRECTORIES);
  assert.equal(new Set(dirs).size, dirs.length, 'two types must not share a directory');
});

test('placement is correct when the directory matches the type', () => {
  assert.equal(checkPlacement('references/the-rust-book.md', 'Reference'), null);
  assert.equal(checkPlacement('playbooks/hint-escalation.md', 'Playbook'), null);
  assert.equal(checkPlacement(path.join('glossary', 'term.md'), 'Glossary Term'), null);
});

test('a concept in the wrong directory is an error naming both directories', () => {
  // The real case: an interview invented protocols/ for a Playbook.
  const message = checkPlacement('protocols/hint-escalation.md', 'Playbook');
  assert.match(message, /protocols\//);
  assert.match(message, /playbooks\//);
});

test('a concept at the bundle root is an error, since the path is its identity', () => {
  assert.match(checkPlacement('hint-escalation.md', 'Playbook'), /bundle root/);
});

test('placement says nothing about an unknown type — validateConcept already reports it', () => {
  // Otherwise one mistake produces two errors and the actionable one gets buried.
  assert.equal(checkPlacement('books/the-rust-book.md', 'Book'), null);
});

test('Reference is a valid type, so a cited book need not masquerade as a Runbook', () => {
  const { errors } = validateConcept({
    data: {
      type: 'Reference',
      category: 'Domain Knowledge',
      sensitivity: 'public',
      resource: 'https://doc.rust-lang.org/book/',
      source_system: 'Public docs',
      timestamp: '2026-08-10',
    },
    body: '# The Rust Book\n\nThe canonical introduction.\n',
  });
  assert.deepEqual(errors, []);
});

test('category is required and checked against the active vocabulary', () => {
  const base = { type: 'Reference', source_system: 'Public docs', timestamp: '2026-08-10' };
  assert.ok(validateConcept({ data: base, body: 'x' }).errors.some((e) => /Missing required field `category`/.test(e)));
  assert.ok(
    validateConcept({ data: { ...base, category: 'Vibes' }, body: 'x' }).errors.some((e) => /Invalid `category`/.test(e))
  );
  assert.deepEqual(
    validateConcept({ data: { ...base, category: 'Domain Knowledge' }, body: 'x' }).errors,
    []
  );
});

test('a configured category vocabulary replaces the shipped default', () => {
  const data = { type: 'Reference', source_system: 'Public docs', timestamp: '2026-08-10', category: 'Platform' };
  assert.deepEqual(validateConcept({ data, body: 'x', categories: ['Platform'] }).errors, []);
  assert.ok(validateConcept({ data, body: 'x' }).errors.some((e) => /Invalid `category`/.test(e)));
});

test('source_system is enforced, not merely declared', () => {
  // It had a vocabulary that nothing checked: "Banana Stand" passed with zero errors AND zero
  // warnings, so the field recorded nothing anyone could rely on.
  const base = { type: 'Reference', category: 'Domain Knowledge', timestamp: '2026-08-10' };
  assert.ok(
    validateConcept({ data: { ...base, source_system: 'Banana Stand' }, body: 'x' }).errors.some((e) =>
      /Invalid `source_system`/.test(e)
    )
  );
  assert.ok(validateConcept({ data: base, body: 'x' }).errors.some((e) => /Missing `source_system`/.test(e)));
});

test('a malformed timestamp is an error; a missing one is a warning', () => {
  // A date that cannot be compared looks like provenance while providing none.
  const base = { type: 'Reference', category: 'Domain Knowledge', source_system: 'Public docs' };
  assert.ok(
    validateConcept({ data: { ...base, timestamp: '10-08-2026' }, body: 'x' }).errors.some((e) =>
      /Invalid `timestamp`/.test(e)
    )
  );
  const missing = validateConcept({ data: base, body: 'x' });
  assert.deepEqual(missing.errors, []);
  assert.ok(missing.warnings.some((w) => /Missing `timestamp`/.test(w)));
});

test('every mirrored vocabulary is drift-checked, not just type', () => {
  const doc = fs.readFileSync(OKF_DOC, 'utf8');
  for (const name of ['type', 'category', 'source_system', 'access_state', 'sensitivity']) {
    const extracted = extractVocabulary(doc, name);
    assert.ok(Array.isArray(extracted) && extracted.length >= 2, `${name} vocabulary must be documented`);
  }
  assert.equal(verifyVocabularyAgainstDoc(doc).ok, true);
});

test('drift in any vocabulary is reported, naming which one', () => {
  const doc = fs.readFileSync(OKF_DOC, 'utf8').replace('`Conventions` · ', '');
  const result = verifyVocabularyAgainstDoc(doc);
  assert.equal(result.ok, false);
  assert.match(result.message, /`category` vocabulary drift/);
});

test('a named marker cannot match a different vocabulary section', () => {
  // The old single global marker matched the first "this list is authoritative" line in the file,
  // which is why a second documented vocabulary would have silently read the wrong table.
  const doc = fs.readFileSync(OKF_DOC, 'utf8');
  assert.notDeepEqual(extractVocabulary(doc, 'type'), extractVocabulary(doc, 'category'));
  assert.equal(extractVocabulary(doc, 'not_a_real_vocabulary'), null);
});
