#!/usr/bin/env node
/**
 * Generate per-harness artifacts from the SKILL.md sources.
 *
 * `skills/<name>/` is the only source of truth. Everything this script writes is disposable and
 * regenerable, and is gitignored for exactly that reason.
 *
 * Usage:
 *   node scripts/sync-skills.js [--dry-run] [--check] [--harness <name>] [root]
 *
 *   --dry-run   print every action, write nothing
 *   --check     fail if any artifact differs from what would be generated (CI drift gate)
 *   --harness   limit to one harness instead of every harness in grimoire.config.json
 */

import fs from 'node:fs';
import path from 'node:path';

import { parseArgs, argsError } from '../tools/lib/args.js';
import { collectFiles } from '../tools/lib/fs-walk.js';
import { parseFrontmatter } from '../tools/lib/frontmatter.js';
import { HARNESSES, harnessNames, isKnownHarness } from '../tools/lib/harnesses.js';

const BANNER = (skillName) =>
  `<!-- GENERATED FILE — DO NOT EDIT. Source: skills/${skillName}/SKILL.md. Regenerate with \`grimoire sync\`. -->`;

const ARG_SPEC = {
  booleans: { '--dry-run': 'dryRun', '--check': 'check' },
  values: { '--harness': 'harness' },
  defaults: { dryRun: false, check: false, harness: null },
};

/**
 * Parse a SKILL.md into the frontmatter values sync cares about plus its body text.
 *
 * Uses the shared parser rather than a local one on purpose. `frontmatter.js` is the single
 * implementation the validators run, so parsing here with anything else means `grimoire lint` and
 * `grimoire sync` can disagree about what a file says — and the generated artifact, not the source
 * the validator read, is what a harness actually loads.
 *
 * @returns {{data: Record<string, string|string[]>, body: string} | {error: string}}
 */
function readSkill(source) {
  const parsed = parseFrontmatter(source);
  if (!parsed.found) {
    return { error: parsed.errors[0]?.message ?? 'no frontmatter — cannot sync.' };
  }
  if (parsed.errors.length > 0) {
    return { error: `line ${parsed.errors[0].line}: ${parsed.errors[0].message}` };
  }
  const lines = source.split(/\r?\n/);
  return { data: parsed.data, body: lines.slice(parsed.bodyStartLine - 1).join('\n') };
}

/**
 * Emit the portable intersection of frontmatter every target understands, with the description
 * quoted and escaped. Harness-specific keys are dropped rather than passed through as unknowns.
 */
function renderFrontmatter(data, skillName) {
  const keep = ['name', 'description', 'model'];
  const out = ['---'];
  for (const key of keep) {
    const value = data[key];
    if (value === undefined) continue;
    const raw = String(value);
    out.push(key === 'description' ? `${key}: "${raw.replace(/"/g, '\\"')}"` : `${key}: ${raw}`);
  }
  out.push('---');
  out.push('');
  out.push(BANNER(skillName));
  return out.join('\n');
}

function main() {
  const parsedArgs = parseArgs(process.argv.slice(2), ARG_SPEC);
  const problem = argsError(parsedArgs);
  if (problem) {
    process.stderr.write(`${problem}\n`);
    process.exit(1);
  }
  const args = parsedArgs.flags;
  const root = path.resolve(parsedArgs.positional[0] ?? '.');

  const configPath = path.join(root, 'grimoire.config.json');
  if (!fs.existsSync(configPath)) {
    process.stderr.write(`grimoire.config.json not found at ${root}\n`);
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const harnesses = (args.harness ? [args.harness] : config.harnesses).slice().sort();
  for (const harness of harnesses) {
    if (!isKnownHarness(harness)) {
      process.stderr.write(`Unknown harness "${harness}". Known: ${harnessNames().join(', ')}\n`);
      process.exit(1);
    }
  }

  const skillsDir = path.join(root, 'skills');
  const skillNames = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, 'SKILL.md')))
    .map((e) => e.name)
    .sort();

  const planned = [];
  const drift = [];

  for (const harness of harnesses) {
    const target = HARNESSES[harness];

    for (const skillName of skillNames) {
      const sourceDir = path.join(skillsDir, skillName);
      const destDir = path.join(root, target.dir, skillName);

      for (const relative of collectFiles(sourceDir)) {
        const sourcePath = path.join(sourceDir, relative);
        const destPath = path.join(destDir, relative);
        const source = fs.readFileSync(sourcePath, 'utf8');

        let contents = source;
        if (relative === 'SKILL.md') {
          const skill = readSkill(source);
          if (skill.error) {
            process.stderr.write(`${sourcePath}: ${skill.error}\n`);
            process.exit(1);
          }
          contents = `${renderFrontmatter(skill.data, skillName)}\n${skill.body}`;
        }

        planned.push({ destPath, contents });
      }

      if (target.prompts) {
        const skillPath = path.join(sourceDir, 'SKILL.md');
        const skill = readSkill(fs.readFileSync(skillPath, 'utf8'));
        if (skill.error) {
          process.stderr.write(`${skillPath}: ${skill.error}\n`);
          process.exit(1);
        }
        planned.push({
          destPath: path.join(root, '.pi', 'prompts', `${skillName}.md`),
          contents: `${renderFrontmatter(skill.data, skillName)}\n${skill.body}`,
        });
      }
    }

    if (target.prompts) {
      planned.push({
        destPath: path.join(root, '.pi', 'package.json'),
        contents: `${JSON.stringify(
          {
            name: config.name ?? 'grimoire',
            version: config.contentVersion,
            keywords: ['pi-package'],
            pi: { skills: ['./skills'], prompts: ['./prompts'] },
          },
          null,
          2
        )}\n`,
      });
    }
  }

  for (const { destPath, contents } of planned) {
    const label = path.relative(root, destPath);
    const existing = fs.existsSync(destPath) ? fs.readFileSync(destPath, 'utf8') : null;

    if (args.check) {
      if (existing !== contents) drift.push(label);
      continue;
    }

    if (args.dryRun) {
      const verb = existing === null ? 'create' : existing === contents ? 'unchanged' : 'update';
      process.stdout.write(`  ${verb.padEnd(9)} ${label}\n`);
      continue;
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, contents);
  }

  if (args.check) {
    if (drift.length > 0) {
      process.stdout.write('Generated artifacts are out of date. Run `grimoire sync`:\n');
      for (const label of drift) process.stdout.write(`  ${label}\n`);
      process.exit(1);
    }
    process.stdout.write(`sync-skills: PASS — ${planned.length} artifact(s) up to date.\n`);
    return;
  }

  const verb = args.dryRun ? 'would write' : 'wrote';
  process.stdout.write(
    `\nsync-skills: ${verb} ${planned.length} artifact(s) for ${skillNames.length} skill(s) across ${harnesses.length} harness(es): ${harnesses.join(', ')}\n`
  );
}

main();
