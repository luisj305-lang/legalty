'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { submitCaseUpdate } from '../../../../lib/cases/update';
import { serverClient } from '../../../../lib/supabase/next-client';
import { accountAccess } from '../../../../lib/supabase/server';

export async function updateCase(id: string, form: FormData) {
  let client: Awaited<ReturnType<typeof serverClient>> | undefined;
  const requestClient = async () => client ??= await serverClient(true);
  const destination = await submitCaseUpdate(id, form, (await headers()).get('origin'), process.env.PORTAL_ORIGIN, {
    access: async () => accountAccess(await requestClient()),
    visibleCase: async caseId => {
      const { data, error } = await (await requestClient()).from('cases').select('id').eq('id', caseId).maybeSingle();
      if (error) throw new Error('Case scope lookup failed');
      return data;
    },
    updateCase: async (caseId, input) => {
      const { error } = await (await requestClient()).rpc('update_case', {
        target_case: caseId, case_title: input.title, case_description: input.description,
        case_status: input.status, case_next_action: input.nextAction,
      });
      if (error) throw new Error('Case update failed');
      return true;
    },
  });
  redirect(destination);
}
