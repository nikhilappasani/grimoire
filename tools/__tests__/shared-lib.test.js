/**
 * The remaining extracted helpers: the directory walk and the harness registry.
 *
 * Both were duplicated across scripts before extraction, so these tests pin the properties the
 * callers silently depended on — the ones a re-implementation would be most likely to drop.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { collectFiles } from '../lib/fs-walk.js';
import { HARNESSES, harnessNames, isKnownHarness } from '../lib/harnesses.js';
import { findConfigDir, resolveBase, readConfig, PACKAGE_ROOT } from '../lib/config.js';

function tempTree(t, entries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grimoire-lib-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [relative, contents] of Object.entries(entries)) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return root;
}

test('collectFiles returns every file, and only files, relative to the walk root', (t) => {
  const root = tempTree(t, {
    'SKILL.md': 'a',
    'references/INTERVIEW.md': 'b',
    'references/nested/deep.md': 'c',
  });
  assert.deepEqual(new Set(collectFiles(root)), new Set([
    'SKILL.md',
    path.join('references', 'INTERVIEW.md'),
    path.join('references', 'nested', 'deep.md'),
  ]));
});

test('collectFiles is stable between runs over the same tree', (t) => {
  // Load-bearing: `sync --check` compares generated output byte for byte, and readdirSync makes no
  // ordering promise, so an unsorted walk would report drift that does not exist.
  //
  // The assertion is repeatability, not a fixed sequence. Sibling entries are ordered with
  // localeCompare, whose result depends on the runtime's default locale ("references" sorts before
  // "SKILL.md" in en-US but not under LC_ALL=C), and every consumer treats the order as
  // presentational — each file is written to its own destination path regardless of position.
  const root = tempTree(t, { 'z.md': 'z', 'a.md': 'a', 'm/b.md': 'b', 'm/a.md': 'a' });
  assert.deepEqual(collectFiles(root), collectFiles(root));
  assert.deepEqual(collectFiles(path.join(root, 'm')), ['a.md', 'b.md']);
});

test('collectFiles honours an explicit base different from the walk root', (t) => {
  const root = tempTree(t, { 'skills/loreweaver/SKILL.md': 'a' });
  const walked = collectFiles(path.join(root, 'skills', 'loreweaver'), root);
  assert.deepEqual(walked, [path.join('skills', 'loreweaver', 'SKILL.md')]);
});

test('collectFiles returns an empty list for an empty directory', (t) => {
  const root = tempTree(t, { 'placeholder/keep': '' });
  fs.rmSync(path.join(root, 'placeholder', 'keep'));
  assert.deepEqual(collectFiles(path.join(root, 'placeholder')), []);
});

test('every harness has a relative POSIX dir and a prompts flag', () => {
  for (const [name, target] of Object.entries(HARNESSES)) {
    assert.equal(typeof target.dir, 'string', `${name} needs a dir`);
    assert.ok(!path.isAbsolute(target.dir), `${name}: dir must be relative — it is joined onto a root`);
    assert.ok(!target.dir.includes('\\'), `${name}: dir must be POSIX-separated`);
    assert.ok(!target.dir.includes('..'), `${name}: dir must not escape its root`);
    assert.equal(typeof target.prompts, 'boolean', `${name} needs a prompts flag`);
  }
});

test('harnessNames is sorted, for stable error messages', () => {
  assert.deepEqual(harnessNames(), [...harnessNames()].sort());
  assert.deepEqual(harnessNames(), ['claude-code', 'codex', 'copilot', 'pi']);
});

test('isKnownHarness does not resolve through the prototype chain', () => {
  // `--target` becomes a path segment in install.js, so this is the allow-list, not a convenience.
  assert.equal(isKnownHarness('claude-code'), true);
  assert.equal(isKnownHarness('constructor'), false);
  assert.equal(isKnownHarness('__proto__'), false);
  assert.equal(isKnownHarness('toString'), false);
  assert.equal(isKnownHarness(undefined), false);
});

test('findConfigDir walks up to the nearest config and returns null past the root', (t) => {
  const root = tempTree(t, {
    'grimoire.config.json': '{"contentVersion":"9.9.9"}',
    'a/b/c/placeholder': '',
  });
  assert.equal(findConfigDir(path.join(root, 'a', 'b', 'c')), fs.realpathSync(root));
  assert.equal(findConfigDir(path.parse(process.cwd()).root), null);
});

test('readConfig reads the nearest config, and resolveBase agrees with it', (t) => {
  const root = tempTree(t, {
    'grimoire.config.json': '{"contentVersion":"9.9.9"}',
    'nested/placeholder': '',
  });
  const from = path.join(root, 'nested');
  assert.equal(readConfig(from).contentVersion, '9.9.9');
  assert.equal(resolveBase(from), fs.realpathSync(root));
});

test('outside any repository, both fall back to the installed package', () => {
  const outside = path.parse(process.cwd()).root;
  assert.equal(resolveBase(outside), PACKAGE_ROOT);
  // The package ships its own config, so this is the real fallback the CLI relies on.
  assert.equal(typeof readConfig(outside).contentVersion, 'string');
});

test('grimoire preflight runs the same gates npm run preflight does', () => {
  // These are two doors onto the same gate. `grimoire preflight` used to skip the test suite while
  // its help text claimed otherwise, so whichever door a contributor happened to use decided
  // whether tests ran at all — and the one that skipped them still printed a pass.
  const cli = fs.readFileSync(path.join(PACKAGE_ROOT, 'bin', 'grimoire.js'), 'utf8');
  const npmScript = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
    .scripts.preflight;

  for (const gate of ['test', 'validate', 'lint', 'check-knowledge']) {
    assert.ok(npmScript.includes(gate), `npm run preflight must run ${gate}`);
  }

  const cliPreflight = cli.slice(cli.indexOf("command === 'preflight'"));
  assert.match(cliPreflight, /runTests\(base\)/, 'CLI preflight must run the test suite');
  for (const script of ['validate-plugin.js', 'lint-skills.js', 'check-knowledge-bundle.js']) {
    assert.ok(cliPreflight.includes(script), `CLI preflight must run ${script}`);
  }
});

test('PACKAGE_ROOT is a real directory containing the package manifest', () => {
  // Regression guard: this was previously derived with `new URL(...).pathname`, which yields an
  // unusable "/C:/..." path on Windows.
  assert.ok(fs.existsSync(path.join(PACKAGE_ROOT, 'package.json')));
  assert.ok(fs.existsSync(path.join(PACKAGE_ROOT, 'grimoire.config.json')));
});
