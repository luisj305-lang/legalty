'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverClient } from '../../../lib/supabase/next-client';
import { preparePasswordCompletion } from '../../../lib/supabase/password-completion';
import { setupPassword } from '../../../lib/auth/password-setup';

export async function changePassword(form: FormData) {
  // Lazily construct the session client only after origin and input validation.
  let client: Awaited<ReturnType<typeof serverClient>>;
  let verifiedId: string | undefined;
  const destination = await setupPassword(form, (await headers()).get('origin'), process.env.PORTAL_ORIGIN, {
    verifyIdentity: async () => {
      client = await serverClient(true);
      const { data, error } = await client.auth.getUser();
      verifiedId = error ? undefined : data.user?.id;
      return error ? null : data.user?.id ?? null;
    },
    prepareCompletion: async id => preparePasswordCompletion(id),
    updatePassword: async password => {
      const { data, error } = await client.auth.updateUser({ password });
      return !error && data.user?.id === verifiedId;
    },
    readRotation: async id => {
      const { data, error } = await client.from('profiles').select('must_change_password').eq('id', id).maybeSingle();
      return error ? null : data?.must_change_password;
    },
  });
  redirect(destination);
}
