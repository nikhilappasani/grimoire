/**
 * OKF concept rules.
 *
 * KNOWLEDGE-CAPTURE-OKF.md is the single source for the `type` vocabulary (correction M-1). The
 * vocabulary is mirrored here so validation stays deterministic and dependency-free — and
 * `verifyVocabularyAgainstDoc` fails loudly if the two ever drift. A mirrored list nobody checks is
 * exactly the defect M-1 was raised against.
 */

export const TYPE_VOCABULARY = [
  'Glossary Term',
  'Policy',
  'Playbook',
  'Runbook',
  'Reference',
  'Diagram',
  'Process',
  'API',
  'Dataset',
];

/**
 * Which directory each `type` lives in — KNOWLEDGE-CAPTURE-OKF.md §2.
 *
 * A concept's path is its identity, so a path that disagrees with its type makes the folder tree
 * lie about what it holds. This went unenforced and an interview promptly invented `references/`
 * and `protocols/`, filing a book as a `Runbook` because the vocabulary offered nowhere better.
 */
export const TYPE_DIRECTORIES = {
  'Glossary Term': 'glossary',
  Policy: 'policies',
  Playbook: 'playbooks',
  Runbook: 'runbooks',
  Reference: 'references',
  Diagram: 'diagrams',
  Process: 'processes',
  API: 'apis',
  Dataset: 'datasets',
};

/**
 * Check a concept's directory against its declared type.
 *
 * @param {string} relativePath  concept path relative to the bundle root, e.g. "references/x.md"
 * @param {string} type          the concept's declared `type`
 * @returns {string|null} an error message, or null when the placement is correct
 */
export function checkPlacement(relativePath, type) {
  const expected = TYPE_DIRECTORIES[type];
  if (!expected) return null; // an unknown type is already reported by validateConcept

  const segments = relativePath.split(/[/\\]/);
  const actual = segments.length > 1 ? segments[0] : '';

  if (actual === expected) return null;
  if (actual === '') {
    return `Concept of type "${type}" sits at the bundle root; it belongs in ${expected}/ (KNOWLEDGE-CAPTURE-OKF.md §2).`;
  }
  return `Concept of type "${type}" is in ${actual}/ but belongs in ${expected}/ (KNOWLEDGE-CAPTURE-OKF.md §2).`;
}

export const SOURCE_SYSTEMS = [
  'Local file',
  'Wiki',
  'Document store',
  'Code',
  'Tribal/interview',
  'Public docs',
];

/**
 * What area of the work a concept concerns — the second classification axis, orthogonal to `type`.
 *
 * `type` says what *shape* a fact is (a Policy, a Playbook, a Reference). `category` says what area
 * it *belongs to*. Both are needed: "a Playbook about release governance" and "a Playbook about
 * naming standards" are the same shape and completely different things to a reader.
 *
 * These five ship as a **default**, not a mandate. Set `categories` in grimoire.config.json to
 * replace the list wholesale. Concrete systems and roles — Jira, Harness, "Data Engineer" — belong
 * in the free-text `tags:` array, never in this vocabulary: baking one organisation's tooling into
 * the enum makes it wrong for everybody else.
 */
export const CATEGORIES = [
  'Conventions',
  'Domain Knowledge',
  'External Systems',
  'Persona',
  'Behavioral',
];

export const ACCESS_STATES = ['extracted', 'linked', 'pending'];
export const SENSITIVITIES = ['public', 'internal', 'confidential'];

/** ISO-8601 calendar date. Deliberately not a full timestamp — provenance is dated, not clocked. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Vocabularies mirrored here that must stay identical to KNOWLEDGE-CAPTURE-OKF.md.
 * The key is the name used in the document's marker line.
 */
const DOCUMENTED_VOCABULARIES = {
  type: TYPE_VOCABULARY,
  source_system: SOURCE_SYSTEMS,
  category: CATEGORIES,
  access_state: ACCESS_STATES,
  sensitivity: SENSITIVITIES,
};

/**
 * Pull one named vocabulary out of the reference document so drift is detectable.
 *
 * Keyed on a *named* marker rather than a single global one. The previous version searched for the
 * first line containing "this list is authoritative", which worked only because `.includes` is
 * case-sensitive and §3 happened to precede §8's identically-worded claim — a second vocabulary
 * would have silently matched the wrong table.
 *
 * @param {string} docSource contents of KNOWLEDGE-CAPTURE-OKF.md
 * @param {string} name  the vocabulary's name, e.g. "type" or "source_system"
 * @returns {string[]|null} the documented vocabulary, or null if its marker was not found
 */
