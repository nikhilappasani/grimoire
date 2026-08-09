#!/usr/bin/env node
/**
 * Deterministic OKF gate.
 *
 * The governance rules in KNOWLEDGE-CAPTURE-OKF.md §7 are only real if code enforces them. In
 * particular "confidential is link-only" is an ERROR here, never a warning — a prose rule that fails
 * open is not a rule.
 *
 * Also verifies the `type` vocabulary in tools/lib/okf.js still matches the reference document, so
 * the M-1 single-source guarantee cannot silently rot.
 *
 * Usage: node tools/check-knowledge-bundle.js [root] [--json] [--quiet]
 */

import fs from 'node:fs';
import path from 'node:path';

import { parseFrontmatter } from './lib/frontmatter.js';
import { findBrokenLinks } from './lib/links.js';
import { validateConcept, verifyVocabularyAgainstDoc, checkPlacement } from './lib/okf.js';
import { Report, parseFlags } from './lib/report.js';

const OKF_DOC_RELATIVE = path.join(
  'skills',
  'loreweaver',
  'references',
  'KNOWLEDGE-CAPTURE-OKF.md'
);

// Dot-directories are generated harness artifacts and sandboxes — the source bundle is the only
// one worth gating. `backup/` holds imported reference material that is not ours to validate.
const SKIP_DIRS = new Set(['node_modules', 'backup', '__tests__']);
const isSkipped = (name) => SKIP_DIRS.has(name) || name.startsWith('.');
const NON_CONCEPT_FILES = new Set(['index.md', 'log.md', 'README.md']);

function findKnowledgeDirs(root) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (isSkipped(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === 'knowledge') {
        found.push(full);
        continue;
      }
      walk(full);
    }
  };
  walk(root);
  return found.sort();
}

function collectConcepts(knowledgeDir) {
  const concepts = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md') && !NON_CONCEPT_FILES.has(entry.name)) concepts.push(full);
    }
  };
  walk(knowledgeDir);
  return concepts;
}

function resolveKnowledgeRoots(root, report) {
  const envRoot = process.env.GRIMOIRE_KNOWLEDGE_ROOT;
  if (envRoot) {
    const resolved = path.resolve(envRoot);
    if (!fs.existsSync(resolved)) {
      // Fail closed. Writing or validating knowledge in an unexpected directory is worse than stopping.
      report.error('GRIMOIRE_KNOWLEDGE_ROOT', `Configured knowledge root does not exist: ${resolved}`);
      return [];
    }
    return [resolved];
  }
  return findKnowledgeDirs(root);
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const root = path.resolve(flags.positional[0] ?? '.');
  const report = new Report('check-knowledge-bundle');

  const docPath = path.join(root, OKF_DOC_RELATIVE);
  if (!fs.existsSync(docPath)) {
    report.error(OKF_DOC_RELATIVE, 'Reference document not found — cannot verify the type vocabulary.');
  } else {
    const check = verifyVocabularyAgainstDoc(fs.readFileSync(docPath, 'utf8'));
    if (!check.ok) report.error(OKF_DOC_RELATIVE, check.message);
  }

  const knowledgeDirs = resolveKnowledgeRoots(root, report);

  if (knowledgeDirs.length === 0 && !report.failed) {
    report.notice('knowledge/', 'No knowledge bundle found yet — nothing to check.');
  }

  for (const dir of knowledgeDirs) {
    const concepts = collectConcepts(dir);
    if (concepts.length === 0) {
      report.notice(path.relative(root, dir) || dir, 'Bundle contains no concept files.');
      continue;
    }

    for (const conceptPath of concepts) {
      const label = path.relative(root, conceptPath);
      const source = fs.readFileSync(conceptPath, 'utf8');
      const parsed = parseFrontmatter(source);

      if (!parsed.found) {
        report.error(label, 'Concept file has no frontmatter block.');
        continue;
      }
      for (const err of parsed.errors) report.error(label, err.message, err.line);
      for (const warning of parsed.warnings) report.warn(label, warning.message, warning.line);

      const body = source.split(/\r?\n/).slice(parsed.bodyStartLine - 1).join('\n');
      const { errors, warnings, notices } = validateConcept({ data: parsed.data, body });

      for (const message of errors) report.error(label, message);
      for (const message of warnings) report.warn(label, message);
      for (const message of notices) report.notice(label, message);

      const misplaced = checkPlacement(path.relative(dir, conceptPath), String(parsed.data.type ?? '').trim());
      if (misplaced) report.error(label, misplaced);

      for (const broken of findBrokenLinks(conceptPath, source)) {
        report.error(label, `Broken relative link (${broken.reason}): ${broken.target}`, broken.line);
      }
    }
  }

  report.print({ json: flags.json, quiet: flags.quiet });
  process.exit(report.failed ? 1 : 0);
}

main();
