#!/usr/bin/env node
/**
 * Deeper SKILL.md linter — the quality rules CONVENTIONS.md §3 states.
 *
 * validate-plugin.js answers "is this structurally a plugin?". This answers "is this skill written
 * the way a skill has to be written to actually get selected and followed?".
 *
 * Usage: node tools/lint-skills.js [skillsDir|skillDir] [--json] [--quiet]
 */

import fs from 'node:fs';
import path from 'node:path';

import { parseFrontmatter } from './lib/frontmatter.js';
import { findBrokenLinks, extractRelativeLinks } from './lib/links.js';
import { Report, parseFlags } from './lib/report.js';

const ALLOWED_KEYS = new Set([
  'name',
  'description',
  'content_version',
  'disable-model-invocation',
]);

const MAX_DESCRIPTION = 1024;
const MAX_BODY_LINES = 100;

// A hedge in a skill body is a rule the agent will skip. CONVENTIONS.md §3.
const HEDGES = ['should', 'might', 'could', 'consider', 'generally', 'typically', 'try to'];
const HEDGE_RE = new RegExp(`\\b(${HEDGES.join('|')})\\b`, 'gi');

function collectSkillDirs(target) {
  if (fs.existsSync(path.join(target, 'SKILL.md'))) return [target];
  if (!fs.existsSync(target)) return [];
  return fs
    .readdirSync(target, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(target, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'SKILL.md')))
    .sort();
}

/**
 * A skill is copied verbatim into every harness target. A link that escapes the skill directory
 * resolves in the source tree and breaks in every generated artifact — which no source-tree link
 * check would ever catch. Self-containment is the invariant that makes sync safe.
 */
function checkSelfContained(filePath, source, report, root, skillDir) {
  const baseDir = path.dirname(path.resolve(filePath));
  const skillRoot = path.resolve(skillDir);
  const label = path.relative(root, filePath);

  for (const { target, line } of extractRelativeLinks(source)) {
    const resolved = path.resolve(baseDir, target.split('#')[0]);
    if (resolved === skillRoot) continue;
    if (!resolved.startsWith(`${skillRoot}${path.sep}`)) {
      report.error(
        label,
        `Link escapes the skill directory: ${target}. A skill must be self-contained — it is copied into every harness target (CONVENTIONS.md §6).`,
        line
      );
    }
  }
}

function lintSkill(skillDir, report, root) {
  const skillFile = path.join(skillDir, 'SKILL.md');
  const label = path.relative(root, skillFile) || 'SKILL.md';
  const source = fs.readFileSync(skillFile, 'utf8');
  const parsed = parseFrontmatter(source);

  if (!parsed.found) {
    report.error(label, 'No frontmatter block.');
    return;
  }

  for (const err of parsed.errors) report.error(label, err.message, err.line);
  for (const warning of parsed.warnings) report.warn(label, warning.message, warning.line);

  for (const key of Object.keys(parsed.data)) {
    if (!ALLOWED_KEYS.has(key)) {
      report.error(label, `Frontmatter key \`${key}\` is not in the allow-list (CONVENTIONS.md §3).`);
    }
  }

  const description = typeof parsed.data.description === 'string' ? parsed.data.description : '';
  if (description === '') {
    report.error(label, 'Missing `description` — it is the only field an agent sees when selecting.');
  } else {
    if (description.length > MAX_DESCRIPTION) {
      report.error(label, `Description is ${description.length} chars — max ${MAX_DESCRIPTION}.`);
    }
    if (!/use when/i.test(description)) {
      report.error(label, 'Description has no "Use when …" trigger clause.');
    }
    if (/^\s*\d\.|\n\s*\d\./.test(description)) {
      report.warn(label, 'Description looks like it contains numbered workflow steps — move them to the body.');
    }
    if (/\bI \b|\bwe\b/i.test(description)) {
      report.warn(label, 'Description should be third person.');
    }
  }

  const lines = source.split(/\r?\n/);
  const bodyLines = lines.slice(parsed.bodyStartLine - 1);

  let lastContent = bodyLines.length;
  while (lastContent > 0 && bodyLines[lastContent - 1].trim() === '') lastContent--;
  const bodyLineCount = lastContent;

  if (bodyLineCount > MAX_BODY_LINES) {
    report.error(
      label,
      `Body is ${bodyLineCount} lines — max ${MAX_BODY_LINES}. Move detail into references/ (CONVENTIONS.md §3).`
    );
  }

  // Hedges only matter in instructional prose, not inside quoted example questions or tables.
  bodyLines.forEach((line, index) => {
    if (line.trim().startsWith('|')) return;
    if (line.trim().startsWith('>')) return;
    if (/^\s*(-|\d+\.)?\s*"/.test(line)) return;
    HEDGE_RE.lastIndex = 0;
    const hedge = HEDGE_RE.exec(line);
    if (hedge) {
      report.warn(
        label,
        `Hedging term "${hedge[1]}" — skill bodies use MUST / NEVER / ALWAYS.`,
        parsed.bodyStartLine + index
      );
    }
  });

  const referencesDir = path.join(skillDir, 'references');
  if (fs.existsSync(referencesDir)) {
    const refs = fs
      .readdirSync(referencesDir)
      .filter((f) => f.endsWith('.md'))
      .sort();
    if (refs.length === 0) {
      report.warn(path.relative(root, referencesDir), 'references/ exists but contains no markdown.');
    }
    for (const ref of refs) {
      const refPath = path.join(referencesDir, ref);
      const refLabel = path.relative(root, refPath);
      if (!source.includes(`references/${ref}`)) {
        report.warn(refLabel, `Not linked from SKILL.md — it will never be loaded.`);
      }
      const refSource = fs.readFileSync(refPath, 'utf8');
      for (const broken of findBrokenLinks(refPath, refSource)) {
        report.error(refLabel, `Broken relative link (${broken.reason}): ${broken.target}`, broken.line);
      }
      checkSelfContained(refPath, refSource, report, root, skillDir);
    }
  }

  for (const broken of findBrokenLinks(skillFile, source)) {
    report.error(label, `Broken relative link (${broken.reason}): ${broken.target}`, broken.line);
  }
  checkSelfContained(skillFile, source, report, root, skillDir);
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const target = path.resolve(flags.positional[0] ?? 'skills');
  const root = process.cwd();
  const report = new Report('lint-skills');

  const skillDirs = collectSkillDirs(target);
  if (skillDirs.length === 0) {
    report.error(path.relative(root, target) || target, 'No skills found.');
  }
  for (const dir of skillDirs) lintSkill(dir, report, root);

  report.print({ json: flags.json, quiet: flags.quiet });
  process.exit(report.failed ? 1 : 0);
}

main();
