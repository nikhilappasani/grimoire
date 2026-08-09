/**
 * End-to-end test of scripts/compendium-push.js against a throwaway local git pair — a bare
 * "origin" plus a working clone — built entirely under os.tmpdir(). Fully offline: no GitHub, no
 * network. This is the layer that proves the no-silent-partial-state behavior for real, not just
 * at the unit level.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'compendium-push.js');

function sh(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...options });
  assert.equal(result.status, 0, `${cmd} ${args.join(' ')} failed:\n${result.stderr}\n${result.stdout}`);
  return result;
}

/** Build a bare origin with a main branch plus an authenticated-by-filesystem working clone. */
function makeRepoPair(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'grimoire-cpush-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));

  const bare = path.join(base, 'origin.git');
  const seed = path.join(base, 'seed');
  const clone = path.join(base, 'clone');

  sh('git', ['init', '--bare', '-b', 'main', bare]);
  sh('git', ['init', '-b', 'main', seed]);
  fs.writeFileSync(path.join(seed, 'README.md'), '# compendium test\n');
  const identity = ['-c', 'user.name=test', '-c', 'user.email=test@example.com'];
  sh('git', ['-C', seed, 'add', '-A']);
  sh('git', ['-C', seed, ...identity, 'commit', '-m', 'seed']);
  sh('git', ['-C', seed, 'push', bare, 'main']);
  sh('git', ['clone', bare, clone]);

  return { base, bare, clone };
}

function writeSlug(root, slug, transcript = '# Transcript\n\nQ/A content, nothing sensitive.\n') {
  const dir = path.join(root, slug);
  fs.mkdirSync(path.join(dir, 'documents'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'transcript.md'), transcript);
  fs.writeFileSync(path.join(dir, 'documents', 'notes.md'), '# Supplied notes\n');
}

function runPush(clone, args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GRIMOIRE_COMPENDIUM_ROOT: clone },
    cwd: os.tmpdir(), // never resolve a grimoire.config.json from the real repo during tests
  });
}

/** The digest `--review` printed, or null if it did not get that far. */
function reviewDigest(clone, slug) {
  const result = runPush(clone, [slug, '--review']);
  return result.stdout.match(/^ {2}digest: {2}([0-9a-f]{12})$/m)?.[1] ?? null;
}

/**
 * The approved-publish path as LoreWeaver performs it: review, show the user, then push the exact
 * digest they approved. Most tests care about what happens after approval, not about approval.
 */
function runApprovedPush(clone, slug, extra = []) {
  const digest = reviewDigest(clone, slug);
  assert.ok(digest, `--review did not produce a digest for ${slug}`);
  return runPush(clone, [slug, '--auto', '--reviewed', digest, ...extra]);
}

test('publishes a slug as a review branch, leaving main untouched', (t) => {
  const { bare, clone } = makeRepoPair(t);
  writeSlug(clone, 'deploy-process');

  const result = runApprovedPush(clone, 'deploy-process');
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /pushed to origin/);

  const remoteBranches = sh('git', ['-C', bare, 'branch', '--list']).stdout;
  assert.match(remoteBranches, /compendium\/deploy-process/);

  // main on the origin must not contain the slug — only the review branch does.
  const mainFiles = sh('git', ['-C', bare, 'ls-tree', '-r', '--name-only', 'main']).stdout;
  assert.ok(!mainFiles.includes('deploy-process/transcript.md'), 'main must be untouched');
  const branchFiles = sh('git', ['-C', bare, 'ls-tree', '-r', '--name-only', 'compendium/deploy-process']).stdout;
  assert.ok(branchFiles.includes('deploy-process/transcript.md'));
  assert.ok(branchFiles.includes('deploy-process/documents/notes.md'));

  // the clone is returned to main on success
  const head = sh('git', ['-C', clone, 'branch', '--show-current']).stdout.trim();
  assert.equal(head, 'main');
});

test('a second publish of the same slug gets a collision-suffixed branch, never an overwrite', (t) => {
  const { bare, clone } = makeRepoPair(t);
  writeSlug(clone, 'deploy-process');
  assert.equal(runApprovedPush(clone, 'deploy-process').status, 0);

  // After a publish, the slug lives on the review branch, not main's working tree — a re-publish
  // is a fresh write, exactly as LoreWeaver would do on a follow-up interview.
  writeSlug(clone, 'deploy-process', '# Transcript\n\nRevised after follow-up interview.\n');
  const second = runApprovedPush(clone, 'deploy-process');
  assert.equal(second.status, 0, second.stderr + second.stdout);

  const branches = sh('git', ['-C', bare, 'branch', '--list']).stdout;
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  assert.match(branches, new RegExp(`compendium/deploy-process-${stamp}`));
});

