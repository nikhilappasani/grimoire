/**
 * The capture header — provenance for a whole interview.
 *
 * The header exists to answer questions a concept cannot: who was interviewed, in what role, when,
 * and against which version of the questions. These tests pin the cases where a header that looks
 * present is still worthless.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateCaptureHeader, categoriesUsedInQuestions, REQUIRED_FIELDS } from '../lib/capture.js';

const VALID = {
  slug: 'panic-at-the-cargo',
  title: 'PanicAtTheCargo',
  theme: 'Domain Knowledge',
  categories: ['Domain Knowledge', 'Behavioral'],
  interviewee: 'nikhilappasani',
  interviewee_role: 'Learner / Developer',
  interviewer: 'LoreWeaver (Grimoire)',
  date: '2025-07-15',
  content_version: '0.6.0',
  spec_version: '0.2.0',
  banks_used: ['Authoring'],
  spec: 'specs/panic-at-the-cargo-capability-spec.md',
};

const errorsFor = (overrides, options) =>
  validateCaptureHeader({ ...VALID, ...overrides }, options).errors;

test('a complete header passes with no errors or warnings', () => {
  const { errors, warnings } = validateCaptureHeader(VALID, { slug: 'panic-at-the-cargo' });
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('every required field is actually required', () => {
  for (const [field] of REQUIRED_FIELDS) {
    const errors = errorsFor({ [field]: undefined });
    assert.ok(
      errors.some((e) => e.includes(`\`${field}\``)),
      `omitting ${field} must be an error`
    );
  }
});

test('an empty categories list counts as missing, not as satisfied', () => {
  // `categories: []` is the shape a lazy writer produces; it must not pass as "present".
  assert.ok(errorsFor({ categories: [] }).some((e) => /`categories`/.test(e)));
});

test('a missing or unparseable header is one clear error, not a cascade', () => {
  assert.deepEqual(validateCaptureHeader(null).errors, ['Capture header is missing or unparseable.']);
  assert.deepEqual(validateCaptureHeader('nonsense').errors, ['Capture header is missing or unparseable.']);
});

test('a header claiming a different slug than its directory is rejected', () => {
  // Worse than no header: it attributes an interview to the wrong capability.
  const errors = errorsFor({ slug: 'something-else' }, { slug: 'panic-at-the-cargo' });
  assert.ok(errors.some((e) => /lives in panic-at-the-cargo\//.test(e)));
});

test('theme and categories are checked against the active vocabulary', () => {
  assert.ok(errorsFor({ theme: 'Vibes' }).some((e) => /Invalid `theme`/.test(e)));
  assert.ok(
    errorsFor({ categories: ['Domain Knowledge', 'Vibes'] }).some((e) => /Invalid entry in `categories`/.test(e))
  );
});

test('a configured vocabulary replaces the default wholesale', () => {
  // An organisation overriding `categories` in grimoire.config.json must not still be held to ours.
  const options = { categories: ['Platform', 'Compliance'] };
  assert.deepEqual(errorsFor({ theme: 'Platform', categories: ['Platform'] }, options), []);
  assert.ok(errorsFor({ theme: 'Domain Knowledge', categories: ['Domain Knowledge'] }, options).length > 0);
});

test('the theme must be one of the categories the interview actually touched', () => {
  const errors = errorsFor({ theme: 'Persona', categories: ['Domain Knowledge', 'Behavioral'] });
  assert.ok(errors.some((e) => /not listed in `categories`/.test(e)));
});

test('date and versions are format-checked', () => {
  assert.ok(errorsFor({ date: '15/07/2025' }).some((e) => /Invalid `date`/.test(e)));
  assert.ok(errorsFor({ date: '2025-7-5' }).some((e) => /Invalid `date`/.test(e)));
  assert.ok(errorsFor({ content_version: 'v0.6' }).some((e) => /Invalid `content_version`/.test(e)));
  assert.ok(errorsFor({ spec_version: 'latest' }).some((e) => /Invalid `spec_version`/.test(e)));
});

test('spec and banks_used warn rather than block', () => {
  const { errors, warnings } = validateCaptureHeader({ ...VALID, spec: undefined, banks_used: undefined });
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 2);
});

test('per-question categories are extracted in first-seen order, without duplicates', () => {
  const transcript = [
    '**Q (base.s1.q1)** · *—* — Name?',
    '**Q (base.s2.q6)** · *Domain Knowledge* — What problem?',
    '**Q (base.s6.q16)** · *Behavioral* — What must it never do?',
    '**Q (base.s6.q17)** · *Behavioral* — And always?',
  ].join('\n\n');
  assert.deepEqual(categoriesUsedInQuestions(transcript), ['Domain Knowledge', 'Behavioral']);
});

test('an unlabelled transcript yields no categories rather than throwing', () => {
  // Labels are best-effort, so the old unlabelled format must degrade quietly.
  assert.deepEqual(categoriesUsedInQuestions('**Q (base.s1.q1):** Name?\n\n**A:** PAC\n'), []);
});
