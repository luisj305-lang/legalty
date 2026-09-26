import type { Access } from '../auth/access.ts';
import { trustedOrigin } from '../auth/mutations.ts';
import { caseId } from './read.ts';
import { participantEmails, participantLookupId, type ParticipantRole } from './create.ts';

export type ParticipantSets = { clientIds: string[]; staffIds: string[] };
export type CaseParticipants = ParticipantSets & { clientEmails: string[]; staffEmails: string[] };
export interface ParticipantUpdateSource {
  access(): Promise<Access>;
  visibleCase(id: string): Promise<unknown>;
  findParticipant(email: string, role: ParticipantRole): Promise<unknown>;
  replaceParticipants(id: string, expected: ParticipantSets, desired: ParticipantSets): Promise<unknown>;
}

const fields = new Set(['clientEmails', 'staffEmails']);
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function canonicalIds(value: unknown, required: boolean) {
  if (!Array.isArray(value) || required && value.length === 0 || value.length > 100 ||
      value.some(id => typeof id !== 'string' || !uuid.test(id)) || new Set(value).size !== value.length) return null;
  return [...value].sort() as string[];
}

function canonicalSets(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const clientIds = canonicalIds(input.clientIds, true);
  const staffIds = canonicalIds(input.staffIds, false);
  if (!clientIds || !staffIds || clientIds.some(id => staffIds.includes(id))) return null;
  return { clientIds, staffIds };
}

export function parseCaseParticipants(value: unknown): CaseParticipants | null {
  if (!Array.isArray(value) || value.length > 200) return null;
  const clients: { id: string; email: string }[] = [];
  const staff: { id: string; email: string }[] = [];
  const ids = new Set<string>();
  const emails = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    if ((row.role !== 'client' && row.role !== 'staff') || typeof row.email !== 'string') return null;
    const id = participantLookupId([row], row.email, row.role);
    const normalizedEmail = row.email.toLowerCase();
    if (!id || ids.has(id) || emails.has(normalizedEmail)) return null;
    ids.add(id); emails.add(normalizedEmail);
    (row.role === 'client' ? clients : staff).push({ id, email: row.email });
  }
  if (clients.length < 1 || clients.length > 100 || staff.length > 100) return null;
  clients.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  staff.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { clientIds: clients.map(row => row.id), staffIds: staff.map(row => row.id),
    clientEmails: clients.map(row => row.email), staffEmails: staff.map(row => row.email) };
}

export async function submitParticipantUpdate(id: string, expectedValue: ParticipantSets, form: FormData,
  origin: string | null, configured: string | undefined, source: ParticipantUpdateSource) {
  if (!caseId(id)) return '/cases';
  const failure = `/cases/${id}/edit?error=participants`;
  if (!trustedOrigin(origin, configured)) return failure;
  for (const name of new Set(form.keys())) {
    if ((!fields.has(name) && !name.startsWith('$ACTION_')) || form.getAll(name).length !== 1) return failure;
  }
  const clientText = form.get('clientEmails');
  const staffText = form.get('staffEmails');
  if (typeof clientText !== 'string' || typeof staffText !== 'string' ||
      [...clientText].length > 25500 || [...staffText].length > 25500) return failure;
  const clientEmails = participantEmails(clientText.trim(), true);
  const staffEmails = participantEmails(staffText.trim(), false);
  const expected = canonicalSets(expectedValue);
  if (!clientEmails || !staffEmails || !expected ||
      new Set([...clientEmails, ...staffEmails].map(email => email.toLowerCase())).size !==
        clientEmails.length + staffEmails.length) return failure;

  try {
    const access = await source.access();
    if (access.state === 'signed_out') return '/login';
    if (access.state === 'setup_pending') return '/account';
    if (access.state !== 'eligible' || access.role !== 'admin') return `/cases/${id}`;
    const visible = await source.visibleCase(id);
    if (!visible || typeof visible !== 'object' || (visible as Record<string, unknown>).id !== id) return '/cases';
    const used = new Set<string>();
    const resolve = async (values: string[], role: ParticipantRole) => {
      const result: string[] = [];
      for (const email of values) {
        const participantId = participantLookupId(await source.findParticipant(email, role), email, role);
        if (!participantId || used.has(participantId)) return null;
        used.add(participantId); result.push(participantId);
      }
      return result.sort();
    };
    const clientIds = await resolve(clientEmails, 'client');
    if (!clientIds) return failure;
    const staffIds = await resolve(staffEmails, 'staff');
    if (!staffIds) return failure;
    const replaced = await source.replaceParticipants(id, expected, { clientIds, staffIds });
    return typeof replaced === 'boolean' ? `/cases/${id}` : failure;
  } catch { return failure; }
}
