#!/usr/bin/env node
/**
 * Deterministic OKF gate.
 *
 * The governance rules in KNOWLEDGE-CAPTURE-OKF.md §7 are only real if code enforces them. In
 * particular "confidential is link-only" is an ERROR here, never a warning — a prose rule that fails
 * open is not a rule.
 *
 * Also verifies the `type` vocabulary in tools/lib/okf.js still matches the reference document, so
 * the single-source guarantee cannot silently rot.
 *
 * Usage: node tools/check-knowledge-bundle.js [root] [--json] [--quiet]
 */

import fs from 'node:fs';
import path from 'node:path';

import { parseFrontmatter } from './lib/frontmatter.js';
import { findBrokenLinks } from './lib/links.js';
import { validateConcept, verifyVocabularyAgainstDoc, checkPlacement, CATEGORIES } from './lib/okf.js';
import { validateCaptureHeader } from './lib/capture.js';
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

/**
 * The active category vocabulary: the shipped default unless grimoire.config.json replaces it.
 * Read here rather than in okf.js so the pure library stays filesystem-free.
 */
function resolveCategories(root) {
  const configPath = path.join(root, 'grimoire.config.json');
  if (!fs.existsSync(configPath)) return CATEGORIES;
  try {
    const configured = JSON.parse(fs.readFileSync(configPath, 'utf8')).categories;
    return Array.isArray(configured) && configured.length > 0 ? configured : CATEGORIES;
  } catch {
    return CATEGORIES; // a broken config is validate-plugin.js's error to report, not ours
  }
}

/**
 * Validate every `<slug>/transcript.md` capture header found beneath the root.
 *
 * Captures live next to their knowledge bundles, so the same walk that finds one finds the other:
 * a bundle at `<x>/knowledge` implies a capture at `<x>/transcript.md`.
 */
function checkCaptureHeaders(root, knowledgeDirs, categories, report) {
  for (const knowledgeDir of knowledgeDirs) {
    const slugDir = path.dirname(knowledgeDir);
    const transcript = path.join(slugDir, 'transcript.md');
    if (!fs.existsSync(transcript)) continue; // a bare knowledge root is not a capture

    const label = path.relative(root, transcript) || transcript;
    const parsed = parseFrontmatter(fs.readFileSync(transcript, 'utf8'));

    if (!parsed.found) {
      report.error(label, 'Capture has no header — nothing records who was interviewed, when, or against which versions.');
      continue;
    }
    for (const err of parsed.errors) report.error(label, err.message, err.line);

    const { errors, warnings } = validateCaptureHeader(parsed.data, {
      slug: path.basename(slugDir),
      categories,
    });
    for (const message of errors) report.error(label, message);
    for (const message of warnings) report.warn(label, message);
  }
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const root = path.resolve(flags.positional[0] ?? '.');
  const report = new Report('check-knowledge-bundle');
  const categories = resolveCategories(root);

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

  checkCaptureHeaders(root, knowledgeDirs, categories, report);

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
      const { errors, warnings, notices } = validateConcept({ data: parsed.data, body, categories });

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
