/**
 * Frontmatter parsing — the single implementation.
 *
 * No validator parses frontmatter itself. Three independently drifting parsers is the defect class
 * this file exists to remove.
 *
 * Deliberate properties:
 *  - The delimiter is exactly `---`. Nothing else opens or closes a block.
 *  - Duplicate keys are reported, not silently overwritten.
 *  - A line the parser cannot interpret is reported as an error, never dropped. Silent truncation of
 *    a multi-line `description` or a long `resource` URL is how a validator passes a broken file.
 */

const KEY_RE = /^([A-Za-z_][A-Za-z0-9_-]*):[ \t]*(.*)$/;
const LIST_ITEM_RE = /^[ \t]*-[ \t]+(.*)$/;
const COMMENT_RE = /^[ \t]*#/;

/**
 * @param {string} source  Full file contents.
 * @returns {{
 *   found: boolean,
 *   data: Record<string, string|string[]>,
 *   warnings: {line:number, message:string}[],
 *   errors: {line:number, message:string}[],
 *   bodyStartLine: number
 * }}
 */
export function parseFrontmatter(source) {
  const lines = source.split(/\r?\n/);
  const result = {
    found: false,
    data: {},
    warnings: [],
    errors: [],
    bodyStartLine: 0,
  };

  if (lines[0]?.trim() !== '---') {
    return result;
  }

  let closeIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closeIndex = i;
      break;
    }
  }

  if (closeIndex === -1) {
    result.errors.push({ line: 1, message: 'Frontmatter opened with --- but never closed.' });
    return result;
  }

  result.found = true;
  result.bodyStartLine = closeIndex + 2; // 1-indexed line after the closing delimiter

  const seen = new Set();
  let currentKey = null;
  let currentIndent = 0;

  for (let i = 1; i < closeIndex; i++) {
    const raw = lines[i];
    const lineNo = i + 1;

    if (raw.trim() === '' || COMMENT_RE.test(raw)) {
      continue;
    }

    const indent = raw.length - raw.trimStart().length;

    // A list item belonging to the key above.
    const listMatch = raw.match(LIST_ITEM_RE);
    if (listMatch && currentKey && indent > 0) {
      const existing = result.data[currentKey];
      if (Array.isArray(existing)) {
        existing.push(stripQuotes(listMatch[1].trim()));
      } else if (existing === '') {
        result.data[currentKey] = [stripQuotes(listMatch[1].trim())];
      } else {
        result.errors.push({
          line: lineNo,
          message: `List item under key "${currentKey}" which already has a scalar value.`,
        });
      }
      continue;
    }

    // A continuation of the previous key's value: indented further than the key was.
    if (currentKey !== null && indent > currentIndent && !KEY_RE.test(raw.trim())) {
      const existing = result.data[currentKey];
      if (typeof existing === 'string') {
        result.data[currentKey] = existing === '' ? raw.trim() : `${existing} ${raw.trim()}`;
      } else {
        result.errors.push({
          line: lineNo,
          message: `Continuation line under key "${currentKey}" which holds a list.`,
        });
      }
      continue;
    }

    const keyMatch = raw.match(KEY_RE);
    if (!keyMatch) {
      // Never drop it. An unparseable line is a defect the author must see.
      result.errors.push({
        line: lineNo,
        message: `Cannot parse frontmatter line: ${JSON.stringify(raw)}`,
      });
      currentKey = null;
      continue;
    }

    const key = keyMatch[1];
    const rawValue = keyMatch[2];

    if (seen.has(key)) {
      result.warnings.push({
        line: lineNo,
        message: `Duplicate key "${key}" — the later value wins. Remove one.`,
      });
    }
    seen.add(key);

    currentKey = key;
    currentIndent = indent;

    if (rawValue === '|' || rawValue === '>') {
      // Block scalar: collect the indented lines that follow.
      const collected = [];
      let j = i + 1;
      while (j < closeIndex) {
        const blockLine = lines[j];
        if (blockLine.trim() === '') {
          collected.push('');
          j++;
          continue;
        }
        const blockIndent = blockLine.length - blockLine.trimStart().length;
        if (blockIndent <= indent) break;
        collected.push(blockLine.trim());
        j++;
      }
      result.data[key] = rawValue === '|' ? collected.join('\n') : collected.join(' ').trim();
      i = j - 1;
      currentKey = null;
      continue;
    }

    result.data[key] = parseScalar(rawValue.trim());
  }

  return result;
}

function parseScalar(value) {
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((item) => stripQuotes(item.trim()));
  }
  return stripQuotes(value);
}

function stripQuotes(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}
