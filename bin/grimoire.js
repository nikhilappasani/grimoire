#!/usr/bin/env node
/**
 * Grimoire CLI. A thin dispatcher — every subcommand is a standalone script that also runs directly.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { parseArgs } from '../tools/lib/args.js';
import { PACKAGE_ROOT as ROOT, resolveBase } from '../tools/lib/config.js';

const COMMANDS = {
  sync: 'scripts/sync-skills.js',
  install: 'scripts/install.js',
  'compendium-push': 'scripts/compendium-push.js',
  validate: 'tools/validate-plugin.js',
  lint: 'tools/lint-skills.js',
  'check-knowledge': 'tools/check-knowledge-bundle.js',
};

/**
 * Every flag across every subcommand that consumes the argument after it — needed to tell a flag's
 * value from a positional. The dispatcher deliberately does not know which flags belong to which
 * subcommand: it only decides whether to append a default path, and each script validates its own
 * arguments. An unrecognized flag is therefore passed through untouched, not rejected here.
 */
const VALUE_FLAGS = {
  '--harness': 'harness',
  '--target': 'target',
  '--dest': 'dest',
  '--keep': 'keep',
  '--root': 'root',
  '--from': 'from',
  '--base': 'base',
  '--remote': 'remote',
  '--branch-prefix': 'branchPrefix',
  '-m': 'message',
  '--message': 'message',
  '--reviewed': 'reviewed',
};

function hasPositional(args) {
  return parseArgs(args, { values: VALUE_FLAGS }).positional.length > 0;
}

/** Supply the command's default target when the user gave none. */
function withDefaultPath(command, args) {
  // compendium-push's positional is a slug, not a path — injecting a default root here would turn
  // "slug required" into a baffling error about the repo directory. Its script owns its own errors.
  if (command === 'compendium-push') return args;
  if (hasPositional(args)) return args;
  const base = resolveBase();
  return command === 'lint' ? [...args, path.join(base, 'skills')] : [...args, base];
}

const USAGE = `
grimoire — agent skills that turn tribal knowledge into governed, regenerable capability

Usage: grimoire <command> [options]

Commands:
  sync              Generate per-harness artifacts from skills/*/SKILL.md
                      --dry-run  print actions, write nothing
                      --check    fail if artifacts are out of date (CI gate)
                      --harness  limit to one harness
  install           Install generated artifacts into a harness directory
                      --target   claude-code | codex | copilot | pi  (required)
                      --dest     explicit destination directory
                      --home     install into the harness's user directory
                      --dry-run  print actions, write nothing
  compendium-push   Publish a capability's transcript + documents as a review branch;
                    the compendium repo's CI opens the PR, a human merges
                      <slug>       which capability to publish (required)
                      --review     print the full content and a digest; push nothing
                      --auto       non-interactive; requires --reviewed <digest>
                      --reviewed   the digest the user approved; rechecked before pushing
                      --dry-run    print the plan, push nothing
                      --from       staging root holding <slug>/ if outside the clone
  validate          Structural gate: manifests, skill frontmatter, naming, version lockstep
  lint              Skill-quality gate: description, body length, links, self-containment
  check-knowledge   OKF gate: type vocabulary, confidential-is-link-only, provenance
  preflight         Run test, validate, lint, and check-knowledge in order

Run any command with --json for machine-readable output where supported.
`;

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(ROOT, script), ...args], {
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

/**
 * Run the test suite as the first preflight gate.
 *
 * Tests ship inside the package (`files` includes `tools/`), so this works from a global install.
 * When the directory genuinely is not there, say so loudly rather than passing quietly — a gate
 * that silently does nothing is worse than no gate, because it still reports success.
 */
function runTests(base) {
  const cwd = [base, ROOT].find((dir) => fs.existsSync(path.join(dir, 'tools', '__tests__')));

  if (!cwd) {
    process.stderr.write(
      `preflight: cannot find tools/__tests__ (looked in ${base} and ${ROOT}).\n` +
        'Refusing to report a pass for a gate that did not run.\n'
    );
    return 1;
  }

  // The glob, not the directory: `node --test <dir>` tries to execute the directory as a module on
  // Node 22. Node expands this pattern itself, so it does not depend on a shell.
  const result = spawnSync(process.execPath, ['--test', 'tools/__tests__/*.test.js'], {
    stdio: 'inherit',
    cwd,
  });
  return result.status ?? 1;
}

function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(USAGE);
    process.exit(command ? 0 : 1);
  }

  if (command === 'preflight') {
    const base = resolveBase();
    // Tests first, matching `npm run preflight` exactly. These two must not diverge: whichever one
    // a contributor happens to run is the one they will trust.
    const testStatus = runTests(base);
    if (testStatus !== 0) process.exit(testStatus);

    const sequence = [
      ['tools/validate-plugin.js', [base]],
      ['tools/lint-skills.js', [path.join(base, 'skills')]],
      ['tools/check-knowledge-bundle.js', [base]],
    ];
    for (const [script, scriptArgs] of sequence) {
      const status = run(script, scriptArgs);
      if (status !== 0) process.exit(status);
    }
    process.exit(0);
  }

  const script = COMMANDS[command];
  if (!script) {
    process.stderr.write(`Unknown command "${command}".\n${USAGE}`);
    process.exit(1);
  }

  process.exit(run(script, withDefaultPath(command, args)));
}

main();
