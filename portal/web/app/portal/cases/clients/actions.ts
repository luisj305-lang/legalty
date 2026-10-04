'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { submitProfileContact, type ProfileContactSource } from '../../../../lib/cases/contacts';
import { submitCreateClient, type CreateClientSource } from '../../../../lib/cases/create-client';
import { serverClient } from '../../../../lib/supabase/next-client';
import { accountAccess } from '../../../../lib/supabase/server';
import { inviteClient } from '../../../../lib/supabase/admin-users';

// Builds one request-scoped session client shared by every source below. The
// provider capabilities are only reachable through the validated orchestration
// in submitProfileContact / submitCreateClient.
function lazyRequestClient() {
  let client: Awaited<ReturnType<typeof serverClient>> | undefined;
  return async () => client ??= await serverClient(true);
}

async function requestSource(): Promise<ProfileContactSource> {
  const requestClient = lazyRequestClient();
  return {
    access: async () => accountAccess(await requestClient()),
    updateProfileContact: async (id, first, last, phone) => {
      const { error } = await (await requestClient()).rpc('update_profile_contact', {
        target_profile: id, new_first_name: first, new_last_name: last, new_phone: phone,
      });
      if (error) throw new Error('Contact update failed');
    },
  };
}

async function createSource(): Promise<CreateClientSource> {
  const requestClient = lazyRequestClient();
  return {
    access: async () => accountAccess(await requestClient()),
    // The invite uses the server-only secret-key adapter; provisioning uses the
    // administrator's own session so the RPC's trusted admin guard applies.
    invite: async (email) => inviteClient(email),
    provisionProfile: async (userId, first, last, phone) => {
      const { error } = await (await requestClient()).rpc('provision_client_profile', {
        target_user: userId, client_first_name: first, client_last_name: last, client_phone: phone,
      });
      if (error) throw new Error('Profile provisioning failed');
    },
  };
}

export async function saveProfileContact(form: FormData) {
  const destination = await submitProfileContact(
    form, (await headers()).get('origin'), process.env.PORTAL_ORIGIN, await requestSource());
  redirect(destination);
}

export async function createClientAccount(form: FormData) {
  const destination = await submitCreateClient(
    form, (await headers()).get('origin'), process.env.PORTAL_ORIGIN, await createSource());
  redirect(destination);
}
