/**
 * Locating and reading `grimoire.config.json` — the single implementation.
 *
 * Installed globally, the working directory is wherever the user happens to be, which is usually
 * not a Grimoire repository. Every entry point therefore walks up from the cwd looking for a
 * config, then falls back to the installed package's own. That walk was written twice (the CLI
 * dispatcher and the publish script) and the two copies had already drifted: one resolved its
 * fallback with `fileURLToPath`, the other with `new URL(...).pathname`, which yields a broken
 * `/C:/...` path on Windows.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONFIG_FILENAME = 'grimoire.config.json';

/** The installed package's own root — the last-resort fallback when the cwd is outside a repo. */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Walk up from `startDir` looking for a directory containing `grimoire.config.json`.
 *
 * @param {string} [startDir]
 * @returns {string|null} The containing directory, or null if the filesystem root is reached first.
 */
export function findConfigDir(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, CONFIG_FILENAME))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * The directory commands should operate on: the nearest enclosing Grimoire repository, or the
 * installed package itself so `grimoire sync` works from anywhere.
 */
export function resolveBase(startDir = process.cwd()) {
  return findConfigDir(startDir) ?? PACKAGE_ROOT;
}

/**
 * Read the nearest `grimoire.config.json`, falling back to the installed package's own.
 *
 * Returns `{}` rather than throwing when no config exists anywhere: callers treat a missing key as
 * "not configured" and produce their own domain-specific error, which is more useful than a parse
 * failure from here.
 */
export function readConfig(startDir = process.cwd()) {
  const dir = findConfigDir(startDir) ?? PACKAGE_ROOT;
  const file = path.join(dir, CONFIG_FILENAME);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
