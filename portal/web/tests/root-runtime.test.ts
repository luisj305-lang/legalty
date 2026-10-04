import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const repository = new URL('../../../', import.meta.url);
const application = new URL('../', import.meta.url);
// Static assets remain byte-identical to the repository-root source.
const assetInputs = [
  'assets/css/tokens.css', 'assets/css/main.css',
  'assets/js/nav.js', 'assets/js/contact-form.js', 'assets/js/checkout.js', 'assets/js/catalog.js', 'assets/js/carousel.js',
  'assets/fonts/oswald-source-20260906.woff', 'assets/fonts/oswald-200-latin.woff2',
  'assets/fonts/oswald-200-latin-ext.woff2', 'assets/fonts/open-sans-source-20260906.woff',
  'assets/fonts/open-sans-400-latin.woff2', 'assets/fonts/open-sans-400-latin-ext.woff2',
  'assets/fonts/handlee-400-latin.woff2', 'assets/img/ui-20260906.svg',
  'assets/img/legalty-workplace-20260906.jpg', 'assets/img/legalty-logo-20260906.png',
  'assets/img/legalty-architecture-20260906.jpg',
];

// Landing pages intentionally carry SEO metadata (canonical links and the
// public portal entry) that the legacy repository-root copy does not; their
// SEO correctness is asserted in seo.test.ts, so only integrity is checked here.
const htmlInputs = ['index.html', 'about.html', 'services.html', 'contact.html', 'success.html', 'failure.html'];

const read = (base: URL, path: string) => readFileSync(new URL(path, base));

test('root runtime snapshots every public input and retains clean public routes', async () => {
  for (const path of assetInputs) {
    assert.deepEqual(read(application, `public/${path}`), read(repository, path), path);
  }
  for (const path of htmlInputs) {
    assert.match(read(application, `public/${path}`).toString('utf8'), /lang="es"/, path);
  }

  // The portal is a Next app: `cleanUrls` conflicts with its `beforeFiles`
  // rewrites (the clean URL 308-loops into a 404), so the portal must NOT set
  // it even though the static root project relies on it. Headers stay shared.
  const portalVercel = JSON.parse(read(application, 'vercel.json').toString('utf8'));
  const rootVercel = JSON.parse(read(repository, 'vercel.json').toString('utf8'));
  assert.equal(portalVercel.cleanUrls, undefined);
  assert.equal(rootVercel.cleanUrls, true);
  assert.deepEqual(portalVercel.headers, rootVercel.headers);
  const config = (await import('../next.config.ts')).default;
  const rewrites = await (config.rewrites as () => Promise<{ beforeFiles: { source: string; destination: string }[] }>)();
  assert.deepEqual(rewrites.beforeFiles, [
    { source: '/', destination: '/index.html' },
    { source: '/index', destination: '/index.html' },
    { source: '/about', destination: '/about.html' },
    { source: '/services', destination: '/services.html' },
    { source: '/contact', destination: '/contact.html' },
    { source: '/success', destination: '/success.html' },
    { source: '/failure', destination: '/failure.html' },
    { source: '/citas', destination: '/citas.html' },
  ]);
  assert.ok(!Object.hasOwn(config, 'basePath'));
});

test('Vercel-compatible API entrypoints retain the public handler contracts', async () => {
  for (const name of ['contact', 'create-preference', 'webhook']) {
    assert.deepEqual(read(application, `api/legacy/${name}.cjs`), read(repository, `api/${name}.js`), name);
    const handler = (await import(`../api/${name}.js`)).default;
    assert.equal(typeof handler, 'function');
    const response = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) { this.headers[name] = value; },
      end() {},
    };
    await handler({ method: 'GET', headers: {} }, response);
    assert.equal(response.statusCode, 405, name);
    assert.equal(response.headers.Allow, 'POST', name);
  }
});
