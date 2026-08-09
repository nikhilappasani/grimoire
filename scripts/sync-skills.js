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

const HARNESS_TARGETS = {
  'claude-code': { dir: '.claude/skills', prompts: false },
  codex: { dir: '.codex/skills', prompts: false },
  copilot: { dir: '.copilot/skills', prompts: false },
  pi: { dir: '.pi/skills', prompts: true },
};

const BANNER = (skillName) =>
  `<!-- GENERATED FILE — DO NOT EDIT. Source: skills/${skillName}/SKILL.md. Regenerate with \`grimoire sync\`. -->`;

function parseArgs(argv) {
  const args = { dryRun: false, check: false, harness: null, root: '.' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--check') args.check = true;
    else if (arg === '--harness') args.harness = argv[++i];
    else positional.push(arg);
  }
  if (positional[0]) args.root = positional[0];
  return args;
}

/** Split a markdown file into its frontmatter block and the rest. */
function splitFrontmatter(source) {
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return { frontmatter: null, body: source };
  const close = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (close === -1) return { frontmatter: null, body: source };
  return {
    frontmatter: lines.slice(1, close),
    body: lines.slice(close + 1).join('\n'),
  };
}

/**
 * Emit the portable intersection of frontmatter every target understands, with the description
 * quoted and escaped. Harness-specific keys are dropped rather than passed through as unknowns.
 */
function renderFrontmatter(frontmatterLines, skillName) {
  const keep = ['name', 'description', 'model'];
  const values = {};
  let currentKey = null;

  for (const line of frontmatterLines) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):[ \t]*(.*)$/);
    if (match) {
      currentKey = match[1];
      values[currentKey] = match[2].trim();
    } else if (currentKey && line.trim() !== '') {
      values[currentKey] = `${values[currentKey]} ${line.trim()}`.trim();
    }
  }

  const out = ['---'];
  for (const key of keep) {
    if (values[key] === undefined) continue;
    const raw = values[key].replace(/^["']|["']$/g, '');
    out.push(key === 'description' ? `${key}: "${raw.replace(/"/g, '\\"')}"` : `${key}: ${raw}`);
  }
  out.push('---');
  out.push('');
  out.push(BANNER(skillName));
  return out.join('\n');
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root);

  const configPath = path.join(root, 'grimoire.config.json');
  if (!fs.existsSync(configPath)) {
    process.stderr.write(`grimoire.config.json not found at ${root}\n`);
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const harnesses = (args.harness ? [args.harness] : config.harnesses).slice().sort();
  for (const harness of harnesses) {
    if (!HARNESS_TARGETS[harness]) {
      process.stderr.write(
        `Unknown harness "${harness}". Known: ${Object.keys(HARNESS_TARGETS).sort().join(', ')}\n`
      );
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
    const target = HARNESS_TARGETS[harness];

    for (const skillName of skillNames) {
      const sourceDir = path.join(skillsDir, skillName);
      const destDir = path.join(root, target.dir, skillName);

      for (const relative of collectFiles(sourceDir)) {
        const sourcePath = path.join(sourceDir, relative);
        const destPath = path.join(destDir, relative);
        const source = fs.readFileSync(sourcePath, 'utf8');

        let contents = source;
        if (relative === 'SKILL.md') {
          const { frontmatter, body } = splitFrontmatter(source);
          if (frontmatter === null) {
            process.stderr.write(`${sourcePath}: no frontmatter — cannot sync.\n`);
            process.exit(1);
          }
          contents = `${renderFrontmatter(frontmatter, skillName)}\n${body}`;
        }

        planned.push({ destPath, contents });
      }

      if (target.prompts) {
        const skillSource = fs.readFileSync(path.join(sourceDir, 'SKILL.md'), 'utf8');
        const { frontmatter, body } = splitFrontmatter(skillSource);
        planned.push({
          destPath: path.join(root, '.pi', 'prompts', `${skillName}.md`),
          contents: `${renderFrontmatter(frontmatter, skillName)}\n${body}`,
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
