'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverClient } from '../../../../lib/supabase/next-client';
import { mutateMfa, type MfaState } from '../../../../lib/auth/mfa';

export async function updateMfa(_previous: MfaState, form: FormData): Promise<MfaState> {
  let client: Awaited<ReturnType<typeof serverClient>>;
  const result = await mutateMfa(form, (await headers()).get('origin'), process.env.PORTAL_ORIGIN, {
    identity: async () => {
      client = await serverClient(true);
      const { data, error } = await client.auth.getUser();
      return error ? null : data.user?.id ?? null;
    },
    factors: async () => {
      const { data, error } = await client.auth.mfa.listFactors();
      if (error) throw new Error('Unavailable factors');
      return data.all;
    },
    enroll: async () => {
      const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Legalty' });
      return error ? null : { id: data.id, svg: data.totp.qr_code };
    },
    verify: async (factorId, code) => !(await client.auth.mfa.challengeAndVerify({ factorId, code })).error,
    assurance: async () => {
      const verified = await client.auth.getUser();
      if (verified.error || !verified.data.user) return null;
      const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      return error ? null : data.currentLevel;
    },
  });
  if (result.state === 'verified') redirect('/portal/account');
  return result;
}
