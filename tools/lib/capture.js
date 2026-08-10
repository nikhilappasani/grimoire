/**
 * The capture header — provenance for a whole interview, not a single concept.
 *
 * A concept records `source_system: Tribal/interview`, which says the fact came out of someone's
 * head but never *whose*. Six months later "who do I ask about this?" is unanswerable, and that is
 * the question a capture most often needs to answer. This header fixes that, and pins the versions
 * the interview ran against so a capture can be read in the context it was made.
 *
 * Pure by design — no filesystem, no process, same rule as compendium-git.js — so the rules
 * guarding a publish are testable without writing a transcript.
 */

import { CATEGORIES } from './okf.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Fields every capture must carry, and why each one is not optional.
 *
 * Kept as data rather than a wall of ifs so the reference documentation and the error messages
 * cannot describe different requirements.
 */
export const REQUIRED_FIELDS = [
  ['slug', 'identifies the capture; must match its directory name'],
  ['title', 'the human name of the capability'],
  ['theme', 'the dominant category of the interview'],
  ['categories', 'every category the interview touched'],
  ['interviewee', 'who answered — the provenance a concept alone cannot record'],
  ['interviewee_role', 'the role they answered in; the same fact means different things from different chairs'],
  ['date', 'when the interview happened'],
  ['content_version', 'which reference bundle the interview ran against'],
];

const asArray = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);
const asString = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Validate a parsed transcript frontmatter block.
 *
 * @param {Record<string, unknown>} data  parsed frontmatter
 * @param {{slug?: string, categories?: string[]}} [options]
 *   slug — the directory name, checked against the header's own claim.
 *   categories — the active category vocabulary, defaulting to the shipped one.
 * @returns {{errors: string[], warnings: string[]}}
 */
export function validateCaptureHeader(data, { slug = null, categories = CATEGORIES } = {}) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object') {
    return { errors: ['Capture header is missing or unparseable.'], warnings };
  }

  for (const [field, why] of REQUIRED_FIELDS) {
    const value = data[field];
    const empty = Array.isArray(value) ? value.length === 0 : asString(value) === '';
    if (empty) errors.push(`Missing \`${field}\` in the capture header — ${why}.`);
  }

  const declaredSlug = asString(data.slug);
  if (declaredSlug !== '' && !SLUG_RE.test(declaredSlug)) {
    errors.push(`Invalid \`slug\`: "${declaredSlug}" — lowercase kebab-case only.`);
  }
  // A header describing a different capture than the folder it sits in is worse than no header:
  // it attributes an interview to the wrong capability.
  if (slug !== null && declaredSlug !== '' && declaredSlug !== slug) {
    errors.push(`Capture header says \`slug: ${declaredSlug}\` but it lives in ${slug}/.`);
  }

  const theme = asString(data.theme);
  if (theme !== '' && !categories.includes(theme)) {
    errors.push(`Invalid \`theme\`: "${theme}". Permitted: ${categories.join(' | ')}.`);
  }

  const declaredCategories = asArray(data.categories).map(asString).filter(Boolean);
  for (const category of declaredCategories) {
    if (!categories.includes(category)) {
      errors.push(`Invalid entry in \`categories\`: "${category}". Permitted: ${categories.join(' | ')}.`);
    }
  }
  if (theme !== '' && declaredCategories.length > 0 && !declaredCategories.includes(theme)) {
    errors.push(`\`theme\` "${theme}" is not listed in \`categories\` — the dominant category must be one it touched.`);
  }

  const date = asString(data.date);
  if (date !== '' && !ISO_DATE_RE.test(date)) {
    errors.push(`Invalid \`date\`: "${date}". Use an ISO-8601 date, e.g. 2026-08-10.`);
  }

  for (const field of ['content_version', 'spec_version']) {
    const value = asString(data[field]);
    if (value !== '' && !SEMVER_RE.test(value)) {
      errors.push(`Invalid \`${field}\`: "${value}". Use semver, e.g. 0.6.0.`);
    }
  }

  if (asString(data.spec) === '') {
    warnings.push('Missing `spec` — nothing links this capture to the specification it produced.');
  }
  if (asArray(data.banks_used).length === 0) {
    warnings.push('Missing `banks_used` — which question banks ran is part of how to read the transcript.');
  }

  return { errors, warnings };
}

/**
 * The categories a transcript's per-question labels actually used, in first-seen order.
 *
 * Labels are written as `**Q (id)** · *Category* — question text`. They are best-effort and never
 * gated; this exists so the close protocol can report coverage, and so a header claiming a category
 * the questions never touched is visible.
 *
 * @param {string} transcript  full transcript markdown
 * @returns {string[]}
 */
export function categoriesUsedInQuestions(transcript) {
  const seen = [];
  for (const match of transcript.matchAll(/^\*\*Q \([^)]+\)\*\*\s*·\s*\*([^*]+)\*/gm)) {
    const label = match[1].trim();
    if (label !== '' && label !== '—' && !seen.includes(label)) seen.push(label);
  }
  return seen;
}
