import 'server-only';
import { redirect } from 'next/navigation';
import { serverClient } from '../supabase/next-client';
import { accountAccess } from '../supabase/server';
import { caseId, readCaseView } from './read';
import { parseCaseParticipants } from './participants';

export async function caseAdminAccess() {
  const client = await serverClient().catch(() => null);
  if (!client) redirect('/login');
  const access = await accountAccess(client);
  if (access.state === 'signed_out') redirect('/login');
  if (access.state === 'setup_pending') redirect('/account');
  if (access.role !== 'admin') redirect('/cases');
  return access;
}

export async function caseView(id?: string) {
  const client = await serverClient().catch(() => null);
  if (!client) redirect('/login');
  const view = await readCaseView({
    access: () => accountAccess(client),
    read: async target => {
      let query = client.from('cases').select('id,reference,title,description,status,next_action,updated_at');
      if (target) query = query.eq('id', target);
      const { data, error } = await query.order('updated_at', { ascending: false }).limit(50);
      if (error) throw new Error('Unavailable cases');
      return data;
    },
  }, id);
  if (view.state === 'signed_out') redirect('/login');
  if (view.state === 'setup_pending') redirect('/account');
  return view;
}

export async function caseParticipants(id: string) {
  if (!caseId(id)) return null;
  const client = await serverClient().catch(() => null);
  if (!client) redirect('/login');
  const access = await accountAccess(client);
  if (access.state === 'signed_out') redirect('/login');
  if (access.state === 'setup_pending') redirect('/account');
  if (access.role !== 'admin') redirect('/cases');
  const { data, error } = await client.rpc('get_case_participants', { target_case: id });
  return error ? null : parseCaseParticipants(data);
}
