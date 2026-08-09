/**
 * Directory walking — the single implementation.
 *
 * Three scripts copy files from a source tree to a destination tree (sync, install, compendium
 * publish). All three need the same walk, and all three depend on the same two properties, so the
 * walk lives here rather than in each of them:
 *
 *  - **Sorted, depth-first.** Generated output must be byte-identical between runs on the same
 *    input, or `sync --check` reports drift that isn't there and a publish produces a diff that
 *    isn't real. `readdirSync` makes no ordering promise, so the sort is load-bearing, not cosmetic.
 *  - **Paths relative to the walk root.** Callers join them onto a destination; an absolute path
 *    here would silently write outside it.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * List every file under `dir`, recursively, as paths relative to `base`.
 * Directories themselves are not returned — only the files inside them.
 *
 * @param {string} dir  Directory to walk.
 * @param {string} [base]  Root that returned paths are relative to. Defaults to `dir`.
 * @returns {string[]} Relative file paths, sorted, depth-first.
 */
export function collectFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}
