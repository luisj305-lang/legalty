import 'server-only';
import { createClient } from '@supabase/supabase-js';

// This capability is never exported through an action/RPC or a browser client.
// It follows the same secret-key adapter boundary as password-completion.ts:
// only a modern secret key and the fixed LEGALTY project URL are accepted, and
// the key is never logged, returned or placed in a browser bundle.
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const secretKey = /^sb_secret_[A-Za-z0-9_-]+$/;
const legaltyUrl = 'https://tzgqcwnachuvzikxrozi.supabase.co';

export async function inviteClient(email: string): Promise<{ id: string } | null> {
  const key = process.env.SUPABASE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origin = process.env.PORTAL_ORIGIN;
  if (!key || !secretKey.test(key) || url !== legaltyUrl || !origin) return null;
  if (typeof email !== 'string' || !email || email.length > 254 || email.trim() !== email) return null;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init, cache: 'no-store', redirect: 'error',
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    }) },
  });
  try {
    const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/portal/invite`,
    });
    if (error) return null;
    const id = data?.user?.id;
    return typeof id === 'string' && uuid.test(id) ? { id } : null;
  } catch { return null; }
}
