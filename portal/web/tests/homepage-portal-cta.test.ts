import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homepage = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const header = homepage.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0];

test('homepage header has one styled Portal privado CTA and no Hablemos', () => {
  assert.ok(header, 'Homepage header must exist');
  assert.equal((header.match(/<a\b[^>]*\bhref="\/portal"/g) ?? []).length, 1);
  assert.match(header, /<a class="site-nav__link nav-cta" href="\/portal">Portal privado <svg/);
  assert.doesNotMatch(header, /Hablemos/i);
});

test('homepage header preserves the original logo, classes, and CTA arrow', () => {
  assert.ok(header, 'Homepage header must exist');
  assert.ok(header.includes('<header class="site-header">'));
  assert.ok(header.includes('<div class="container site-header__inner">'));
  assert.ok(header.includes('<nav class="site-nav" aria-label="Navegación principal">'));
  assert.ok(header.includes('<ul class="site-nav__list">'));
  assert.ok(header.includes('<a class="site-logo" href="index.html" aria-label="LEGALTY — Inicio"><img src="assets/img/legalty-logo-20260906.png" width="4329" height="921" alt="LEGALTY Servicios Jurídicos Integrales S.A.S."></a>'));
  assert.match(header, /<a class="site-nav__link nav-cta"[^>]*>[^<]*<svg class="arrow" aria-hidden="true"><use href="assets\/img\/ui-20260906\.svg#arrow-up"\/><\/svg><\/a>/);
});
