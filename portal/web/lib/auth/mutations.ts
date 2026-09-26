export function trustedOrigin(origin: string | null, configured?: string, mode = process.env.NODE_ENV) {
  if (!configured) return mode !== 'production' && origin === 'http://127.0.0.1:3000';
  try {
    const parsed = new URL(configured);
    const transport = parsed.protocol === 'https:' || parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1';
    return transport && parsed.origin === configured && origin === configured;
  } catch { return false; }
}

type SessionActions = {
  signIn(email: string, password: string): Promise<boolean>;
  signOut(): Promise<boolean>;
};

export async function mutateSession(action: 'login' | 'logout', form: FormData,
  origin: string | null, configured: string | undefined, client: () => Promise<SessionActions>) {
  const failure = '/login?error=credentials';
  if (!trustedOrigin(origin, configured)) return failure;
  try {
    if (action === 'logout') return await (await client()).signOut() ? '/login' : '/account?error=logout';
    const email = form.get('email');
    const password = form.get('password');
    if (typeof email !== 'string' || !email.includes('@') || email.length > 254 ||
        typeof password !== 'string' || !password || password.length > 1024) return failure;
    return await (await client()).signIn(email.trim(), password) ? '/account' : failure;
  } catch {
    return action === 'logout' ? '/account?error=logout' : failure;
  }
}
