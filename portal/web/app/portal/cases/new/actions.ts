'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { submitCase } from '../../../../lib/cases/create';
import { serverClient } from '../../../../lib/supabase/next-client';
import { accountAccess } from '../../../../lib/supabase/server';

export async function createCase(form: FormData) {
  let client: Awaited<ReturnType<typeof serverClient>> | undefined;
  const requestClient = async () => client ??= await serverClient(true);
  const destination = await submitCase(form, (await headers()).get('origin'), process.env.PORTAL_ORIGIN, {
    access: async () => accountAccess(await requestClient()),
    findParticipant: async (email, role) => {
      const { data, error } = await (await requestClient()).rpc('find_case_participant', {
        exact_email: email, expected_role: role,
      });
      if (error) throw new Error('Participant lookup failed');
      return data;
    },
    createCase: async input => {
      const { data, error } = await (await requestClient()).rpc('create_case', {
        case_reference: input.reference, case_title: input.title, case_description: input.description,
        client_ids: input.clientIds, staff_ids: input.staffIds,
      });
      if (error) throw new Error('Case creation failed');
      return data;
    },
  });
  redirect(destination);
}
