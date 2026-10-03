import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const exists = (path: string) => existsSync(new URL(path, import.meta.url));

test('portal routes live only under app/portal and the public home stays at the rewrite', () => {
  assert.ok(exists('../app/portal/page.tsx'), 'portal index');
  assert.ok(!exists('../app/page.tsx'), 'no root app page');
  for (const route of ['login', 'account', 'setup/password', 'setup/mfa', 'cases', 'cases/new',
    'cases/[id]', 'cases/[id]/edit']) {
    assert.ok(exists(`../app/portal/${route}/page.tsx`), `app/portal/${route}/page.tsx`);
    assert.ok(!exists(`../app/${route}/page.tsx`), `app/${route}/page.tsx must be absent`);
  }
  assert.ok(exists('../app/api/contact/route.ts'), 'real API handlers stay at the public root');
  assert.ok(!exists('../app/portal/api'), 'no api subtree under portal');
});

test('proxy matcher targets only the portal subtree', () => {
  const proxy = read('../proxy.ts');
  assert.match(proxy, /matcher:\s*\[\s*'\/portal\/:path\*'\s*\]/);
  assert.doesNotMatch(proxy, /matcher:\s*\[\s*'\/'/);
});

test('session cookies are scoped to /portal, never broadened to the root', () => {
  for (const path of ['../lib/supabase/next-client.ts', '../lib/supabase/proxy.ts']) {
    const source = read(path);
    assert.match(source, /path: '\/portal'/);
    assert.doesNotMatch(source, /path: '\/'/);
  }
});

test('login background asset resolves under /portal', () => {
  assert.ok(exists('../public/portal/login-architecture-v1.webp'));
  assert.ok(!exists('../public/login-architecture-v1.webp'));
  assert.match(read('../app/portal/login/login.css'), /url\('\/portal\/login-architecture-v1\.webp'\)/);
});

test('login keeps public-home links at / and routes internal links under /portal', () => {
  const page = read('../app/portal/login/page.tsx');
  assert.match(page, /href="\/"/, 'public home link preserved');
  assert.doesNotMatch(page, /href="\/login"/, 'no unprefixed login link');
});

test('portal entry redirects on the server without an intermediary landing', () => {
  const page = read('../app/portal/page.tsx');
  assert.match(page, /import\s*{\s*redirect\s*}\s*from\s*'next\/navigation'/);
  assert.match(page, /redirect\('\/portal\/login'\)/);
  assert.doesNotMatch(page, /portal-shell|access-card/);
});
