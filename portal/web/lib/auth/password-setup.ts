import { trustedOrigin } from './mutations.ts';

export interface PasswordSource {
  verifyIdentity(): Promise<string | null>;
  prepareCompletion(userId: string): Promise<(() => Promise<boolean>) | null>;
  updatePassword(password: string): Promise<boolean>;
  readRotation(userId: string): Promise<unknown>;
}

export async function setupPassword(form: FormData, origin: string | null,
  configured: string | undefined, source: PasswordSource) {
  const failure = '/setup/password?error=update';
  if (!trustedOrigin(origin, configured)) return failure;
  for (const name of form.keys()) {
    if (!['password', 'confirmation'].includes(name) && !name.startsWith('$ACTION_')) return failure;
  }
  const password = form.get('password');
  if (form.getAll('password').length !== 1 || form.getAll('confirmation').length !== 1 ||
      typeof password !== 'string' || [...password].length < 12 ||
      new TextEncoder().encode(password).length > 72 || password !== form.get('confirmation')) return failure;
  try {
    const id = await source.verifyIdentity();
    if (!id || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return '/login';
    // Fail before changing credentials if trusted completion is not configured.
    const complete = await source.prepareCompletion(id);
    if (!complete || !await source.updatePassword(password)) return failure;
    if (!await complete() || await source.readRotation(id) !== false) return failure;
    return '/setup/password?status=updated';
  } catch { return failure; }
}
