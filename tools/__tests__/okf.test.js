import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFrontmatter } from '../lib/frontmatter.js';
import { validateConcept, verifyVocabularyAgainstDoc, TYPE_VOCABULARY } from '../lib/okf.js';

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

test('missing provenance fields are warnings, not errors', () => {
  const { errors, warnings } = validateConcept({ data: { type: 'Policy' }, body: 'x' });

  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /source_system/.test(w)));
  assert.ok(warnings.some((w) => /resource/.test(w)));
});
