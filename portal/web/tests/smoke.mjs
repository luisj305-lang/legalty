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
  const response = await fetch(address, { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /lang="es"/);
  assert.match(html, /Acceso para cuentas invitadas/);
  assert.doesNotMatch(html, /<form\b|<input\b/);
  const missing = await fetch(`${address}/client/cases`, { signal: AbortSignal.timeout(5000) });
  assert.equal(missing.status, 404);
  const account = await fetch(`${address}/account`, { redirect: 'manual' });
  assert.equal(account.status, 307);
  assert.equal(account.headers.get('location'), '/login');
  assert.match(account.headers.get('cache-control'), /no-store/);
  const login = await fetch(`${address}/login`);
  const loginHtml = await login.text();
  assert.match(loginHtml, /type="password"/);
  const action = loginHtml.match(/name="(\$ACTION_ID_[^"]+)"/);
  assert.ok(action, 'Native server-action form must work without JavaScript');
  const body = new FormData();
  body.set(action[1], '');
  body.set('email', 'synthetic@example.invalid');
  body.set('password', 'synthetic-only');
  const invalid = await fetch(`${address}/login`, { method: 'POST', body,
    headers: { origin: address }, redirect: 'manual' });
  assert.equal(invalid.status, 303);
  assert.equal(invalid.headers.get('location'), '/login?error=credentials');
  const error = await (await fetch(`${address}/login?error=credentials`)).text();
  assert.match(error, /No fue posible iniciar sesión/);
  assert.doesNotMatch(error, /synthetic@example/);
  for (const path of ['password', 'mfa']) {
    const setup = await fetch(`${address}/setup/${path}`, { redirect: 'manual' });
    assert.equal(setup.status, 307);
    assert.equal(setup.headers.get('location'), '/login');
    assert.match(setup.headers.get('cache-control'), /no-store/);
  }
  for (const route of ['cases', 'cases/new', 'cases/11111111-1111-4111-8111-111111111111',
    'cases/11111111-1111-4111-8111-111111111111/edit']) {
    const denied = await fetch(`${address}/${route}`, { redirect: 'manual' });
    assert.equal(denied.status, 307);
    assert.equal(denied.headers.get('location'), '/login');
    assert.match(denied.headers.get('cache-control'), /no-store/);
  }
  for (const route of ['login', 'account', 'setup/password', 'setup/mfa', 'cases', 'cases/new',
    'cases/11111111-1111-4111-8111-111111111111/edit']) {
    const denied = await fetch(`${address}/${route}`, { method: 'POST', body,
      headers: { origin: 'https://foreign.example' }, redirect: 'manual' });
    assert.equal(denied.status, 403);
  }
  console.log('PASS: logged-out case create/update redirects, no-store, generic failure, foreign-origin rejection, scoped server');
} finally {
  if (child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
}
