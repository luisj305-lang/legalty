import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const optionalSource = (path: string) => {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
};

test('authenticated shell exposes only working navigation and logout', () => {
  const layout = source('../app/portal/cases/layout.tsx');
  const nav = source('../lib/cases/nav.ts');
  assert.match(layout, /import styles from ['"]\.\/cases\.module\.css['"]/);
  assert.match(layout, /navItems\(role\)/);
  assert.match(layout, /aria-current="page"/);
  assert.match(nav, /href: '\/portal\/cases'/);
  assert.match(nav, /href: '\/portal\/setup\/password'/);
  assert.match(nav, /href: '\/portal\/setup\/mfa'/);
  assert.match(layout, /action=\{logout\}/);
  assert.doesNotMatch(layout, /href="#"|\/documents|\/messages|\/appointments|\/services|\/payments/);
});

test('authenticator setup is consistently optional without removing enrollment', () => {
  const account = source('../app/portal/account/page.tsx');
  const password = source('../app/portal/setup/password/page.tsx');
  const mfa = source('../app/portal/setup/mfa/page.tsx');
  const nav = source('../lib/cases/nav.ts');
  for (const page of [account, password, mfa, nav]) assert.match(page, /autenticador opcional/i);
  assert.doesNotMatch(password, /antes del cambio/i);
  assert.match(mfa, /<MfaForm factors=/);
});

test('dashboard presentation keeps metrics and links grounded in authorized case rows', () => {
  const page = source('../app/portal/cases/page.tsx');
  assert.match(page, /import styles from ['"]\.\/cases\.module\.css['"]/);
  assert.match(page, /summarizeCases\(view\.rows\)/);
  assert.match(page, /href=\{`\/portal\/cases\/\$\{row\.id\}`\}/);
  assert.match(page, /view\.rows\.length === 0/);
  assert.match(page, /view\.rows\.length === 50/);
  assert.doesNotMatch(page, /href="#"|progress|percentage|sample|placeholder/i);
});

test('case workspace stylesheet provides concept colors and responsive layouts', () => {
  const css = optionalSource('../app/portal/cases/cases.module.css');
  assert.match(css, /\.shell\s*\{/);
  assert.match(css, /\.sidebar\s*\{/);
  assert.match(css, /\.main\s*\{/);
  assert.match(css, /#[0-9a-f]{6}/i);
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /grid-template-columns:\s*1fr/);
  assert.match(css, /:focus-visible/);
});
