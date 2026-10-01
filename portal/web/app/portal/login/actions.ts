'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverClient } from '../../../lib/supabase/next-client';
import { mutateSession } from '../../../lib/auth/mutations';

async function perform(action: 'login' | 'logout', form: FormData) {
  const destination = await mutateSession(action, form, (await headers()).get('origin'),
    process.env.PORTAL_ORIGIN, async () => {
      const client = await serverClient(true);
      return {
        signIn: async (email, password) => !(await client.auth.signInWithPassword({ email, password })).error,
        signOut: async () => !(await client.auth.signOut({ scope: 'local' })).error,
      };
    });
  redirect(destination);
}

export async function login(form: FormData) { await perform('login', form); }
export async function logout(form: FormData) { await perform('logout', form); }
