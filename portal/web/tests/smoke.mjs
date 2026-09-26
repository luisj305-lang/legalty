import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Use a scoped process, ephemeral port, and loopback only. No provider requests.
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next',
  'start', '--hostname', '127.0.0.1', '--port', '0'], {
  cwd: new URL('../', import.meta.url),
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
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
  assert.match(html, /Acceso todavía no disponible/);
  assert.match(html, /El ingreso será por invitación/);
  assert.doesNotMatch(html, /<form\b|<input\b/);
  const missing = await fetch(`${address}/client/cases`, { signal: AbortSignal.timeout(5000) });
  assert.equal(missing.status, 404);
  console.log('PASS: landing 200, Spanish invitation-only notice, no forms, private route 404');
} finally {
  if (child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
}
