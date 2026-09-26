import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const optionalSource = (path: string) => {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
};

test('authenticated shell exposes only working navigation and logout', () => {
  const layout = source('../app/cases/layout.tsx');
  assert.match(layout, /import styles from ['"]\.\/cases\.module\.css['"]/);
  assert.match(layout, /href="\/cases"[^>]*aria-current="page"/);
  assert.match(layout, /href="\/setup\/password"/);
  assert.match(layout, /href="\/setup\/mfa"/);
  assert.match(layout, /action=\{logout\}/);
  assert.doesNotMatch(layout, /href="#"|\/documents|\/messages|\/appointments|\/services|\/payments/);
});

test('dashboard presentation keeps metrics and links grounded in authorized case rows', () => {
  const page = source('../app/cases/page.tsx');
  assert.match(page, /import styles from ['"]\.\/cases\.module\.css['"]/);
  assert.match(page, /summarizeCases\(view\.rows\)/);
  assert.match(page, /href=\{`\/cases\/\$\{row\.id\}`\}/);
  assert.match(page, /view\.rows\.length === 0/);
  assert.match(page, /view\.rows\.length === 50/);
  assert.doesNotMatch(page, /href="#"|progress|percentage|sample|placeholder/i);
});

test('case workspace stylesheet provides concept colors and responsive layouts', () => {
  const css = optionalSource('../app/cases/cases.module.css');
  assert.match(css, /\.shell\s*\{/);
  assert.match(css, /\.sidebar\s*\{/);
  assert.match(css, /\.main\s*\{/);
  assert.match(css, /#[0-9a-f]{6}/i);
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /grid-template-columns:\s*1fr/);
  assert.match(css, /:focus-visible/);
});
