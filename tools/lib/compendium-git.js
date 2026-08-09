/**
 * Pure helpers for the compendium publish flow.
 *
 * No process spawning and no filesystem access in here — data in, data out — so every rule that
 * guards a network write is unit-testable without touching git. scripts/compendium-push.js is the
 * only place the actual git commands run.
 */

import { createHash } from 'node:crypto';

/**
 * A short, stable fingerprint of exactly what would be published.
 *
 * This is what turns "the user approved this" from a claim into a check. The review command prints
 * a digest; the push refuses to run non-interactively unless it is handed the same digest back and
 * recomputes it to the same value. If anything about the capture changed in between — a byte in the
 * transcript, a renamed document, a file added or removed — the digest moves and the push stops.
 *
 * Properties that matter:
 *  - **Order-independent.** Entries are sorted by path first, so the digest does not depend on
 *    directory-walk order (which is locale-sensitive) — only on content.
 *  - **Covers paths, not just bytes.** Renaming a document changes what is published, so it must
 *    change the digest.
 *  - **Length-delimited.** Without the explicit length, {"ab", "c"} and {"a", "bc"} would hash
 *    identically and a file boundary could be moved without detection.
 *
 * @param {{path: string, content: Buffer|string}[]} files
 * @returns {string} 12 hex characters — short enough to read aloud, far past collision risk here.
 */
export function contentDigest(files) {
  const hash = createHash('sha256');
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const { path, content } of sorted) {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
    hash.update(`${path}\0${bytes.length}\0`, 'utf8');
    hash.update(bytes);
  }
  return hash.digest('hex').slice(0, 12);
}

/**
 * Whether a file should be shown as text in a review, using git's heuristic: a NUL byte in the
 * content means binary. A review that dumps a PDF into the terminal is not a review.
 */
export function isProbablyBinary(content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
  return bytes.includes(0);
}

/**
 * Secret patterns scanned before anything is committed. A hit BLOCKS the publish outright — there is
 * no override flag, mirroring the confidential-is-link-only posture. This local scan is the first
 * line of defense; the gitleaks job in the Compendium repo's CI is the harder-to-bypass backstop.
 *
 * Patterns identify the *kind* of secret only. Never echo the matched text back to the user — a
 * secret in a terminal scrollback is still a leak.
 */
export const SECRET_PATTERNS = [
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'GitHub token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/ },
  { name: 'GitHub fine-grained token', re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { name: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'OpenAI-style API key', re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  {
    name: 'Credential assignment',
    re: /\b(?:api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*['"]?[A-Za-z0-9_\-/+]{16,}/i,
  },
];

/**
 * Scan file contents for secrets.
 * @param {{path: string, content: string}[]} files
 * @returns {{path: string, line: number, kind: string}[]} findings — kind and location only, never
 *   the matched text.
 */
export function scanForSecrets(files) {
  const findings = [];
  for (const { path, content } of files) {
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const { name, re } of SECRET_PATTERNS) {
        if (re.test(line)) {
          findings.push({ path, line: index + 1, kind: name });
          break; // one finding per line is enough to block; don't multi-report the same line
        }
      }
    });
  }
  return findings;
}

/**
 * Parse a git remote URL into { owner, repo }, or null when it isn't a recognizable GitHub-style
 * remote. Handles SSH (git@host:owner/repo.git), ssh:// and https:// forms, with or without .git.
 * @param {string} url
 */
export function parseRemoteUrl(url) {
  const trimmed = (url ?? '').trim();
  const patterns = [
    /^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/, // git@github.com:owner/repo.git
    /^ssh:\/\/git@([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/, // ssh://git@github.com/owner/repo
    /^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?\/?$/, // https://github.com/owner/repo
  ];
  for (const re of patterns) {
    const match = trimmed.match(re);
    if (match) {
      return { host: match[1], owner: match[2], repo: match[3] };
    }
  }
  return null;
}

/**
 * Build the GitHub compare URL a human opens to review the pushed branch (fallback for when the
 * repo-side auto-PR workflow is absent or delayed).
 */
export function compareUrl({ host, owner, repo, base, branch }) {
  return `https://${host}/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(branch)}?expand=1`;
}

/**
 * Pick a branch name for a slug, mirroring the spec-collision convention
 * (CAPABILITY-SPEC-TEMPLATE.md §1): the plain name, then -<YYYYMMDD>, then -<YYYYMMDD>-2, -3, …
 * Never reuses a taken name — an existing branch is never overwritten with different content.
 *
 * @param {string} slug
 * @param {{prefix?: string, existingRefs: Set<string>, today?: Date}} options existingRefs holds
 *   every branch name already present locally or on the remote.
 */
export function resolveBranchName(slug, { prefix = 'compendium/', existingRefs, today = new Date() }) {
  const base = `${prefix}${slug}`;
  if (!existingRefs.has(base)) return base;

  const stamp = today.toISOString().slice(0, 10).replace(/-/g, '');
  const dated = `${base}-${stamp}`;
  if (!existingRefs.has(dated)) return dated;

  for (let n = 2; ; n++) {
    const candidate = `${dated}-${n}`;
    if (!existingRefs.has(candidate)) return candidate;
  }
}

/**
 * Validate a slug is safe to use as a path segment and branch component: lowercase kebab-case,
 * no traversal, no separators.
 */
export function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Decide where the compendium repo clone lives. Pure planner — the script does the actual fs/git
 * work. Resolution order:
 *   1. explicit --root         (must already exist — fail closed, never created)
 *   2. GRIMOIRE_COMPENDIUM_ROOT env (must already exist — fail closed, never created)
 *   3. managed clone of configRepoUrl under managedDir (cloned on first use — the seamless path
 *      for machines with zero setup; creating a managed cache dir is not the "silent mkdir of a
 *      configured root" the output contract forbids, because nothing the user configured is missing)
 *   4. configRoots.compendium local path (must already exist — fail closed)
 *
 * @returns {{kind: 'explicit'|'env'|'managed'|'config-local', path: string, cloneUrl?: string}
 *          | {error: string}}
 */
export function planRootResolution({ explicitRoot, envRoot, configRepoUrl, configLocalRoot, managedDir, existsFn }) {
  if (explicitRoot) {
    if (!existsFn(explicitRoot)) return { error: `--root ${explicitRoot} does not exist. Refusing to create it.` };
    return { kind: 'explicit', path: explicitRoot };
  }
  if (envRoot) {
    if (!existsFn(envRoot)) return { error: `GRIMOIRE_COMPENDIUM_ROOT=${envRoot} does not exist. Refusing to create it.` };
    return { kind: 'env', path: envRoot };
  }
  if (configRepoUrl) {
    return { kind: 'managed', path: managedDir, cloneUrl: configRepoUrl };
  }
  if (configLocalRoot) {
    if (!existsFn(configLocalRoot)) {
      return { error: `Configured compendium root ${configLocalRoot} does not exist. Refusing to create it.` };
    }
    return { kind: 'config-local', path: configLocalRoot };
  }
  return {
    error:
      'No compendium root resolves: set GRIMOIRE_COMPENDIUM_ROOT, or add compendiumRepository / roots.compendium to grimoire.config.json.',
  };
}
