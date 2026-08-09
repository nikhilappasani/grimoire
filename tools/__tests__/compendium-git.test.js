import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  scanForSecrets,
  parseRemoteUrl,
  compareUrl,
  resolveBranchName,
  isValidSlug,
  planRootResolution,
} from '../lib/compendium-git.js';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'compendium-push');
const readFixture = (...segments) => fs.readFileSync(path.join(FIXTURES, ...segments), 'utf8');

test('secret scan flags the AWS-example key fixture, reporting kind and line, never the match', () => {
  const findings = scanForSecrets([
    { path: 'secret-in-transcript/transcript.md', content: readFixture('secret-in-transcript', 'transcript.md') },
  ]);

  assert.ok(findings.length >= 1);
  assert.equal(findings[0].kind, 'AWS access key id');
  assert.equal(typeof findings[0].line, 'number');
  for (const finding of findings) {
    assert.ok(!JSON.stringify(finding).includes('AKIA'), 'a finding must never contain the matched secret text');
  }
});

test('secret scan passes the clean fixture', () => {
  const findings = scanForSecrets([
    { path: 'clean/transcript.md', content: readFixture('clean', 'transcript.md') },
  ]);

  assert.deepEqual(findings, []);
});

test('secret scan catches credential assignments and private key blocks', () => {
  const findings = scanForSecrets([
    { path: 'a.md', content: 'api_key = "abcdef0123456789abcdef"' },
    { path: 'b.md', content: '-----BEGIN RSA PRIVATE KEY-----' },
    { path: 'c.md', content: 'token: xoxb-123456789012-abcdefghijklm' },
  ]);

  assert.equal(findings.length, 3);
});

test('remote URLs parse for every fixture form', () => {
  const cases = JSON.parse(readFixture('remote-urls.json'));
  for (const { input, host, owner, repo } of cases) {
    assert.deepEqual(parseRemoteUrl(input), { host, owner, repo }, input);
  }
  assert.equal(parseRemoteUrl('not a remote'), null);
});

test('compare URL is built exactly', () => {
  assert.equal(
    compareUrl({ host: 'github.com', owner: 'o', repo: 'r', base: 'main', branch: 'compendium/x' }),
    'https://github.com/o/r/compare/main...compendium%2Fx?expand=1'
  );
});

test('branch naming mirrors the spec collision convention', () => {
  const today = new Date('2026-08-09T12:00:00Z');
  const none = new Set();
  assert.equal(resolveBranchName('deploy-process', { existingRefs: none, today }), 'compendium/deploy-process');

  const taken = new Set(['compendium/deploy-process']);
  assert.equal(resolveBranchName('deploy-process', { existingRefs: taken, today }), 'compendium/deploy-process-20260809');

  taken.add('compendium/deploy-process-20260809');
  assert.equal(resolveBranchName('deploy-process', { existingRefs: taken, today }), 'compendium/deploy-process-20260809-2');

  taken.add('compendium/deploy-process-20260809-2');
  assert.equal(resolveBranchName('deploy-process', { existingRefs: taken, today }), 'compendium/deploy-process-20260809-3');
});

test('slug validation rejects traversal and separators', () => {
  assert.equal(isValidSlug('deploy-process'), true);
  assert.equal(isValidSlug('../etc'), false);
  assert.equal(isValidSlug('a/b'), false);
  assert.equal(isValidSlug('UPPER'), false);
  assert.equal(isValidSlug(''), false);
});

test('root resolution: explicit and env roots fail closed when missing, never created', () => {
  const missing = () => false;
  assert.match(planRootResolution({ explicitRoot: '/x', existsFn: missing }).error, /Refusing to create/);
  assert.match(planRootResolution({ envRoot: '/y', existsFn: missing }).error, /Refusing to create/);
});

test('root resolution: env root wins when it exists; managed clone is used when only a URL is configured', () => {
  const exists = () => true;
  assert.deepEqual(planRootResolution({ envRoot: '/clone', existsFn: exists }), { kind: 'env', path: '/clone' });

  const managed = planRootResolution({
    configRepoUrl: 'https://github.com/o/r.git',
    managedDir: '/home/u/.grimoire/compendium',
    existsFn: () => false,
  });
  assert.equal(managed.kind, 'managed');
  assert.equal(managed.cloneUrl, 'https://github.com/o/r.git');
});

test('root resolution: nothing configured is a clear error', () => {
  assert.match(planRootResolution({ existsFn: () => false }).error, /No compendium root resolves/);
});
