/**
 * Shared reporting for every validator. One output shape, one exit-code policy.
 * Errors fail the run. Warnings and notices never do.
 */

import { parseArgs } from './args.js';

export class Report {
  constructor(toolName) {
    this.toolName = toolName;
    this.entries = [];
  }

  error(file, message, line) {
    this.entries.push({ level: 'error', file, message, line });
  }

  warn(file, message, line) {
    this.entries.push({ level: 'warn', file, message, line });
  }

  notice(file, message, line) {
    this.entries.push({ level: 'notice', file, message, line });
  }

  get counts() {
    return {
      error: this.entries.filter((e) => e.level === 'error').length,
      warn: this.entries.filter((e) => e.level === 'warn').length,
      notice: this.entries.filter((e) => e.level === 'notice').length,
    };
  }

  get failed() {
    return this.counts.error > 0;
  }

  /** @param {{json?: boolean, quiet?: boolean}} options */
  print({ json = false, quiet = false } = {}) {
    if (json) {
      process.stdout.write(
        `${JSON.stringify({ tool: this.toolName, counts: this.counts, entries: this.entries }, null, 2)}\n`
      );
      return;
    }

    const icon = { error: 'ERROR ', warn: 'warn  ', notice: 'note  ' };
    const byFile = new Map();
    for (const entry of this.entries) {
      if (quiet && entry.level !== 'error') continue;
      if (!byFile.has(entry.file)) byFile.set(entry.file, []);
      byFile.get(entry.file).push(entry);
    }

    for (const [file, entries] of byFile) {
      process.stdout.write(`\n${file}\n`);
      for (const entry of entries) {
        const where = entry.line ? `:${entry.line}` : '';
        process.stdout.write(`  ${icon[entry.level]}${where ? `${where} ` : ''}${entry.message}\n`);
      }
    }

    const { error, warn, notice } = this.counts;
    const summary = `${error} error(s), ${warn} warning(s), ${notice} notice(s)`;
    process.stdout.write(`\n${this.toolName}: ${error === 0 ? 'PASS' : 'FAIL'} — ${summary}\n`);
  }
}

/**
 * Flag parsing for the validators, over the shared parser in `args.js`.
 *
 * Validators are non-strict: they are run by `preflight` and by CI wrappers that may
 * pass flags this build does not know, and refusing to validate because of an unrecognized flag
 * would turn a cosmetic mismatch into a red build.
 */
export function parseFlags(argv) {
  const { flags, positional } = parseArgs(argv, {
    booleans: { '--json': 'json', '--quiet': 'quiet' },
    defaults: { json: false, quiet: false },
  });
  return { ...flags, positional };
}
