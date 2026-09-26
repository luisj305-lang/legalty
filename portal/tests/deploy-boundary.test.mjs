import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';

const rules = () => readFileSync(new URL('../web/.vercelignore', import.meta.url), 'utf8')
  .split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));

test('upload rules exclude synthetic secrets and generated/test trees at every depth', () => {
  const patterns = rules();
  assert.ok(patterns.every(pattern => !pattern.startsWith('!')), 'No secret re-inclusion rules');
  for (const path of [
    '.env', '.env.local', '.env.example', '.env.supabase-db-password.dpapi',
    'nested/.env.production', 'nested/deeper/.env', 'secret.dpapi', 'nested/key.dpapi',
    'tests/auth.test.ts', 'nested/tests/fixture.json', 'node_modules/pkg/index.js',
    '.next/server/app.js', '.vercel/project.json', 'coverage/report.json',
    'nested/node_modules/pkg/index.js', 'tsconfig.tsbuildinfo', '.git/config',
    'tests', 'nested/tests', 'node_modules', '.next', '.vercel', '.git', 'coverage',
  ]) {
    assert.ok(patterns.some(pattern => matchesGlob(path, pattern)), `Excluded: ${path}`);
  }
});

test('upload rules retain the real build inputs', () => {
  const patterns = rules();
  for (const path of [
    'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts',
    'app/page.tsx', 'app/login/page.tsx', 'app/globals.css', 'lib/auth/access.ts',
    'proxy.ts', 'public/logo.svg',
  ]) {
    assert.ok(!patterns.some(pattern => matchesGlob(path, pattern)), `Retained: ${path}`);
  }
});

test('actual CLI dry inventory has only app source and no sensitive artifacts', {
  skip: !process.env.LEGALTY_DRY_MANIFEST,
}, () => {
  const manifest = JSON.parse(readFileSync(process.env.LEGALTY_DRY_MANIFEST, 'utf8').replace(/^\uFEFF/, ''));
  const paths = manifest.files.map(file => typeof file === 'string' ? file : file.path);
  assert.ok(paths.length > 0);
  for (const path of paths) {
    assert.equal(typeof path, 'string');
    assert.ok(!path.includes('..') && !path.startsWith('/') && !path.includes(':'), 'App-relative inventory only');
    assert.ok(!/(^|\/)(\.env[^/]*|[^/]*\.dpapi|tests|node_modules|\.next|\.vercel|\.git|coverage)(\/|$)/i.test(path), 'No forbidden upload');
    assert.ok(!['index.html', 'about.html', 'assets/css/main.css'].includes(path), 'No root website');
  }
  for (const required of ['package.json', 'package-lock.json', 'app/page.tsx', 'app/login/page.tsx', 'proxy.ts']) {
    assert.ok(paths.includes(required), `Build input present: ${required}`);
  }
});
