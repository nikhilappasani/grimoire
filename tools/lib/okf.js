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

export const ACCESS_STATES = ['extracted', 'linked', 'pending'];
export const SENSITIVITIES = ['public', 'internal', 'confidential'];

const AUTHORITATIVE_MARKER = 'this list is authoritative';

/**
 * Pull the vocabulary out of the reference document so drift is detectable.
 * @param {string} docSource contents of KNOWLEDGE-CAPTURE-OKF.md
 * @returns {string[]|null} the documented vocabulary, or null if the marker was not found
 */
export function extractTypeVocabulary(docSource) {
  const lines = docSource.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => line.includes(AUTHORITATIVE_MARKER));
  if (markerIndex === -1) return null;

  for (let i = markerIndex + 1; i < Math.min(markerIndex + 6, lines.length); i++) {
    const terms = [...lines[i].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (terms.length >= 2) return terms;
  }
  return null;
}

/**
 * @param {string} docSource contents of KNOWLEDGE-CAPTURE-OKF.md
 * @returns {{ok: boolean, message?: string}}
 */
export function verifyVocabularyAgainstDoc(docSource) {
  const documented = extractTypeVocabulary(docSource);
  if (documented === null) {
    return {
      ok: false,
      message: `Could not find the authoritative type vocabulary in KNOWLEDGE-CAPTURE-OKF.md (looked for "${AUTHORITATIVE_MARKER}").`,
    };
  }
  const a = [...documented].sort().join('|');
  const b = [...TYPE_VOCABULARY].sort().join('|');
  if (a !== b) {
    return {
      ok: false,
      message: `Type vocabulary drift.\n  documented: ${documented.join(', ')}\n  in code:    ${TYPE_VOCABULARY.join(', ')}`,
    };
  }
  return { ok: true };
}

/**
 * Validate one OKF concept file.
 *
 * @param {object} args
 * @param {Record<string, any>} args.data  parsed frontmatter
 * @param {string} args.body               file body after the frontmatter
 * @returns {{errors: string[], warnings: string[], notices: string[]}}
 */
export function validateConcept({ data, body }) {
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

  const sourceSystem = typeof data.source_system === 'string' ? data.source_system.trim() : '';
  if (sourceSystem === '') {
    warnings.push('Missing `source_system` — provenance cannot be traced without it.');
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
