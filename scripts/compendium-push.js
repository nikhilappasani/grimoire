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
 *   - never pushes the base branch; only `compendium/<slug>` review branches
 *   - never `--force`; an existing branch is never overwritten with different content
 *   - never merges, closes, or deletes anything remote
 *   - a mid-run failure reports exactly which step failed and what state the clone is in
 *
 * Usage:
 *   grimoire compendium-push <slug> [--from <staging-root>] [--root <clone>] [--base main]
 *                            [--remote origin] [--branch-prefix compendium/] [-m <message>]
 *                            [--auto] [--dry-run]
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  scanForSecrets,
  parseRemoteUrl,
  compareUrl,
  resolveBranchName,
  isValidSlug,
  planRootResolution,
} from '../tools/lib/compendium-git.js';

const MANAGED_DIR = path.join(os.homedir(), '.grimoire', 'compendium');
const COMMIT_IDENTITY = ['-c', 'user.name=LoreWeaver (Grimoire)', '-c', 'user.email=loreweaver@grimoire.local'];

class PublishError extends Error {}

function parseArgs(argv) {
  const args = {
    slug: null,
    root: null,
    from: null,
    base: 'main',
    remote: 'origin',
    branchPrefix: 'compendium/',
    message: null,
    auto: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') args.root = argv[++i];
    else if (arg === '--from') args.from = argv[++i];
    else if (arg === '--base') args.base = argv[++i];
    else if (arg === '--remote') args.remote = argv[++i];
    else if (arg === '--branch-prefix') args.branchPrefix = argv[++i];
    else if (arg === '-m' || arg === '--message') args.message = argv[++i];
    else if (arg === '--auto') args.auto = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('-')) throw new PublishError(`Unknown flag: ${arg}`);
    else if (args.slug === null) args.slug = arg;
    else throw new PublishError(`Unexpected argument: ${arg} (one slug per invocation)`);
  }
  return args;
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

/** Walk up from cwd to find grimoire.config.json, mirroring bin/grimoire.js resolveBase(). */
function readConfig() {
  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, 'grimoire.config.json');
    if (fs.existsSync(candidate)) return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fall back to the installed package's own config (global npm install, run from anywhere).
  const packaged = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'grimoire.config.json');
  if (fs.existsSync(packaged)) return JSON.parse(fs.readFileSync(packaged, 'utf8'));
  return {};
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}

async function confirmInteractively(promptText) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(promptText)).trim().toLowerCase();
  rl.close();
  return answer === 'y' || answer === 'yes';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = (line) => process.stdout.write(`  ${line}\n`);

  const steps = [
    { name: '1. resolve', state: 'not started' },
    { name: '2. prepare clone', state: 'not started' },
    { name: '3. import artifacts', state: 'not started' },
    { name: '4. secret scan', state: 'not started' },
    { name: '5. confirm', state: 'not started' },
    { name: '6. branch + commit', state: 'not started' },
    { name: '7. push', state: 'not started' },
    { name: '8. report', state: 'not started' },
  ];
  let step = 0;
  let branch = null;
  let cloneDir = null;

  try {
    // ---- 1. resolve --------------------------------------------------------------------------
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
    if (!fs.existsSync(slugInClone)) {
      // LoreWeaver may have written to a local staging root (e.g. ./compendium) on a machine where
      // the clone didn't exist yet. Import it.
      const stagingRoot = args.from ?? path.resolve('compendium');
      const stagingSlug = path.join(stagingRoot, args.slug);
      if (!fs.existsSync(stagingSlug)) {
        throw new PublishError(
          `No artifacts found: neither ${slugInClone} nor ${stagingSlug} exists. ` +
            'Run the interview first, or pass --from <staging-root>.'
        );
      }
      log(`import    ${stagingSlug} → ${slugInClone}`);
      if (!args.dryRun) fs.cpSync(stagingSlug, slugInClone, { recursive: true });
    }
    const effectiveSlugDir = fs.existsSync(slugInClone) ? slugInClone : path.join(args.from ?? path.resolve('compendium'), args.slug);
    if (!fs.existsSync(path.join(effectiveSlugDir, 'transcript.md'))) {
      throw new PublishError(`${args.slug}/transcript.md is missing — a capture without a transcript is not publishable.`);
    }
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

    const files = listFiles(effectiveSlugDir).map((relative) => path.join(args.slug, relative));
    steps[step].state = `ok — ${files.length} file(s)`;

    // ---- 4. secret scan ----------------------------------------------------------------------
    step = 3;
    const findings = scanForSecrets(
      listFiles(effectiveSlugDir).map((relative) => ({
        path: path.join(args.slug, relative),
        content: fs.readFileSync(path.join(effectiveSlugDir, relative), 'utf8'),
      }))
    );
    if (findings.length > 0) {
      const lines = findings.map((f) => `    ${f.path}:${f.line} — ${f.kind}`);
      throw new PublishError(
        `Secret scan found ${findings.length} match(es); publish blocked (no override exists):\n${lines.join('\n')}\n` +
          'Remove or link-out the sensitive content, then re-run.'
      );
    }
    steps[step].state = 'ok — no matches';

    // ---- 5. confirm --------------------------------------------------------------------------
    step = 4;
    const repoLabel = parsedRemote
      ? `${parsedRemote.host}/${parsedRemote.owner}/${parsedRemote.repo}`
      : remoteUrl;
    process.stdout.write(
      `\ngrimoire compendium-push${args.dryRun ? ' (dry run)' : ''}\n` +
        `  slug:    ${args.slug}\n` +
        `  repo:    ${repoLabel} (branch off ${args.base}; never pushed to ${args.base} directly)\n` +
        `  files:\n${files.map((f) => `    ${f}`).join('\n')}\n\n`
    );
    if (args.dryRun) {
      steps[step].state = 'skipped — dry run';
      steps[5].state = 'skipped — dry run';
      steps[6].state = 'skipped — dry run';
      steps[7].state = 'skipped — dry run';
      finish(steps, 'DRY RUN — nothing written, nothing pushed');
      return;
    }
    if (args.auto) {
      steps[step].state = 'ok — auto (approval given at interview close)';
    } else if (process.stdin.isTTY) {
      const confirmed = await confirmInteractively('Push this for review? [y/N] ');
      if (!confirmed) throw new PublishError('Aborted by user.');
      steps[step].state = 'ok — confirmed interactively';
    } else {
      throw new PublishError('No TTY for confirmation. Re-run in a terminal, or pass --auto after close approval.');
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
          `  grimoire compendium-push ${parseArgs(process.argv.slice(2)).slug ?? '<slug>'}\n`
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
