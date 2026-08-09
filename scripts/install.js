#!/usr/bin/env node
/**
 * Install generated skill artifacts into a harness directory.
 *
 * SAFETY: sandboxed by default. Without an explicit `--dest` or `--home`, this writes only inside
 * `.grimoire-sandbox/` in the repository. The `--target` value is checked against an allow-list, so
 * it can never be used to escape that sandbox as a path segment.
 *
 * Usage:
 *   node scripts/install.js --target <harness> [--dest <dir> | --home] [--dry-run] [--keep N] [root]
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HARNESS_HOMES = {
  'claude-code': path.join('.claude', 'skills'),
  codex: path.join('.codex', 'skills'),
  copilot: path.join('.copilot', 'skills'),
  pi: path.join('.pi', 'skills'),
};

const SOURCE_DIRS = {
  'claude-code': '.claude/skills',
  codex: '.codex/skills',
  copilot: '.copilot/skills',
  pi: '.pi/skills',
};

const SANDBOX = '.grimoire-sandbox';

class InstallError extends Error {}

function parseArgs(argv) {
  const args = { target: null, dest: null, home: false, dryRun: false, keep: 3, root: '.' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--target') args.target = argv[++i];
    else if (arg === '--dest') args.dest = argv[++i];
    else if (arg === '--home') args.home = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--keep') args.keep = Number.parseInt(argv[++i], 10);
    else positional.push(arg);
  }
  if (positional[0]) args.root = positional[0];
  return args;
}

/**
 * `--target` becomes a path segment. An allow-list is the only sanitisation that cannot be defeated
 * by creative encoding, so it is the one used — never a `..` blacklist.
 */
function assertKnownTarget(target) {
  if (!target) {
    throw new InstallError(
      `--target is required. Known targets: ${Object.keys(HARNESS_HOMES).sort().join(', ')}`
    );
  }
  if (!Object.prototype.hasOwnProperty.call(HARNESS_HOMES, target)) {
    throw new InstallError(
      `Unknown --target "${target}". Known targets: ${Object.keys(HARNESS_HOMES).sort().join(', ')}`
    );
  }
}

function resolveDestination(args, root) {
  if (args.dest && args.home) {
    throw new InstallError('Pass either --dest or --home, not both.');
  }
  if (args.dest) return { dir: path.resolve(args.dest), kind: 'explicit' };
  if (args.home) return { dir: path.join(os.homedir(), HARNESS_HOMES[args.target]), kind: 'home' };
  return { dir: path.join(root, SANDBOX, args.target, 'skills'), kind: 'sandbox' };
}

function collectFiles(dir, base = dir) {
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

/** Rotate previous installs so a bad install is recoverable. Oldest beyond `keep` are removed. */
function backupAndRotate(destDir, keep, dryRun, log) {
  if (!fs.existsSync(destDir)) return;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `${destDir}.backup-${stamp}`;
  log(`backup    ${backupDir}`);
  if (!dryRun) fs.cpSync(destDir, backupDir, { recursive: true });

  const parent = path.dirname(destDir);
  const prefix = `${path.basename(destDir)}.backup-`;
  const backups = fs
    .readdirSync(parent)
    .filter((name) => name.startsWith(prefix))
    .sort();

  for (const stale of backups.slice(0, Math.max(0, backups.length - keep))) {
    const stalePath = path.join(parent, stale);
    log(`prune     ${stalePath}`);
    if (!dryRun) fs.rmSync(stalePath, { recursive: true, force: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root);
  const log = (line) => process.stdout.write(`  ${line}\n`);

  // Each step records its own outcome. A mid-run failure must never leave the user guessing which
  // targets were touched — the original installer's worst failure mode.
  const steps = [
    { name: '1. preflight', state: 'not started' },
    { name: '2. backup', state: 'not started' },
    { name: '3. copy artifacts', state: 'not started' },
  ];

  let step = 0;
  try {
    assertKnownTarget(args.target);
    if (!Number.isInteger(args.keep) || args.keep < 0) {
      throw new InstallError('--keep must be a non-negative integer.');
    }

    const sourceDir = path.join(root, SOURCE_DIRS[args.target]);
    if (!fs.existsSync(sourceDir)) {
      throw new InstallError(
        `No generated artifacts at ${path.relative(root, sourceDir)}. Run \`grimoire sync\` first.`
      );
    }
    const files = collectFiles(sourceDir);
    if (files.length === 0) {
      throw new InstallError(`No files to install under ${path.relative(root, sourceDir)}.`);
    }

    const destination = resolveDestination(args, root);
    steps[step].state = `ok — ${files.length} file(s) from ${path.relative(root, sourceDir)}`;

    process.stdout.write(
      `\ngrimoire install${args.dryRun ? ' (dry run)' : ''}\n` +
        `  target: ${args.target}\n` +
        `  dest:   ${destination.dir} [${destination.kind}]\n\n`
    );
    if (destination.kind === 'sandbox') {
      process.stdout.write('  Sandbox install. Pass --home to install for real, or --dest <dir>.\n\n');
    }

    step = 1;
    backupAndRotate(destination.dir, args.keep, args.dryRun, log);
    steps[step].state = 'ok';

    step = 2;
    for (const relative of files) {
      const from = path.join(sourceDir, relative);
      const to = path.join(destination.dir, relative);
      log(`${fs.existsSync(to) ? 'update   ' : 'create   '} ${to}`);
      if (!args.dryRun) {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
      }
    }
    steps[step].state = `ok — ${files.length} file(s)`;

    process.stdout.write(
      `\ngrimoire install: ${args.dryRun ? 'DRY RUN — nothing written' : 'DONE'}\n`
    );
    for (const s of steps) process.stdout.write(`  ${s.name}: ${s.state}\n`);
  } catch (err) {
    if (steps[step].state === 'not started') steps[step].state = `FAILED — ${err.message}`;
    for (let i = step + 1; i < steps.length; i++) steps[i].state = 'skipped';

    process.stderr.write(`\ngrimoire install: FAILED\n`);
    for (const s of steps) process.stderr.write(`  ${s.name}: ${s.state}\n`);
    if (!(err instanceof InstallError)) process.stderr.write(`\n${err.stack}\n`);
    process.exit(1);
  }
}

main();
