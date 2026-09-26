import type { Access } from '../auth/access.ts';
import { trustedOrigin } from '../auth/mutations.ts';

type Role = 'client' | 'staff';
export type CaseCreateInput = {
  reference: string; title: string; description: string; clientIds: string[]; staffIds: string[];
};
export interface CaseCreateSource {
  access(): Promise<Access>;
  findParticipant(email: string, role: Role): Promise<unknown>;
  createCase(input: CaseCreateInput): Promise<unknown>;
}

const failure = '/cases/new?error=create';
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const email = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const fields = new Set(['reference', 'title', 'description', 'clientEmails', 'staffEmails']);

function field(form: FormData, name: string, maximum: number, required = true) {
  const values = form.getAll(name);
  if (values.length !== 1 || typeof values[0] !== 'string') return null;
  const value = values[0].trim();
  return ([...value].length > maximum || required && !value) ? null : value;
}

function emails(value: string, required: boolean) {
  const values = value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const normalized = values.map(item => item.toLowerCase());
  if (required && values.length === 0 || values.length > 100 || new Set(normalized).size !== values.length ||
      values.some(item => item.length > 254 || !email.test(item))) return null;
  return values;
}

function participant(value: unknown, expectedEmail: string, expectedRole: Role) {
  if (!Array.isArray(value) || value.length !== 1 || !value[0] || typeof value[0] !== 'object') return null;
  const row = value[0] as Record<string, unknown>;
  if (typeof row.id !== 'string' || !uuid.test(row.id) || typeof row.email !== 'string' ||
      row.email.trim() !== row.email || row.email.toLowerCase() !== expectedEmail.toLowerCase() ||
      !email.test(row.email) || row.role !== expectedRole) return null;
  return row.id;
}

export async function submitCase(form: FormData, origin: string | null,
  configured: string | undefined, source: CaseCreateSource) {
  if (!trustedOrigin(origin, configured)) return failure;
  for (const name of new Set(form.keys())) {
    if ((!fields.has(name) && !name.startsWith('$ACTION_')) || form.getAll(name).length !== 1) return failure;
  }
  const reference = field(form, 'reference', 80);
  const title = field(form, 'title', 200);
  const description = field(form, 'description', 10000, false);
  const clientText = field(form, 'clientEmails', 25500);
  const staffText = form.has('staffEmails') ? field(form, 'staffEmails', 25500, false) : '';
  if (reference === null || title === null || description === null || clientText === null || staffText === null) return failure;
  const clientEmails = emails(clientText, true);
  const staffEmails = emails(staffText, false);
  if (!clientEmails || !staffEmails || new Set([...clientEmails, ...staffEmails].map(item => item.toLowerCase())).size !==
      clientEmails.length + staffEmails.length) return failure;

  try {
    const access = await source.access();
    if (access.state === 'signed_out') return '/login';
    if (access.state === 'setup_pending') return '/account';
    if (access.state !== 'eligible' || access.role !== 'admin') return '/cases';
    const ids = new Set<string>();
    const resolve = async (values: string[], role: Role) => {
      const result: string[] = [];
      for (const exactEmail of values) {
        const id = participant(await source.findParticipant(exactEmail, role), exactEmail, role);
        if (!id || ids.has(id)) return null;
        ids.add(id); result.push(id);
      }
      return result;
    };
    const clientIds = await resolve(clientEmails, 'client');
    if (!clientIds) return failure;
    const staffIds = await resolve(staffEmails, 'staff');
    if (!staffIds) return failure;
    const result = await source.createCase({ reference, title, description, clientIds, staffIds });
    return typeof result === 'string' && uuid.test(result) ? `/cases/${result}` : failure;
  } catch { return failure; }
}
