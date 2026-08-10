#!/usr/bin/env node
/**
 * Publish a capability's compendium folder (transcript + documents) to the compendium repository
 * as a review branch. The repo-side CI auto-opens the pull request; a human reviews and merges.
 *
 * This is the ONLY sanctioned way anything Grimoire-related performs a network-write git operation.
 * Invoked by LoreWeaver at interview close (`--auto`), or by a user re-running a failed publish.
 *
 * Hard rules, enforced here in code:
 *   - a secret-scan hit blocks the publish outright; there is no override flag
 *   - nothing is pushed unless a human has seen the content: `--auto` requires `--reviewed <digest>`
 *     matching a digest recomputed from what is actually on disk
 *   - never pushes the base branch; only `compendium/<slug>` review branches
 *   - never `--force`; an existing branch is never overwritten with different content
 *   - never merges, closes, or deletes anything remote
 *   - a mid-run failure reports exactly which step failed and what state the clone is in
 *
 * Two-phase by design. Publishing is irreversible in the way that matters — content on a remote has
 * been seen, cached, and possibly indexed even if the branch is deleted an hour later — so the
 * content is shown before it goes anywhere, and the approval is bound to the exact bytes reviewed:
 *
 *   grimoire compendium-push <slug> --review                    # prints content + a digest
 *   grimoire compendium-push <slug> --auto --reviewed <digest>  # refuses if the content moved
 *
 * Run interactively without `--auto` and the two phases collapse into one prompt.
 *
 * Usage:
 *   grimoire compendium-push <slug> [--from <staging-root>] [--root <clone>] [--base main]
 *                            [--remote origin] [--branch-prefix compendium/] [-m <message>]
 *                            [--review] [--auto --reviewed <digest>] [--dry-run]
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { parseArgs as parseArgv, argsError } from '../tools/lib/args.js';
import { readConfig } from '../tools/lib/config.js';
import { collectFiles } from '../tools/lib/fs-walk.js';
import { parseFrontmatter } from '../tools/lib/frontmatter.js';
import { validateCaptureHeader } from '../tools/lib/capture.js';
import {
  scanForSecrets,
  parseRemoteUrl,
  compareUrl,
  resolveBranchName,
  isValidSlug,
  planRootResolution,
  contentDigest,
  isProbablyBinary,
} from '../tools/lib/compendium-git.js';

const MANAGED_DIR = path.join(os.homedir(), '.grimoire', 'compendium');
const COMMIT_IDENTITY = ['-c', 'user.name=LoreWeaver (Grimoire)', '-c', 'user.email=loreweaver@grimoire.local'];

/** Lines of a text artifact shown before the interactive prompt. `--review` prints all of it. */
const PREVIEW_LINES = 40;

const ARG_SPEC = {
  booleans: { '--auto': 'auto', '--dry-run': 'dryRun', '--review': 'review' },
  values: {
    '--root': 'root',
    '--from': 'from',
    '--base': 'base',
    '--remote': 'remote',
    '--branch-prefix': 'branchPrefix',
    '-m': 'message',
    '--message': 'message',
    '--reviewed': 'reviewed',
  },
  defaults: {
    root: null,
    from: null,
    base: 'main',
    remote: 'origin',
    branchPrefix: 'compendium/',
    message: null,
    reviewed: null,
    auto: false,
    dryRun: false,
    review: false,
  },
};

class PublishError extends Error {}

/**
 * Unknown flags are rejected rather than collected as positionals. A typo'd flag that fell through
 * to the positional list would be read as the slug — the one argument that decides what gets
 * published and under what branch name.
 */
function parseArgs(argv) {
  const parsed = parseArgv(argv, ARG_SPEC);
  const problem = argsError(parsed);
  if (problem) throw new PublishError(problem);
  if (parsed.positional.length > 1) {
    throw new PublishError(`Unexpected argument: ${parsed.positional[1]} (one slug per invocation)`);
  }
  return { ...parsed.flags, slug: parsed.positional[0] ?? null };
}

