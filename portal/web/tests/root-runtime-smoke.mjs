import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';

const handlers = Object.fromEntries(await Promise.all(['contact', 'create-preference', 'webhook'].map(async name => [
  `/api/${name}`,
  (await import(`../api/${name}.js`)).default,
])));

const server = createServer(async (request, response) => {
  const handler = handlers[new URL(request.url, 'http://local.test').pathname];
  if (!handler) {
    response.statusCode = 404;
    response.end();
    return;
  }
  let raw = '';
  for await (const chunk of request) raw += chunk;
  try {
    request.body = raw ? JSON.parse(raw) : undefined;
  } catch {
    request.body = raw;
  }
  await handler(request, response);
});

server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;

try {
  for (const path of ['/api/contact', '/api/create-preference', '/api/webhook']) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 405, path);
    assert.equal(response.headers.get('allow'), 'POST', path);
  }
  console.log('PASS: local Vercel-compatible API matrix retained all public POST entrypoints');
} finally {
  server.close();
  await once(server, 'close');
}
