/**
 * The harness registry — the single source for every harness→directory mapping.
 *
 * This mapping was previously expressed three times in two files (sync's HARNESS_TARGETS, install's
 * HARNESS_HOMES and SOURCE_DIRS), which meant adding a harness took three coordinated edits and
 * getting one wrong produced artifacts that generated but would not install. The values are
 * identical by necessity — install reads exactly what sync writes — so they are one table.
 *
 * `dir` is always POSIX-separated and always relative. It is joined onto a repository root
 * (sync's output, install's source) or onto the user's home directory (install's `--home`), and
 * `path.join` normalizes separators per platform at each use.
 */

export const HARNESSES = {
  'claude-code': { dir: '.claude/skills', prompts: false },
  codex: { dir: '.codex/skills', prompts: false },
  copilot: { dir: '.copilot/skills', prompts: false },
  pi: { dir: '.pi/skills', prompts: true },
};

/** Harness names, sorted — for error messages and allow-list output. */
export function harnessNames() {
  return Object.keys(HARNESSES).sort();
}

/**
 * Whether `name` is a known harness.
 *
 * Uses `hasOwnProperty` rather than `in` or a truthiness check on purpose: a harness name reaches
 * `install.js` from `--target` and becomes a path segment, so `"constructor"` or `"__proto__"` must
 * answer false here rather than resolving through the prototype chain.
 */
export function isKnownHarness(name) {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(HARNESSES, name);
}