test('a secret in the transcript blocks the publish before anything touches git', (t) => {
  const { bare, clone } = makeRepoPair(t);
  writeSlug(clone, 'leaky', '# Transcript\n\nA: our loader key is AKIAIOSFODNN7EXAMPLE\n');

  const result = runPush(clone, ['leaky', '--auto']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Secret scan found/);
  assert.match(result.stderr, /AWS access key id/);
  assert.ok(!result.stderr.includes('AKIA'), 'the secret itself must never be echoed');

  const branches = sh('git', ['-C', bare, 'branch', '--list']).stdout;
  assert.ok(!branches.includes('leaky'), 'nothing may be pushed when the scan fails');
});

test('a rejected push reports FAILED with the local commit intact and nothing force-pushed', (t) => {
  const { bare, clone } = makeRepoPair(t);
  writeSlug(clone, 'race-case');

  // Simulate the race: after branch names are checked but content differs, the remote ref appears.
  // Easiest deterministic version: pre-create the remote branch pointing at main, then make the
  // local push non-fast-forward by having the script's collision check miss it — instead, we make
  // the remote reject ALL pushes via a pre-receive hook, which models any rejection (protection,
  // permission, race) identically from the client's point of view.
  const hook = path.join(bare, 'hooks', 'pre-receive');
  fs.writeFileSync(hook, '#!/bin/sh\necho "rejected by test hook" >&2\nexit 1\n');
  fs.chmodSync(hook, 0o755);

  const result = runApprovedPush(clone, 'race-case');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /7\. push:\s+FAILED/);
  assert.match(result.stderr, /Nothing was force-pushed and nothing was lost/);

  // the local commit exists on the local review branch
  const branches = sh('git', ['-C', clone, 'branch', '--list']).stdout;
  assert.match(branches, /compendium\/race-case/);
  const files = sh('git', ['-C', clone, 'ls-tree', '-r', '--name-only', 'compendium/race-case']).stdout;
  assert.ok(files.includes('race-case/transcript.md'));
});

test('missing transcript is rejected at import, and a missing slug is a clear error', (t) => {
  const { clone } = makeRepoPair(t);

  fs.mkdirSync(path.join(clone, 'no-transcript', 'documents'), { recursive: true });
  fs.writeFileSync(path.join(clone, 'no-transcript', 'documents', 'x.md'), 'x');
  const noTranscript = runPush(clone, ['no-transcript', '--auto']);
  assert.equal(noTranscript.status, 1);
  assert.match(noTranscript.stderr, /transcript\.md is missing/);

  const noSlug = runPush(clone, ['--auto']);
  assert.equal(noSlug.status, 1);
  assert.match(noSlug.stderr, /A slug is required/);

  const badSlug = runPush(clone, ['../escape', '--auto']);
  assert.equal(badSlug.status, 1);
  assert.match(badSlug.stderr, /Invalid slug/);
});

test('--review shows the actual content and a digest, and pushes nothing', (t) => {
  const { bare, clone } = makeRepoPair(t);
  writeSlug(clone, 'shown', '# Transcript\n\nQ: what breaks first?\nA: the nightly loader.\n');

  const result = runPush(clone, ['shown', '--review']);
  assert.equal(result.status, 0, result.stderr);
  // The content itself, not just the filename — that distinction is the whole point.
  assert.match(result.stdout, /Q: what breaks first\?/);
  assert.match(result.stdout, /A: the nightly loader\./);
  assert.match(result.stdout, /shown\/documents\/notes\.md/);
  assert.match(result.stdout, /REVIEW — nothing written, nothing pushed/);
  assert.match(result.stdout, /--auto --reviewed [0-9a-f]{12}/);

  assert.ok(!sh('git', ['-C', bare, 'branch', '--list']).stdout.includes('shown'));
});

