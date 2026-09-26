import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parsePublicConfiguration } from '../configuration.ts';
import { resolveAccess } from '../auth/access.ts';

type CookieBridge = Required<Pick<CookieMethodsServer, 'getAll' | 'setAll'>>;
type Options = { cookies: CookieBridge; auth: { debug: false }; global: { fetch: typeof fetch } };
type Factory = (url: string, key: string, options: Options) => SupabaseClient;

// Server-only callers supply a NEW cookie bridge for every request.
// The bridge must propagate every cookie and all cache headers, including on redirects.
export function createRequestClient(
  environment: Readonly<Record<string, string | undefined>>,
  cookies: CookieBridge,
  factory: Factory = createServerClient,
) {
  const configuration = parsePublicConfiguration(environment);
  if (!configuration) throw new Error('Unavailable configuration');
  return factory(configuration.url, configuration.publishableKey, {
    cookies, auth: { debug: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init, cache: 'no-store',
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    }) },
  });
}

// The session-scoped client uses RLS, never a service-role credential.
export function accountAccess(client: SupabaseClient) {
  return resolveAccess({
    verifyIdentity: async () => {
      const { data, error } = await client.auth.getUser();
      if (error) return null;
      return data.user;
    },
    readOwnProfile: async id => {
      const { data, error } = await client.from('profiles')
        .select('id,role,active,must_change_password').eq('id', id).maybeSingle();
      if (error) return null;
      return data;
    },
    readAssurance: async () => {
      const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      return error ? null : data?.currentLevel;
    },
  });
}
