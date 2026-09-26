import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { completeRotation } from '../auth/complete-rotation';

// This capability is never exported through an action/RPC or a browser client.
export function preparePasswordCompletion(id: string) {
  const key = process.env.SUPABASE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !/^sb_secret_[A-Za-z0-9_-]+$/.test(key) ||
      url !== 'https://tzgqcwnachuvzikxrozi.supabase.co') return null;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init, cache: 'no-store', redirect: 'error',
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    }) },
  });
  return () => completeRotation(client, id);
}
