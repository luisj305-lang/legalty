import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrap, loadProjectKey, PROJECT } from '../scripts/bootstrap-test-users.mjs';

const password = 'synthetic-password-only';
const key = 'synthetic-service-key';
const emails = ['david@legalty.com', 'goofypet@gmail.com'];
const user = (index) => ({ id: `00000000-0000-4000-8000-00000000000${index}`,
  email: emails[index], email_confirmed_at: '2026-01-01',
  app_metadata: { desired_role: index ? 'client' : 'admin', active: false, must_change_password: true } });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const options = (fetchImpl, extra = {}) => ({ project: PROJECT, password, fetchImpl,
  keyLoader: async () => key, ...extra });

test('rejects wrong project, mode and missing password before reading credentials', async () => {
  for (const extra of [{ project: 'other' }, { mode: 'reset' }, { password: '' }]) {
    const result = await bootstrap(options(() => assert.fail(), {
      mode: 'create', ...extra, keyLoader: () => assert.fail(),
    }));
    assert.equal(result.status, 'blocked');
  }
});

test('inspect paginates completely without password or mutation', async () => {
  const calls = [];
  const result = await bootstrap(options(async (url, init) => {
    calls.push(url);
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(new URL(url).origin, `https://${PROJECT}.supabase.co`);
    return json({ users: calls.length === 1
      ? Array.from({ length: 100 }, (_, i) => ({ id: `other-${i}` })) : [user(0)] });
  }, { password: undefined }));
  assert.equal(calls.length, 2);
  assert.match(calls[1], /page=2&per_page=100/);
  assert.deepEqual(result.users.map(x => x.state), ['existing', 'missing']);
});

test('duplicates and conflicting existing metadata block all writes', async () => {
  for (const users of [[user(0), user(0)], [{ ...user(1), app_metadata: {} }]]) {
    let count = 0;
    const result = await bootstrap(options(async (_url, init) => {
      count++; assert.equal(init.method, 'GET'); return json({ users });
    }, { mode: 'create' }));
    assert.equal(result.status, 'blocked');
    assert.equal(count, 1);
  }
});

test('creates only missing identities with exact flags and verifies by direct readback', async () => {
  const methods = [];
  const result = await bootstrap(options(async (url, init) => {
    methods.push(init.method);
    assert.equal(init.headers.apikey, key);
    assert.equal(init.headers.Authorization, `Bearer ${key}`);
    if (init.method === 'POST') {
      assert.deepEqual(JSON.parse(init.body), { email: emails[1], password,
        email_confirm: true, app_metadata: user(1).app_metadata });
      return json(user(1));
    }
    return json(url.includes('?') ? { users: [user(0)] } : user(1));
  }, { mode: 'create' }));
  assert.equal(result.status, 'complete');
  assert.deepEqual(methods, ['GET', 'POST', 'GET']);
  assert.deepEqual(result.users.map(x => x.state), ['existing', 'created']);
  assert.ok(!JSON.stringify(result).includes(password));
  assert.ok(!JSON.stringify(result).includes(key));
});

test('uncertain POST stops once, preserves partial outcome, and sanitizes errors', async () => {
  let posts = 0;
  const result = await bootstrap(options(async (url, init) => {
    if (init.method === 'POST') {
      if (++posts === 2) throw new Error(`${password} ${key}`);
      return json(user(0));
    }
    return json(url.includes('?') ? { users: [] } : user(0));
  }, { mode: 'create' }));
  assert.equal(posts, 2);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.users.map(x => x.state), ['created', 'uncertain']);
  assert.ok(!JSON.stringify(result).includes(password));
  assert.ok(!JSON.stringify(result).includes(key));
});

test('HTTP failures, malformed responses and missing keys fail safely', async () => {
  for (const fetchImpl of [async () => json({ secret: password }, 403),
    async () => json({}), async () => { throw new Error(key); }]) {
    const result = await bootstrap(options(fetchImpl));
    assert.equal(result.status, 'blocked');
    assert.doesNotMatch(JSON.stringify(result), /synthetic-/);
  }
  assert.equal((await bootstrap(options(() => assert.fail(), { keyLoader: async () => '' }))).status, 'blocked');
});

test('CLI key loader uses explicit project, never forwards password, sanitizes failure', async () => {
  const env = { SUPABASE_CLI_PATH: 'fake-cli', LEGALTY_BOOTSTRAP_PASSWORD: password };
  const loaded = await loadProjectKey(PROJECT, env, (file, args, settings) => {
    assert.equal(file, 'fake-cli');
    assert.deepEqual(args, ['projects', 'api-keys', '--project-ref', PROJECT, '--reveal', '--output', 'json']);
    assert.equal(settings.env.LEGALTY_BOOTSTRAP_PASSWORD, undefined);
    assert.equal(settings.shell, false);
    return JSON.stringify([{ name: 'service_role', api_key: key }]);
  });
  assert.equal(loaded, key);
  await assert.rejects(loadProjectKey(PROJECT, env, () => { throw new Error(password); }),
    error => error.message === 'Project key unavailable');
});

test('bounded pagination and repeated pages fail closed without writes', async () => {
  for (const repeated of [false, true]) {
    let calls = 0;
    const result = await bootstrap(options(async (_url, init) => {
      assert.equal(init.method, 'GET');
      calls++;
      return json({ users: Array.from({ length: 100 }, (_, i) => ({ id: `${repeated ? 0 : calls}-${i}` })) });
    }, { mode: 'create' }));
    assert.equal(result.status, 'blocked');
    assert.equal(calls, repeated ? 2 : 100);
  }
});

test('POST rejection or invalid direct readback stops without retry or second creation', async () => {
  for (const rejectPost of [true, false]) {
    let posts = 0;
    const result = await bootstrap(options(async (url, init) => {
      if (init.method === 'POST') {
        posts++;
        return rejectPost ? json({ error: password }, 422) : json(user(0));
      }
      return json(url.includes('?') ? { users: [] } : { ...user(0), app_metadata: {} });
    }, { mode: 'create' }));
    assert.equal(result.status, 'partial');
    assert.equal(posts, 1);
    assert.deepEqual(result.users.map(x => x.state), ['uncertain', 'missing']);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-/);
  }
});
