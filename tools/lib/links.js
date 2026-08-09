/**
 * Relative-link extraction and case-sensitive existence checking.
 *
 * `fs.existsSync` is case-INsensitive on macOS and Windows. A link written as `./References/X.md`
 * against a real `references/X.md` passes on a developer laptop and fails on a Linux CI runner. This
 * module compares against `readdirSync` output so the check behaves identically everywhere.
 */

import fs from 'node:fs';
import path from 'node:path';

const MARKDOWN_LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const ABSOLUTE_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

const dirCache = new Map();

function readdirCached(dir) {
  if (!dirCache.has(dir)) {
    try {
      dirCache.set(dir, fs.readdirSync(dir));
    } catch {
      dirCache.set(dir, null);
    }
  }
  return dirCache.get(dir);
}

/** Clear the readdir cache. Call between runs that mutate the filesystem. */
export function resetCache() {
  dirCache.clear();
}

/**
 * Extract relative markdown links from source, with their 1-indexed line numbers.
 *
 * Excluded, because none of them is a link to a file in this repository:
 *  - absolute URLs and any other scheme, and protocol-relative `//` links
 *  - pure `#anchor` links
 *  - anything inside a fenced code block or an inline code span. Reference documents show example
 *    concept files containing example links; resolving those is a false positive that trains people
 *    to ignore the linter.
 *
 * @param {string} source
 * @returns {{target: string, line: number}[]}
 */
export function extractRelativeLinks(source) {
  const found = [];
  const lines = source.split(/\r?\n/);
  let fence = null;

  lines.forEach((line, index) => {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0].repeat(3);
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      return;
    }
    if (fence !== null) return;

    const withoutInlineCode = line.replace(/`[^`]*`/g, (span) => ' '.repeat(span.length));

    MARKDOWN_LINK_RE.lastIndex = 0;
    let match;
    while ((match = MARKDOWN_LINK_RE.exec(withoutInlineCode)) !== null) {
      const target = match[1];
      if (target.startsWith('#')) continue;
      if (ABSOLUTE_SCHEME_RE.test(target)) continue;
      if (target.startsWith('//')) continue;
      found.push({ target, line: index + 1 });
    }
  });

  return found;
}

/**
 * Case-sensitive existence check, regardless of host filesystem semantics.
 * @param {string} absolutePath
 * @returns {boolean}
 */
export function existsCaseSensitive(absolutePath) {
  const resolved = path.resolve(absolutePath);
  const { root } = path.parse(resolved);
  const segments = resolved.slice(root.length).split(path.sep).filter(Boolean);

  let current = root;
  for (const segment of segments) {
    const entries = readdirCached(current);
    if (entries === null || !entries.includes(segment)) return false;
    current = path.join(current, segment);
  }
  return true;
}

/**
 * Check every relative link in a markdown file.
 *
 * @param {string} filePath  Absolute path to the markdown file.
 * @param {string} source    Its contents.
 * @returns {{target:string, line:number, reason:'missing'|'case-mismatch'}[]}
 */
export function findBrokenLinks(filePath, source) {
  const baseDir = path.dirname(path.resolve(filePath));
  const broken = [];

  for (const { target, line } of extractRelativeLinks(source)) {
    const withoutAnchor = target.split('#')[0];
    if (withoutAnchor === '') continue;

    const decoded = decodeURIComponent(withoutAnchor);
    const resolved = path.resolve(baseDir, decoded);

    if (existsCaseSensitive(resolved)) continue;

    // Distinguish a genuine miss from a casing bug — the second is far more confusing to debug.
    const reason = fs.existsSync(resolved) ? 'case-mismatch' : 'missing';
    broken.push({ target, line, reason });
  }

  return broken;
}
