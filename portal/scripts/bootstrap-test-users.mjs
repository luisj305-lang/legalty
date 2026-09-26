import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PROJECT = 'tzgqcwnachuvzikxrozi';
const TARGETS = Object.freeze([
  Object.freeze({ email: 'david@legalty.com', desired_role: 'admin' }),
  Object.freeze({ email: 'goofypet@gmail.com', desired_role: 'client' }),
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadProjectKey(project, environment = process.env, run = execFileSync) {
  try {
    if (project !== PROJECT || !environment.SUPABASE_CLI_PATH) throw new Error();
    const { LEGALTY_BOOTSTRAP_PASSWORD: omitted, ...childEnvironment } = environment;
    const output = run(environment.SUPABASE_CLI_PATH, [
      'projects', 'api-keys', '--project-ref', PROJECT, '--reveal', '--output', 'json',
    ], { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024,
      windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: childEnvironment });
    const keys = JSON.parse(output).filter(item => item.name === 'service_role');
    if (keys.length !== 1 || typeof keys[0].api_key !== 'string' || !keys[0].api_key) throw new Error();
    return keys[0].api_key;
  } catch {
    // Child-process errors contain stdout/stderr; never expose their objects.
    throw new Error('Project key unavailable');
  }
}

function matches(user, target) {
  return UUID.test(user?.id) && user.email === target.email &&
    typeof user.email_confirmed_at === 'string' && !!user.email_confirmed_at &&
    user.app_metadata?.desired_role === target.desired_role &&
    user.app_metadata?.active === false && user.app_metadata?.must_change_password === true;
}

export async function bootstrap({ project, mode = 'inspect', password,
  fetchImpl = fetch, keyLoader = loadProjectKey } = {}) {
  const users = TARGETS.map(target => ({ ...target, state: 'uninspected' }));
  const result = (status, reason) => ({ status, reason, users });
  if (project !== PROJECT || !['inspect', 'create'].includes(mode)) {
    return result('blocked', 'invalid_target_or_mode');
  }
  if (mode === 'create' && (typeof password !== 'string' || !password.trim())) {
    return result('blocked', 'password_required');
  }
  let request;
  try {
    const key = await keyLoader(PROJECT);
    if (typeof key !== 'string' || !key.trim()) throw new Error();
    request = async (suffix, method = 'GET', payload) => {
      const response = await fetchImpl(`https://${PROJECT}.supabase.co/auth/v1/admin/users${suffix}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      });
      if (!response.ok) throw new Error('Request failed');
      return await response.json();
    };
    const all = [];
    const seen = new Set();
    for (let page = 1; page <= 100; page++) {
      const data = await request(`?page=${page}&per_page=100`);
      if (!Array.isArray(data?.users) || data.users.length > 100) throw new Error();
      for (const user of data.users) {
        if (!user || typeof user.id !== 'string' || seen.has(user.id)) throw new Error();
        seen.add(user.id);
        all.push(user);
      }
      if (data.users.length < 100) break;
      if (page === 100) throw new Error();
    }
    for (let i = 0; i < TARGETS.length; i++) {
      const target = TARGETS[i];
      const found = all.filter(user => typeof user.email === 'string' &&
        user.email.toLowerCase() === target.email);
      users[i].state = found.length === 0 ? 'missing'
        : found.length === 1 && matches(found[0], target) ? 'existing' : 'conflict';
    }
    if (users.some(user => user.state === 'conflict')) return result('blocked', 'existing_identity_conflict');
  } catch {
    return result('blocked', 'inspection_failed');
  }
  if (mode === 'inspect') return result('inspected', 'read_only');

  for (let i = 0; i < TARGETS.length; i++) {
    if (users[i].state !== 'missing') continue;
    const target = TARGETS[i];
    // A failed POST or readback may have created an account: never retry or delete.
    users[i].state = 'uncertain';
    try {
      const created = await request('', 'POST', { email: target.email, password, email_confirm: true,
        app_metadata: { desired_role: target.desired_role, active: false, must_change_password: true } });
      if (!matches(created, target)) throw new Error();
      const verified = await request(`/${created.id}`);
      if (verified.id !== created.id || !matches(verified, target)) throw new Error();
      users[i].state = 'created';
    } catch {
      return result('partial', 'creation_or_readback_uncertain');
    }
  }
  return result('complete', 'identities_staged_not_operational');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, project, ...extra] = process.argv.slice(2);
  const result = await bootstrap({ mode: extra.length ? 'invalid' : mode, project,
    password: process.env.LEGALTY_BOOTSTRAP_PASSWORD });
  console.log(JSON.stringify(result));
  process.exitCode = ['complete', 'inspected'].includes(result.status) ? 0 : 1;
}