function git(cloneDir, gitArgs, { allowFail = false, identity = false } = {}) {
  const fullArgs = ['-C', cloneDir, ...(identity ? COMMIT_IDENTITY : []), ...gitArgs];
  const result = spawnSync('git', fullArgs, { encoding: 'utf8' });
  if (result.error) throw new PublishError(`git not available: ${result.error.message}`);
  if (result.status !== 0 && !allowFail) {
    throw new PublishError(`git ${gitArgs.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result;
}

/** Whether two capture directories hold different files or different bytes. */
function directoriesDiffer(a, b) {
  const filesA = collectFiles(a);
  const filesB = collectFiles(b);
  if (filesA.length !== filesB.length || filesA.some((f, i) => f !== filesB[i])) return true;
  return filesA.some((relative) => !fs.readFileSync(path.join(a, relative)).equals(fs.readFileSync(path.join(b, relative))));
}

function describeSize(bytes) {
  const lines = isProbablyBinary(bytes) ? null : bytes.toString('utf8').split(/\r?\n/).length;
  const size = bytes.length < 1024 ? `${bytes.length} B` : `${(bytes.length / 1024).toFixed(1)} KB`;
  return lines === null ? `${size}, binary` : `${size}, ${lines} line(s)`;
}

/**
 * Print the artifacts' actual content for a human to read before approving.
 *
 * Binary files are described, never dumped — a screenful of PDF bytes is not something anyone can
 * review, and it would bury the text that matters. Truncation in the interactive preview is stated
 * loudly rather than silently, and points at the command that shows everything.
 */
function writeContent(artifacts, { full }) {
  for (const { path: relPath, bytes } of artifacts) {
    process.stdout.write(`\n${'─'.repeat(76)}\n${relPath}  (${describeSize(bytes)})\n${'─'.repeat(76)}\n`);

    if (isProbablyBinary(bytes)) {
      process.stdout.write('[binary file — not shown. Review it from the local path above.]\n');
      continue;
    }

    const lines = bytes.toString('utf8').split(/\r?\n/);
    const shown = full ? lines : lines.slice(0, PREVIEW_LINES);
    process.stdout.write(`${shown.join('\n')}\n`);
    if (shown.length < lines.length) {
      process.stdout.write(
        `\n[… ${lines.length - shown.length} more line(s) not shown. ` +
          'Run with --review to read the whole file.]\n'
      );
    }
  }
  process.stdout.write(`\n${'─'.repeat(76)}\n`);
}

async function confirmInteractively(promptText) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(promptText)).trim().toLowerCase();
  rl.close();
  return answer === 'y' || answer === 'yes';
}

async function main() {
  const log = (line) => process.stdout.write(`  ${line}\n`);

  const steps = [
    { name: '1. resolve', state: 'not started' },
    { name: '2. prepare clone', state: 'not started' },
    { name: '3. import artifacts', state: 'not started' },
    { name: '4. secret scan', state: 'not started' },
    { name: '5. confirm content', state: 'not started' },
    { name: '6. branch + commit', state: 'not started' },
    { name: '7. push', state: 'not started' },
    { name: '8. report', state: 'not started' },
  ];
  let step = 0;
  let branch = null;
  let cloneDir = null;
  // Captured so the failure report can name the retry command without re-parsing argv — re-parsing
  // inside the catch would throw a second time for exactly the inputs that got us there.
  let args = { slug: null };

  try {
    // ---- 1. resolve --------------------------------------------------------------------------
    // Inside the try on purpose: a malformed flag must produce the same step report as any other
    // failure, not an unhandled exception and a stack trace.
    args = parseArgs(process.argv.slice(2));
    if (!args.slug) throw new PublishError('A slug is required: grimoire compendium-push <slug>');
    if (!isValidSlug(args.slug)) {
      throw new PublishError(`Invalid slug "${args.slug}" — lowercase kebab-case only, no separators.`);
    }

    const config = readConfig();
    const plan = planRootResolution({
      explicitRoot: args.root,
      envRoot: process.env.GRIMOIRE_COMPENDIUM_ROOT,
      configRepoUrl: config.compendiumRepository,
      configLocalRoot: config.roots?.compendium
        ? path.resolve(config.roots.compendium)
        : null,
      managedDir: MANAGED_DIR,
      existsFn: fs.existsSync,
    });
    if (plan.error) throw new PublishError(plan.error);
    cloneDir = plan.path;
    steps[step].state = `ok — ${args.slug} → ${cloneDir} [${plan.kind}]`;

    // ---- 2. prepare clone --------------------------------------------------------------------
    step = 1;
    if (plan.kind === 'managed' && !fs.existsSync(path.join(cloneDir, '.git'))) {
      log(`clone     ${plan.cloneUrl} → ${cloneDir}`);
      if (!args.dryRun) {
        fs.mkdirSync(path.dirname(cloneDir), { recursive: true });
        const cloned = spawnSync('git', ['clone', plan.cloneUrl, cloneDir], { encoding: 'utf8' });
        if (cloned.status !== 0) {
          throw new PublishError(
            `Cannot clone ${plan.cloneUrl}: ${(cloned.stderr || '').trim()}\n` +
              'This machine may not be authenticated to the repository yet. Your artifacts are safe ' +
              'locally; set up git access (SSH key or credential manager), then re-run this command.'
          );
        }
      }
    }
    if (!args.dryRun || fs.existsSync(path.join(cloneDir, '.git'))) {
      git(cloneDir, ['rev-parse', '--is-inside-work-tree']);
      git(cloneDir, ['fetch', args.remote, args.base]);
    }
    const remoteUrl = git(cloneDir, ['remote', 'get-url', args.remote]).stdout.trim();
    // Only needed for the human-facing report URLs; a filesystem-path remote is still publishable.
    const parsedRemote = parseRemoteUrl(remoteUrl);
    steps[step].state = `ok — ${parsedRemote ? `${parsedRemote.host}/${parsedRemote.owner}/${parsedRemote.repo}` : remoteUrl}`;

    // ---- 3. import artifacts -----------------------------------------------------------------
    step = 2;
    const slugInClone = path.join(cloneDir, args.slug);
    // LoreWeaver may have written to a local staging root (e.g. ./compendium) on a machine where
    // the clone didn't exist yet.
    const stagingRoot = args.from ?? path.resolve('compendium');
    const stagingSlug = path.join(stagingRoot, args.slug);
    const inClone = fs.existsSync(slugInClone);
    const inStaging = fs.existsSync(stagingSlug) && path.resolve(stagingSlug) !== path.resolve(slugInClone);

    if (!inClone && !inStaging) {
      throw new PublishError(
        `No artifacts found: neither ${slugInClone} nor ${stagingSlug} exists. ` +
          'Run the interview first, or pass --from <staging-root>.'
      );
    }

    if (!inClone) {
      log(`import    ${stagingSlug} → ${slugInClone}`);
      if (!args.dryRun) fs.cpSync(stagingSlug, slugInClone, { recursive: true });
    } else if (inStaging) {
      // Both copies exist. Publishing the clone's copy while the user edits the staging one is a
      // silent wrong answer — they review what they wrote and ship something else. An explicit
      // --from says which copy is authoritative; without it, refuse rather than guess.
      const differs = directoriesDiffer(stagingSlug, slugInClone);
      if (differs && !args.from) {
        throw new PublishError(
          `Two copies of ${args.slug} exist and they differ:\n` +
            `    staging: ${stagingSlug}\n` +
            `    clone:   ${slugInClone}\n` +
            'Refusing to guess which one to publish. Re-run with --from ' +
            `${stagingRoot} to publish the staging copy, or delete whichever is stale.`
        );
      }
      if (differs) {
        log(`refresh   ${stagingSlug} → ${slugInClone}`);
        if (!args.dryRun) {
          fs.rmSync(slugInClone, { recursive: true, force: true });
          fs.cpSync(stagingSlug, slugInClone, { recursive: true });
        }
      }
    }
    const effectiveSlugDir = fs.existsSync(slugInClone) ? slugInClone : path.join(args.from ?? path.resolve('compendium'), args.slug);
    const transcriptPath = path.join(effectiveSlugDir, 'transcript.md');
    if (!fs.existsSync(transcriptPath)) {
      throw new PublishError(`${args.slug}/transcript.md is missing — a capture without a transcript is not publishable.`);
    }

    // A capture that cannot say who was interviewed, when, or what it covered is not reviewable —
    // and publishing is the point at which it stops being fixable in private.
    const header = parseFrontmatter(fs.readFileSync(transcriptPath, 'utf8'));
    if (!header.found) {
      throw new PublishError(
        `${args.slug}/transcript.md has no capture header.\n` +
          'Add the frontmatter block described in OUTPUT-CONTRACT.md §3 — who was interviewed, their\n' +
          'role, the date, the theme, and the categories covered — then re-run.'
      );
    }
    const headerCheck = validateCaptureHeader(header.data, {
      slug: args.slug,
      categories: config.categories,
    });
    if (headerCheck.errors.length > 0) {
      throw new PublishError(
        `${args.slug}/transcript.md has an invalid capture header:\n` +
          headerCheck.errors.map((message) => `    ${message}`).join('\n')
      );
    }
    for (const warning of headerCheck.warnings) log(`warn      ${warning}`);
    // Unrelated dirty state outside the slug must never be swept into this commit.
    const dirty = git(cloneDir, ['status', '--porcelain'])
      .stdout.split('\n')
      .filter((line) => line.trim() !== '' && !line.slice(3).startsWith(`${args.slug}/`));
    if (dirty.length > 0) {
      throw new PublishError(
        `The compendium clone has unrelated uncommitted changes:\n    ${dirty.join('\n    ')}\n` +
          'Commit, stash, or discard them first — this tool only ever commits the slug being published.'
      );
    }

    // Read every artifact once, as bytes. Everything downstream — the scan, the digest, the review
    // display — works from this snapshot, so all three are guaranteed to describe the same content.
    const artifacts = collectFiles(effectiveSlugDir).map((relative) => ({
      path: path.join(args.slug, relative),
      bytes: fs.readFileSync(path.join(effectiveSlugDir, relative)),
    }));
    const files = artifacts.map((a) => a.path);
    steps[step].state = `ok — ${files.length} file(s)`;

    // ---- 4. secret scan ----------------------------------------------------------------------
    step = 3;
    const findings = scanForSecrets(
      artifacts.map(({ path: p, bytes }) => ({ path: p, content: bytes.toString('utf8') }))
    );
    if (findings.length > 0) {
      const lines = findings.map((f) => `    ${f.path}:${f.line} — ${f.kind}`);
      throw new PublishError(
        `Secret scan found ${findings.length} match(es); publish blocked (no override exists):\n${lines.join('\n')}\n` +
          'Remove or link-out the sensitive content, then re-run.'
      );
    }
    steps[step].state = 'ok — no matches';

    // ---- 5. confirm content -------------------------------------------------------------------
    step = 4;
    const digest = contentDigest(artifacts.map(({ path: p, bytes }) => ({ path: p, content: bytes })));
    const repoLabel = parsedRemote
      ? `${parsedRemote.host}/${parsedRemote.owner}/${parsedRemote.repo}`
      : remoteUrl;
    const mode = args.review ? ' (review)' : args.dryRun ? ' (dry run)' : '';
    process.stdout.write(
      `\ngrimoire compendium-push${mode}\n` +
        `  slug:    ${args.slug}\n` +
        `  repo:    ${repoLabel} (branch off ${args.base}; never pushed to ${args.base} directly)\n` +
        `  digest:  ${digest}\n` +
        `  files:\n${artifacts.map((a) => `    ${a.path}  (${describeSize(a.bytes)})`).join('\n')}\n`
    );

    // Show the content itself. A file list is not a review — the user is approving what the text
    // says, not that a path exists.
    if (args.review || (!args.auto && !args.dryRun)) {
      writeContent(artifacts, { full: args.review });
    }

    if (args.review) {
      for (let i = step; i < steps.length; i++) steps[i].state = 'skipped — review only';
      steps[step].state = `ok — ${files.length} file(s) shown, digest ${digest}`;
      finish(steps, 'REVIEW — nothing written, nothing pushed');
      process.stdout.write(
        `\nIf this is what should be published, approve it with:\n` +
          `  grimoire compendium-push ${args.slug} --auto --reviewed ${digest}\n` +
          `The digest is checked again at push time, so any edit after this point stops the publish.\n`
      );
      return;
    }

    if (args.dryRun) {
      for (let i = step; i < steps.length; i++) steps[i].state = 'skipped — dry run';
      finish(steps, 'DRY RUN — nothing written, nothing pushed');
      return;
    }

    if (args.auto) {
      // `--auto` is not an approval, it is the absence of a terminal. The approval is the digest,
      // which can only have come from a review someone actually read.
      if (!args.reviewed) {
        throw new PublishError(
          'Refusing to publish unreviewed content.\n' +
            `Run \`grimoire compendium-push ${args.slug} --review\`, show its output to the user, and\n` +
            'once they approve, pass the digest it printed:\n' +
            `  grimoire compendium-push ${args.slug} --auto --reviewed <digest>`
        );
      }
      if (args.reviewed !== digest) {
        throw new PublishError(
          `The capture changed since it was reviewed — publish blocked.\n` +
            `  approved: ${args.reviewed}\n` +
            `  on disk:  ${digest}\n` +
            'Re-run --review, show the user what it says now, and approve the new digest.'
        );
      }
      steps[step].state = `ok — content digest ${digest} approved`;
    } else if (process.stdin.isTTY) {
      const confirmed = await confirmInteractively(`\nPublish this content for review? [y/N] `);
      if (!confirmed) throw new PublishError('Aborted by user.');
      steps[step].state = `ok — confirmed interactively (digest ${digest})`;
    } else {
      throw new PublishError(
        'No TTY for confirmation, and no approved digest.\n' +
          `Re-run in a terminal, or run --review first and pass --auto --reviewed <digest>.`
      );
    }

    // ---- 6. branch + commit ------------------------------------------------------------------
    step = 5;
    const localRefs = git(cloneDir, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
      .stdout.split('\n').filter(Boolean);
    const remoteRefs = git(cloneDir, ['ls-remote', '--heads', args.remote])
      .stdout.split('\n').filter(Boolean).map((line) => line.split('refs/heads/')[1]).filter(Boolean);
    branch = resolveBranchName(args.slug, {
      prefix: args.branchPrefix,
      existingRefs: new Set([...localRefs, ...remoteRefs]),
    });

    git(cloneDir, ['switch', '-c', branch, '--track', `${args.remote}/${args.base}`]);
    git(cloneDir, ['add', '--', `${args.slug}/`]);
    const message = args.message ?? `Add compendium capture: ${args.slug}`;
    git(cloneDir, ['commit', '-m', message], { identity: true });
    const sha = git(cloneDir, ['rev-parse', '--short', 'HEAD']).stdout.trim();
    steps[step].state = `ok — ${branch} @ ${sha}`;

    // ---- 7. push (never --force) --------------------------------------------------------------
    step = 6;
    git(cloneDir, ['push', '-u', args.remote, branch]);
    git(cloneDir, ['switch', args.base]);
    steps[step].state = `ok — pushed to ${args.remote}`;

    // ---- 8. report ---------------------------------------------------------------------------
    step = 7;
    steps[step].state = 'ok';
    finish(steps, 'DONE');
    if (parsedRemote) {
      const url = compareUrl({ ...parsedRemote, base: args.base, branch });
      process.stdout.write(
        `\nThe repository's CI opens the pull request automatically.\n` +
          `Review it at: https://${parsedRemote.host}/${parsedRemote.owner}/${parsedRemote.repo}/pulls\n` +
          `(If no PR appears, open one manually: ${url})\n` +
          'A human merges after review. This tool never merges.\n'
      );
    } else {
      process.stdout.write(`\nPushed review branch ${branch} to ${remoteUrl}. A human reviews and merges.\n`);
    }
  } catch (err) {
    // A failure between step boundaries must never lose its message — mark the step FAILED even if
    // its happy-path state was already recorded.
    steps[step].state = `FAILED — ${err.message.split('\n')[0]}`;
    for (let i = step + 1; i < steps.length; i++) steps[i].state = 'skipped';

    process.stderr.write('\ngrimoire compendium-push: FAILED\n');
    process.stderr.write(`\n${err.message}\n`);
    for (const s of steps) process.stderr.write(`  ${s.name}: ${s.state}\n`);
    if (branch && cloneDir) {
      process.stderr.write(
        `\nLocal state: the clone at ${cloneDir} is on branch ${branch}; your commit (if created) is intact.\n` +
          `Nothing was force-pushed and nothing was lost. Fix the cause and re-run:\n` +
          `  grimoire compendium-push ${args.slug ?? '<slug>'}\n`
      );
    } else {
      process.stderr.write('\nYour artifacts remain untouched on disk. Fix the cause and re-run the same command.\n');
    }
    if (!(err instanceof PublishError)) process.stderr.write(`\n${err.stack}\n`);
    process.exit(1);
  }
}

function finish(steps, verdict) {
  process.stdout.write(`grimoire compendium-push: ${verdict}\n`);
  for (const s of steps) process.stdout.write(`  ${s.name}: ${s.state}\n`);
}

main();
