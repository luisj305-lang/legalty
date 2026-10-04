import 'server-only';
import { redirect } from 'next/navigation';
import { serverClient } from '../supabase/next-client';
import { accountAccess } from '../supabase/server';
import { caseId, readCaseView } from './read';
import { parseCaseParticipants } from './participants';
import { parseCandidates, type Candidate } from './directory';
import { parseProfileContacts, type ProfileContact } from './contacts';
import type { NavRole } from './nav';

export async function caseAdminAccess() {
  const client = await serverClient().catch(() => null);
  if (!client) redirect('/portal/login');
  const access = await accountAccess(client);
  if (access.state === 'signed_out') redirect('/portal/login');
  if (access.state === 'setup_pending') redirect('/portal/account');
  if (access.role !== 'admin') redirect('/portal/cases');
  return access;
}

// Non-redirecting role lookup for navigation. Provider or access failures
// degrade to null so the sidebar never throws; route-level gates still enforce
// authorization for the pages themselves.
export async function viewerRole(): Promise<NavRole> {
  const client = await serverClient().catch(() => null);
  if (!client) return null;
  try {
    const access = await accountAccess(client);
    return access.state === 'eligible' ? access.role : null;
  } catch {
    return null;
  }
}

export async function caseView(id?: string) {
  const client = await serverClient().catch(() => null);
  if (!client) redirect('/portal/login');
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
  if (view.state === 'signed_out') redirect('/portal/login');
  if (view.state === 'setup_pending') redirect('/portal/account');
  return view;
}

export async function caseParticipants(id: string) {
  if (!caseId(id)) return null;
  const client = await serverClient().catch(() => null);
  if (!client) redirect('/portal/login');
  const access = await accountAccess(client);
  if (access.state === 'signed_out') redirect('/portal/login');
  if (access.state === 'setup_pending') redirect('/portal/account');
  if (access.role !== 'admin') redirect('/portal/cases');
  const { data, error } = await client.rpc('get_case_participants', { target_case: id });
  return error ? null : parseCaseParticipants(data);
}

// Administrator-only directory of registered profiles eligible as participants.
// Any provider or parse failure degrades to empty lists; the page never throws.
export async function participantDirectory(): Promise<{ clients: Candidate[]; staff: Candidate[] }> {
  await caseAdminAccess();
  const client = await serverClient().catch(() => null);
  const read = async (role: 'client' | 'staff'): Promise<Candidate[]> => {
    if (!client) return [];
    try {
      const { data, error } = await client.rpc('list_case_candidates', { expected_role: role });
      return error ? [] : parseCandidates(data) ?? [];
    } catch { return []; }
  };
  const [clients, staff] = await Promise.all([read('client'), read('staff')]);
  return { clients, staff };
}

// Administrator-only directory of every registered profile with its stored
// contact fields, used by the contacts screen. Any provider or parse failure
// degrades to an empty list; the page never throws.
export async function profileContacts(): Promise<ProfileContact[]> {
  await caseAdminAccess();
  const client = await serverClient().catch(() => null);
  if (!client) return [];
  try {
    const { data, error } = await client.rpc('list_profile_contacts');
    return error ? [] : parseProfileContacts(data) ?? [];
  } catch { return []; }
}