test('--auto without an approved digest refuses to publish', (t) => {
  const { bare, clone } = makeRepoPair(t);
  writeSlug(clone, 'unreviewed');

  const result = runPush(clone, ['unreviewed', '--auto']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to publish unreviewed content/);
  assert.match(result.stderr, /5\. confirm content:\s+FAILED/);
  assert.ok(!sh('git', ['-C', bare, 'branch', '--list']).stdout.includes('unreviewed'));
});

test('a digest approved for different content is rejected', (t) => {
  const { bare, clone } = makeRepoPair(t);
  writeSlug(clone, 'edited', '# Transcript\n\nThe version the user read and approved.\n');
  const approved = reviewDigest(clone, 'edited');

  // The capture changes after approval — the case the digest exists to catch.
  writeSlug(clone, 'edited', '# Transcript\n\nSomething else entirely, never shown to anyone.\n');

  const result = runPush(clone, ['edited', '--auto', '--reviewed', approved]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /changed since it was reviewed/);
  assert.match(result.stderr, new RegExp(`approved: ${approved}`));
  assert.ok(!sh('git', ['-C', bare, 'branch', '--list']).stdout.includes('edited'));
});

test('the digest covers document renames, not just transcript bytes', (t) => {
  const { clone } = makeRepoPair(t);
  writeSlug(clone, 'renamed');
  const before = reviewDigest(clone, 'renamed');

  fs.renameSync(
    path.join(clone, 'renamed', 'documents', 'notes.md'),
    path.join(clone, 'renamed', 'documents', 'renamed-notes.md')
  );
  assert.notEqual(reviewDigest(clone, 'renamed'), before);
});

test('a digest stays stable across repeated reviews of unchanged content', (t) => {
  const { clone } = makeRepoPair(t);
  writeSlug(clone, 'stable');
  assert.equal(reviewDigest(clone, 'stable'), reviewDigest(clone, 'stable'));
});

test('without a TTY and without a digest, the publish stops rather than assuming consent', (t) => {
  const { clone } = makeRepoPair(t);
  writeSlug(clone, 'headless');

  // No --auto and no terminal: the interactive prompt cannot run, so there is no approval to be had.
  const result = runPush(clone, ['headless']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No TTY for confirmation, and no approved digest/);
});

test('a malformed flag fails as a reported step, not an unhandled exception', (t) => {
  // Argument parsing used to run before the try block, so a typo'd flag bypassed the step report
  // and printed a raw Node stack trace — from the one script whose contract is that every failure
  // says which step failed and what state the clone is in.
  const { clone } = makeRepoPair(t);

  for (const argv of [['slug', '--bogus'], ['slug', '--base'], ['a', 'b', '--auto']]) {
    const result = runPush(clone, argv);
    assert.equal(result.status, 1, `${argv.join(' ')} should fail`);
    assert.match(result.stderr, /grimoire compendium-push: FAILED/);
    assert.match(result.stderr, /1\. resolve:\s+FAILED/);
    assert.ok(!result.stderr.includes('at main'), `${argv.join(' ')} leaked a stack trace`);
  }
});

test('the CLI dispatcher never injects a default path as the slug', () => {
  // Regression guard for withDefaultPath: every other command gets a default positional appended;
  // compendium-push must instead fail with "slug required", not receive the repo root as a slug.
  const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'grimoire.js');
  const result = spawnSync(process.execPath, [cli, 'compendium-push', '--dry-run'], {
    encoding: 'utf8',
    cwd: os.tmpdir(),
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /A slug is required/);
  assert.ok(!result.stderr.includes('Invalid slug'), 'a path must not have been injected as the slug');
});

test('--dry-run pushes nothing and leaves the clone clean', (t) => {
  const { bare, clone } = makeRepoPair(t);
  writeSlug(clone, 'dry-slug');

  const result = runPush(clone, ['dry-slug', '--dry-run']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /DRY RUN — nothing written, nothing pushed/);

  const branches = sh('git', ['-C', bare, 'branch', '--list']).stdout;
  assert.ok(!branches.includes('dry-slug'));
  const head = sh('git', ['-C', clone, 'branch', '--show-current']).stdout.trim();
  assert.equal(head, 'main');
});

test('unrelated dirty state in the clone blocks the publish', (t) => {
  const { clone } = makeRepoPair(t);
  writeSlug(clone, 'tidy-slug');
  fs.writeFileSync(path.join(clone, 'README.md'), '# unrelated local edit\n');

  const result = runPush(clone, ['tidy-slug', '--auto']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unrelated uncommitted changes/);
});
