import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { canonicalHost, portalEntryHref } from '../lib/site-config.ts';
import { buildRobots, buildSitemap } from '../lib/seo.ts';

const publicDir = new URL('../public/', import.meta.url);

// Indexable public landing pages and their canonical paths.
const canonicalPages = [
  { file: 'index.html', path: '/' },
  { file: 'about.html', path: '/about' },
  { file: 'services.html', path: '/services' },
  { file: 'contact.html', path: '/contact' },
];

// Every public landing page (indexable + payment-return) shares the header nav.
const landingPages = ['index.html', 'about.html', 'services.html', 'contact.html', 'success.html', 'failure.html'];

const readHtml = (file: string) => readFileSync(new URL(file, publicDir), 'utf8');

test('site config exposes a single canonical host and portal entry target', () => {
  assert.equal(canonicalHost, 'https://legalty.lat');
  assert.equal(portalEntryHref, '/portal');
});

test('every indexable landing page declares its canonical URL from the single host', () => {
  for (const { file, path } of canonicalPages) {
    const html = readHtml(file);
    assert.ok(html.includes(`<link rel="canonical" href="${canonicalHost}${path}">`), file);
  }
});

test('every landing page links to the portal entry from the single target', () => {
  for (const file of landingPages) {
    const html = readHtml(file);
    assert.ok(html.includes(`href="${portalEntryHref}"`), `${file} portal entry href`);
    assert.ok(html.includes('Portal privado'), `${file} portal entry label`);
  }
});

test('robots disallows the portal and private/API/payment paths while allowing the landing', () => {
  const rules = buildRobots();
  assert.ok(rules.rules, 'robots should declare rules');
  const list = Array.isArray(rules.rules) ? rules.rules : [rules.rules];
  const rule = list[0];
  assert.deepEqual(rule.userAgent, '*');
  assert.equal(rule.allow, '/');
  const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
  for (const path of [`${portalEntryHref}/`, '/api/', '/success', '/failure']) {
    assert.ok(disallow.includes(path), `disallow should include ${path}`);
  }
  assert.equal(rules.sitemap, `${canonicalHost}/sitemap.xml`);
});

test('sitemap contains only public URLs and never private/API/payment/portal paths', () => {
  const entries = buildSitemap();
  const urls = entries.map((entry) => entry.url);
  assert.deepEqual(urls, [
    `${canonicalHost}/`,
    `${canonicalHost}/about`,
    `${canonicalHost}/services`,
    `${canonicalHost}/contact`,
  ]);
  for (const url of urls) {
    assert.doesNotMatch(url, /\/(portal|api|success|failure)(\/|$)/, url);
  }
});

test('next config emits X-Robots-Tag noindex for all portal responses', async () => {
  const config = (await import('../next.config.ts')).default;
  const headers = await config.headers?.();
  assert.ok(headers, 'headers should be configured');
  const rule = headers.find((entry: { source: string }) => entry.source === `${portalEntryHref}/:path*`);
  assert.ok(rule, 'portal X-Robots-Tag header rule should exist');
  assert.ok(rule.headers.some((h: { key: string; value: string }) =>
    h.key === 'X-Robots-Tag' && h.value === 'noindex, nofollow'));
});
