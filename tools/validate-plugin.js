#!/usr/bin/env node
/**
 * Structural gate for a Grimoire repository.
 *
 * Checks the shape a consumer depends on: manifests parse, every skill has the frontmatter the
 * harnesses require, names follow CONVENTIONS.md §2, and content versions are in lockstep.
 *
 * Usage: node tools/validate-plugin.js [root] [--json] [--quiet]
 */

import fs from 'node:fs';
import path from 'node:path';

import { parseFrontmatter } from './lib/frontmatter.js';
import { Report, parseFlags } from './lib/report.js';

const REQUIRED_SKILL_KEYS = ['name', 'description'];
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// npm package names may additionally carry a scope (@owner/name); skill directory names never do.
const PACKAGE_NAME_RE = /^(?:@[a-z0-9-]+\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readJson(file, report, label) {
  if (!fs.existsSync(file)) {
    report.error(label, `Missing ${path.basename(file)}.`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    report.error(label, `Invalid JSON: ${err.message}`);
    return null;
  }
}

/** CONVENTIONS.md §2 is the single source for naming exceptions. Parse it, don't mirror it. */
function readNameExceptions(root, report) {
  const file = path.join(root, 'CONVENTIONS.md');
  if (!fs.existsSync(file)) {
    report.warn('CONVENTIONS.md', 'Not found — cannot resolve skill-name exceptions.');
    return new Set();
  }
  const source = fs.readFileSync(file, 'utf8');
  const section = source.split(/^## /m).find((s) => s.startsWith('2. Skill naming'));
  if (!section) {
    report.warn('CONVENTIONS.md', 'No "## 2. Skill naming" section — cannot resolve exceptions.');
    return new Set();
  }
  const exceptions = new Set();
  for (const line of section.split(/\r?\n/)) {
    const match = line.match(/^\|\s*`([a-z0-9-]+)`\s*\|/);
    if (match) exceptions.add(match[1]);
  }
  return exceptions;
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const root = path.resolve(flags.positional[0] ?? '.');
  const report = new Report('validate-plugin');

  const pkg = readJson(path.join(root, 'package.json'), report, 'package.json');
  if (pkg) {
    if (!pkg.name) report.error('package.json', 'Missing `name`.');
    if (!pkg.version) report.error('package.json', 'Missing `version`.');
    if (pkg.name && !PACKAGE_NAME_RE.test(pkg.name)) {
      report.error('package.json', `Invalid package name "${pkg.name}" — lowercase kebab-case only.`);
    }

    // "Zero runtime dependencies" is a claim the README makes on the front page, so it is checked
    // rather than trusted. A stray `npm install <something>` adds a dependency block that nobody
    // reads again, and the package ships carrying it.
    const runtimeDeps = Object.keys(pkg.dependencies ?? {});
    if (runtimeDeps.length > 0) {
      report.error(
        'package.json',
        `Runtime dependencies present: ${runtimeDeps.join(', ')}. Grimoire ships with none — ` +
          'the README says so on the front page. Remove them, or change the claim.'
      );
    }
    if (pkg.dependencies?.[pkg.name] || pkg.devDependencies?.[pkg.name]) {
      report.error('package.json', `The package depends on itself (${pkg.name}). Almost certainly a stray install.`);
    }
  }

  const config = readJson(path.join(root, 'grimoire.config.json'), report, 'grimoire.config.json');
  if (config) {
    for (const key of ['contentVersion', 'specVersion', 'roots', 'harnesses']) {
      if (config[key] === undefined) report.error('grimoire.config.json', `Missing \`${key}\`.`);
    }
    for (const key of ['specs', 'knowledge', 'compendium']) {
      if (!config.roots?.[key]) report.error('grimoire.config.json', `Missing \`roots.${key}\`.`);
    }
    if (!Array.isArray(config.harnesses) || config.harnesses.length === 0) {
      report.error('grimoire.config.json', '`harnesses` must be a non-empty array.');
    }
  }

  const skillsDir = path.join(root, 'skills');
  if (!fs.existsSync(skillsDir)) {
    report.error('skills/', 'Missing skills directory.');
    finish(report, flags);
    return;
  }

  const exceptions = readNameExceptions(root, report);
  const skillDirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (skillDirs.length === 0) report.error('skills/', 'No skills found.');

  for (const dirName of skillDirs) {
    const skillFile = path.join(skillsDir, dirName, 'SKILL.md');
    const label = path.relative(root, skillFile);

    if (!fs.existsSync(skillFile)) {
      report.error(label, 'Skill directory has no SKILL.md.');
      continue;
    }

    const source = fs.readFileSync(skillFile, 'utf8');
    const parsed = parseFrontmatter(source);

    if (!parsed.found) {
      report.error(label, 'No frontmatter block.');
      continue;
    }
    for (const err of parsed.errors) report.error(label, err.message, err.line);
    for (const warning of parsed.warnings) report.warn(label, warning.message, warning.line);

    for (const key of REQUIRED_SKILL_KEYS) {
      if (!parsed.data[key]) report.error(label, `Missing required frontmatter \`${key}\`.`);
    }

    if (parsed.data.name && parsed.data.name !== dirName) {
      report.error(label, `Frontmatter name "${parsed.data.name}" does not match directory "${dirName}".`);
    }

    if (!NAME_RE.test(dirName)) {
      report.error(label, `Invalid skill name "${dirName}" — lowercase kebab-case only.`);
    } else if (dirName.split('-').length !== 2 && !exceptions.has(dirName)) {
      report.error(
        label,
        `Skill name "${dirName}" is not a two-word verb-noun pair and is not a documented exception in CONVENTIONS.md §2.`
      );
    }

    // Content lockstep: a skill claiming a version other than the bundle's will drift silently.
    if (config?.contentVersion && parsed.data.content_version) {
      if (parsed.data.content_version !== config.contentVersion) {
        report.error(
          label,
          `content_version "${parsed.data.content_version}" != grimoire.config.json contentVersion "${config.contentVersion}".`
        );
      }
    }
  }

  finish(report, flags);
}

function finish(report, flags) {
  report.print({ json: flags.json, quiet: flags.quiet });
  process.exit(report.failed ? 1 : 0);
}

main();
