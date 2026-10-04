import type { Access } from '../auth/access.ts';
import { trustedOrigin } from '../auth/mutations.ts';

// Administrator-only contact directory and editor. The parser validates the
// shape returned by the list_profile_contacts RPC and never trusts provider
// data; the editor validates a single local form and updates only the split
// names and phone.
export type ProfileContactRole = 'client' | 'staff' | 'admin';
export type ProfileContact = {
  id: string; email: string; first_name: string | null; last_name: string | null;
  phone: string | null; role: ProfileContactRole; active: boolean;
};

export interface ProfileContactSource {
  access(): Promise<Access>;
  updateProfileContact(id: string, first_name: string | null, last_name: string | null,
    phone: string | null): Promise<unknown>;
}

const saved = '/portal/cases/clients?saved=1';
const failed = '/portal/cases/clients?error=1';
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const email = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
// Mirrors the RPC limit so an unexpected oversized payload fails closed.
const maxContacts = 1000;
const roles = new Set<ProfileContactRole>(['client', 'staff', 'admin']);
const fields = new Set(['id', 'first_name', 'last_name', 'phone']);

export function parseProfileContacts(value: unknown): ProfileContact[] | null {
  if (!Array.isArray(value) || value.length > maxContacts) return null;
  const contacts: ProfileContact[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const first = row.first_name;
    const last = row.last_name;
    const phone = row.phone;
    if (typeof row.id !== 'string' || !uuid.test(row.id) ||
        typeof row.email !== 'string' || row.email.trim() !== row.email ||
        row.email.length > 254 || !email.test(row.email) ||
        (first !== null && (typeof first !== 'string' || first.trim() !== first || !first)) ||
        (last !== null && (typeof last !== 'string' || last.trim() !== last || !last)) ||
        (phone !== null && (typeof phone !== 'string' || phone.trim() !== phone || !phone)) ||
        typeof row.role !== 'string' || !roles.has(row.role as ProfileContactRole) ||
        typeof row.active !== 'boolean') return null;
    if (ids.has(row.id)) return null;
    ids.add(row.id);
    contacts.push({
      id: row.id, email: row.email, first_name: first, last_name: last, phone,
      role: row.role as ProfileContactRole, active: row.active,
    });
  }
  return contacts;
}

// Returns undefined for an invalid field, null for a blank (clear) value, and
// the trimmed string otherwise.
function contactField(form: FormData, name: string, maximum: number): string | null | undefined {
  const values = form.getAll(name);
  if (values.length !== 1 || typeof values[0] !== 'string') return undefined;
  const value = values[0].trim();
  if ([...value].length > maximum) return undefined;
  return value === '' ? null : value;
}

export async function submitProfileContact(form: FormData, origin: string | null,
  configured: string | undefined, source: ProfileContactSource) {
  if (!trustedOrigin(origin, configured)) return failed;
  for (const name of new Set(form.keys())) {
    if ((!fields.has(name) && !name.startsWith('$ACTION_')) || form.getAll(name).length !== 1) return failed;
  }
  const ids = form.getAll('id');
  if (ids.length !== 1 || typeof ids[0] !== 'string' || !uuid.test(ids[0])) return failed;
  const first = contactField(form, 'first_name', 120);
  const last = contactField(form, 'last_name', 120);
  const phone = contactField(form, 'phone', 32);
  if (first === undefined || last === undefined || phone === undefined) return failed;

  try {
    const access = await source.access();
    if (access.state !== 'eligible' || access.role !== 'admin') return failed;
    await source.updateProfileContact(ids[0], first, last, phone);
    return saved;
  } catch { return failed; }
}
