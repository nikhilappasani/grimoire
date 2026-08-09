/**
 * Command-line parsing — the single implementation.
 *
 * Four entry points had grown their own `for (let i = 0; i < argv.length; i++)` loop with the same
 * shape and quietly different behaviour: some rejected an unknown flag, some turned it into a
 * positional argument (so `sync --dry-runn` resolved a repository root named `--dry-runn`), and a
 * value flag at the end of argv silently produced `undefined` in all of them.
 *
 * This parser **never throws and never exits.** It reports what it saw — including what it could
 * not make sense of — and each caller decides what is fatal. That split matters: `bin/grimoire.js`
 * inspects a subcommand's arguments without understanding them and must tolerate flags it has
 * never heard of, while `compendium-push` must reject a typo'd flag rather than risk interpreting
 * it as the slug it is about to publish.
 */

/**
 * @param {string[]} argv  Arguments after the command name.
 * @param {{
 *   booleans?: Record<string, string>,
 *   values?: Record<string, string>,
 *   defaults?: Record<string, unknown>,
 * }} spec  Maps each accepted flag to the result key it sets. Listing two flags against the same
 *   key makes them aliases (`'-m'` and `'--message'` both → `message`).
 * @returns {{
 *   flags: Record<string, unknown>,
 *   positional: string[],
 *   unknown: string[],
 *   missingValues: string[],
 * }} `unknown` holds dash-prefixed arguments the spec does not describe; `missingValues` holds
 *   value flags that ended the argument list with nothing after them.
 */
export function parseArgs(argv, { booleans = {}, values = {}, defaults = {} } = {}) {
  const flags = { ...defaults };
  const positional = [];
  const unknown = [];
  const missingValues = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (Object.prototype.hasOwnProperty.call(booleans, arg)) {
      flags[booleans[arg]] = true;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(values, arg)) {
      if (i + 1 >= argv.length) {
        missingValues.push(arg);
        continue;
      }
      flags[values[arg]] = argv[++i];
      continue;
    }

    // A bare "-" is a conventional stdin placeholder, not a flag; leave it to the caller.
    if (arg.startsWith('-') && arg !== '-') {
      unknown.push(arg);
      continue;
    }

    positional.push(arg);
  }

  return { flags, positional, unknown, missingValues };
}

/**
 * The first thing wrong with an argument list, as a ready-to-print sentence, or null if nothing is.
 * Callers that reject bad input all want the same two messages; this keeps them worded identically.
 *
 * @param {{unknown: string[], missingValues: string[]}} parsed
 */
export function argsError({ unknown, missingValues }) {
  if (missingValues.length > 0) return `${missingValues[0]} requires a value.`;
  if (unknown.length > 0) return `Unknown flag: ${unknown[0]}`;
  return null;
}
