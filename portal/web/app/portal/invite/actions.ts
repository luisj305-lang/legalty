'use server';

import { serverClient } from '../../../lib/supabase/next-client';

export type InviteSessionResult = 'ok' | 'invalid';

// Establishes the portal session from a Supabase invitation link, either from
// the implicit-flow tokens in the URL fragment or from a PKCE `?code=`. It only
// accepts bounded opaque tokens, never logs them and fails closed on any error.
export async function establishInviteSession(input: {
  accessToken?: string; refreshToken?: string; code?: string;
}): Promise<InviteSessionResult> {
  const accessToken = input?.accessToken;
  const refreshToken = input?.refreshToken;
  const code = input?.code;
  const client = await serverClient(true).catch(() => null);
  if (!client) return 'invalid';
  try {
    if (typeof code === 'string' && code.length > 0 && code.length <= 2048) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      return error ? 'invalid' : 'ok';
    }
    if (typeof accessToken === 'string' && typeof refreshToken === 'string' &&
        accessToken.length > 0 && accessToken.length <= 4096 &&
        refreshToken.length > 0 && refreshToken.length <= 4096) {
      const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      return error ? 'invalid' : 'ok';
    }
    return 'invalid';
  } catch { return 'invalid'; }
}
