#!/usr/bin/env node
/**
 * Grimoire CLI. A thin dispatcher — every subcommand is a standalone script that also runs directly.
 */

import { spawnSync } from 'node:child_process';
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
                      --auto       non-interactive; only after interview-close approval
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

function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(USAGE);
    process.exit(command ? 0 : 1);
  }

  if (command === 'preflight') {
    const base = resolveBase();
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