export function extractVocabulary(docSource, name) {
  const lines = docSource.split(/\r?\n/);
  const marker = `\`${name}\` vocabulary — this list is authoritative`;
  const markerIndex = lines.findIndex((line) => line.includes(marker));
  if (markerIndex === -1) return null;

  for (let i = markerIndex + 1; i < Math.min(markerIndex + 6, lines.length); i++) {
    const terms = [...lines[i].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (terms.length >= 2) return terms;
  }
  return null;
}

/**
 * Verify every mirrored vocabulary still matches the reference document.
 * @param {string} docSource contents of KNOWLEDGE-CAPTURE-OKF.md
 * @returns {{ok: boolean, message?: string}}
 */
export function verifyVocabularyAgainstDoc(docSource) {
  const problems = [];

  for (const [name, inCode] of Object.entries(DOCUMENTED_VOCABULARIES)) {
    const documented = extractVocabulary(docSource, name);
    if (documented === null) {
      problems.push(
        `Could not find the authoritative \`${name}\` vocabulary in KNOWLEDGE-CAPTURE-OKF.md ` +
          `(looked for "\`${name}\` vocabulary — this list is authoritative").`
      );
      continue;
    }
    if ([...documented].sort().join('|') !== [...inCode].sort().join('|')) {
      problems.push(
        `\`${name}\` vocabulary drift.\n  documented: ${documented.join(', ')}\n  in code:    ${inCode.join(', ')}`
      );
    }
  }

  return problems.length === 0 ? { ok: true } : { ok: false, message: problems.join('\n') };
}

/**
 * Validate one OKF concept file.
 *
 * @param {object} args
 * @param {Record<string, any>} args.data  parsed frontmatter
 * @param {string} args.body               file body after the frontmatter
 * @returns {{errors: string[], warnings: string[], notices: string[]}}
 */
export function validateConcept({ data, body, categories = CATEGORIES }) {
  const errors = [];
  const warnings = [];
  const notices = [];

  const type = typeof data.type === 'string' ? data.type.trim() : '';
  if (type === '') {
    errors.push('Missing required field `type`.');
  } else if (!TYPE_VOCABULARY.includes(type)) {
    errors.push(
      `Invalid \`type\`: "${type}". Permitted: ${TYPE_VOCABULARY.join(' | ')} (KNOWLEDGE-CAPTURE-OKF.md §3).`
    );
  }

  // Category is an error rather than a warning, like type. A bundle where classification is
  // optional is a bundle where it is absent, and the whole point is being able to see what a
  // capture covered.
  const category = typeof data.category === 'string' ? data.category.trim() : '';
  if (category === '') {
    errors.push('Missing required field `category` (KNOWLEDGE-CAPTURE-OKF.md §3).');
  } else if (!categories.includes(category)) {
    errors.push(
      `Invalid \`category\`: "${category}". Permitted: ${categories.join(' | ')}. ` +
        'Override the list with `categories` in grimoire.config.json; concrete systems and roles belong in `tags`.'
    );
  }

  const sensitivity = typeof data.sensitivity === 'string' ? data.sensitivity.trim() : '';
  const resource = typeof data.resource === 'string' ? data.resource.trim() : '';

  if (sensitivity !== '' && !SENSITIVITIES.includes(sensitivity)) {
    errors.push(`Invalid \`sensitivity\`: "${sensitivity}". Permitted: ${SENSITIVITIES.join(' | ')}.`);
  }

  // The hard rule, enforced as an error and never downgraded: confidential is link-only.
  if (sensitivity === 'confidential') {
    if (resource === '' || resource === 'none') {
      errors.push(
        'Confidential concept has no `resource:` link. Confidential content is link-only — a short neutral summary plus a link back to the source (KNOWLEDGE-CAPTURE-OKF.md §7).'
      );
    }
    if (body.trim().split(/\s+/).length > 200) {
      warnings.push(
        'Confidential concept has a long body. Link-only means a SHORT neutral summary — verify no sensitive content was copied in.'
      );
    }
  }

  const accessState = typeof data.access_state === 'string' ? data.access_state.trim() : '';
  if (accessState !== '' && !ACCESS_STATES.includes(accessState)) {
    errors.push(`Invalid \`access_state\`: "${accessState}". Permitted: ${ACCESS_STATES.join(' | ')}.`);
  }

  // Provenance is the reason OKF exists. `source_system` had a vocabulary that nothing checked, so
  // any string passed and the field recorded nothing reliable; both halves are errors now.
  const sourceSystem = typeof data.source_system === 'string' ? data.source_system.trim() : '';
  if (sourceSystem === '') {
    errors.push('Missing `source_system` — provenance cannot be traced without it.');
  } else if (!SOURCE_SYSTEMS.includes(sourceSystem)) {
    errors.push(
      `Invalid \`source_system\`: "${sourceSystem}". Permitted: ${SOURCE_SYSTEMS.join(' | ')} (KNOWLEDGE-CAPTURE-OKF.md §3).`
    );
  }

  // A malformed date is worse than a missing one: it looks like provenance and cannot be compared.
  const timestamp = typeof data.timestamp === 'string' ? data.timestamp.trim() : '';
  if (timestamp === '') {
    warnings.push('Missing `timestamp` — nothing records when this was captured or last verified.');
  } else if (!ISO_DATE_RE.test(timestamp)) {
    errors.push(`Invalid \`timestamp\`: "${timestamp}". Use an ISO-8601 date, e.g. 2026-08-10.`);
  }

  if (resource === '') {
    warnings.push('Missing `resource` — set it to a URL, or explicitly to `none`.');
  }

  if (accessState === 'pending') {
    notices.push('Pending extraction — the user has not yet supplied this content.');
  }
  if (/^\s*OPEN:/m.test(body)) {
    notices.push('Contains an OPEN: marker — unresolved.');
  }

  return { errors, warnings, notices };
}
