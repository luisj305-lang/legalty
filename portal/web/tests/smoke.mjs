import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';

// Reserve an available loopback port without touching another user's preview.
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const origin = `http://127.0.0.1:${port}`;
// Explicit test origin; empty provider configuration prevents external requests.
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next',
  'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: new URL('../', import.meta.url),
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', PORTAL_ORIGIN: origin,
    NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_SECRET_KEY: '' },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', data => { output += data; });
child.stderr.on('data', data => { output += data; });

try {
  let address;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${output}`);
    address = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    if (address && output.includes('Ready')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(address && output.includes('Ready'), `Server not ready: ${output}`);

  // Public landing stays at the root with lang="es".
  for (const path of ['', '/index', '/index.html', '/about', '/about.html', '/services',
    '/services.html', '/contact', '/contact.html', '/success', '/success.html', '/failure', '/failure.html']) {
    const response = await fetch(`${address}${path}`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200, path || '/');
    assert.match(await response.text(), /lang="es"/, path || '/');
  }
  const html = await (await fetch(address, { signal: AbortSignal.timeout(5000) })).text();
  assert.match(html, /LEGALTY — Asesoría jurídica y financiera/);
  assert.match(html, /href="\/portal"/, 'public landing exposes the portal entry link');
  assert.match(html, /Portal privado/, 'public landing labels the portal entry');
  assert.match(await (await fetch(`${address}/assets/css/main.css`)).text(), /site-header/);

  // Discovery files: robots excludes private/API/payment paths, sitemap is public-only.
  const robots = await (await fetch(`${address}/robots.txt`, { signal: AbortSignal.timeout(5000) })).text();
  assert.match(robots, /User-[Aa]gent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/portal\//);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Disallow: \/success/);
  assert.match(robots, /Disallow: \/failure/);
  assert.match(robots, /Sitemap: https:\/\/legalty\.lat\/sitemap\.xml/);
  const sitemap = await (await fetch(`${address}/sitemap.xml`, { signal: AbortSignal.timeout(5000) })).text();
  for (const url of ['https://legalty.lat/', 'https://legalty.lat/about',
    'https://legalty.lat/services', 'https://legalty.lat/contact']) {
    assert.match(sitemap, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), url);
  }
  assert.doesNotMatch(sitemap, /\/(portal|api|success|failure)(\/|$)/, 'sitemap must exclude private/API/payment/portal URLs');

  const missing = await fetch(`${address}/client/cases`, { signal: AbortSignal.timeout(5000) });
  assert.equal(missing.status, 404);

  // Unprefixed portal paths must not become an alternate protected surface.
  for (const path of ['/login', '/account', '/cases']) {
    const response = await fetch(`${address}${path}`, { redirect: 'manual' });
    assert.equal(response.status, 404, `${path} must be 404, not a protected copy`);
  }

  // The portal entry redirects directly to the login route.
  const portal = await fetch(`${address}/portal`, { redirect: 'manual' });
  assert.equal(portal.status, 307, '/portal');
  assert.equal(portal.headers.get('location'), '/portal/login', '/portal redirect target');
  assert.equal(portal.headers.get('x-robots-tag'), 'noindex, nofollow', '/portal X-Robots-Tag');
  assert.doesNotMatch(await portal.text(), /Portal en desarrollo/, '/portal intermediary content');
  const login = await fetch(`${address}/portal/login`);
  assert.equal(login.status, 200, '/portal/login');
  const loginHtml = await login.text();
  assert.match(loginHtml, /type="password"/);
  assert.match(loginHtml, /href="\/"/, 'login keeps the public-home link at /');

  // The portal background asset resolves under /portal.
  const asset = await fetch(`${address}/portal/login-architecture-v1.webp`, { signal: AbortSignal.timeout(5000) });
  assert.equal(asset.status, 200, '/portal/login-architecture-v1.webp');

  // Logged-out protected flows redirect to the prefixed login.
  const account = await fetch(`${address}/portal/account`, { redirect: 'manual' });
  assert.equal(account.status, 307);
  assert.equal(account.headers.get('location'), '/portal/login');
  assert.match(account.headers.get('cache-control'), /no-store/);

  // Native server-action login returns the prefixed generic failure redirect.
  const action = loginHtml.match(/name="(\$ACTION_ID_[^"]+)"/);
  assert.ok(action, 'Native server-action form must work without JavaScript');
  const body = new FormData();
  body.set(action[1], '');
  body.set('email', 'synthetic@example.invalid');
  body.set('password', 'synthetic-only');
  const invalid = await fetch(`${address}/portal/login`, { method: 'POST', body,
    headers: { origin: address }, redirect: 'manual' });
  assert.equal(invalid.status, 303);
  assert.equal(invalid.headers.get('location'), '/portal/login?error=credentials');
  const error = await (await fetch(`${address}/portal/login?error=credentials`)).text();
  assert.match(error, /No fue posible iniciar sesión/);
  assert.doesNotMatch(error, /synthetic@example/);

  for (const path of ['password', 'mfa']) {
    const setup = await fetch(`${address}/portal/setup/${path}`, { redirect: 'manual' });
    assert.equal(setup.status, 307);
    assert.equal(setup.headers.get('location'), '/portal/login');
    assert.match(setup.headers.get('cache-control'), /no-store/);
  }
  for (const route of ['cases', 'cases/new', 'cases/11111111-1111-4111-8111-111111111111',
    'cases/11111111-1111-4111-8111-111111111111/edit']) {
    const denied = await fetch(`${address}/portal/${route}`, { redirect: 'manual' });
    assert.equal(denied.status, 307);
    assert.equal(denied.headers.get('location'), '/portal/login');
    assert.match(denied.headers.get('cache-control'), /no-store/);
  }

  // Foreign-origin mutations are rejected for every prefixed portal route.
  for (const route of ['login', 'account', 'setup/password', 'setup/mfa', 'cases', 'cases/new',
    'cases/11111111-1111-4111-8111-111111111111/edit']) {
    const denied = await fetch(`${address}/portal/${route}`, { method: 'POST', body,
      headers: { origin: 'https://foreign.example' }, redirect: 'manual' });
    assert.equal(denied.status, 403, `/portal/${route} foreign POST`);
  }

  // Real API handlers stay at the public root.
  for (const route of ['api/contact', 'api/create-preference', 'api/webhook']) {
    const methodNotAllowed = await fetch(`${address}/${route}`, { signal: AbortSignal.timeout(5000) });
    assert.equal(methodNotAllowed.status, 405, `${route} GET status`);
    assert.equal(methodNotAllowed.headers.get('allow'), 'POST', `${route} Allow header`);
  }
  console.log('PASS: public root routes and assets, portal entry link, robots/sitemap discovery files, /portal X-Robots-Tag noindex, /portal containment, real /api/* method-not-allowed contract, logged-out prefixed redirects, no-store, generic failure, foreign-origin rejection, scoped server');
} finally {
  if (child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
}
