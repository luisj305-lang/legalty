import type { Access } from '../auth/access.ts';
import { trustedOrigin } from '../auth/mutations.ts';

// Pure server-safe orchestration for administrator-driven client creation. The
// source supplies a request-scoped session access check, a secret-key invite
// capability and a session-scoped profile provisioning call; this module only
// validates input and orders the two provider steps. The invite step creates
// the Auth user, and the provisioning step requires that user to already exist.
export interface CreateClientSource {
  access(): Promise<Access>;
  invite(email: string): Promise<{ id: string } | null>;
  provisionProfile(userId: string, first_name: string, last_name: string | null,
    phone: string | null): Promise<unknown>;
}

const created = '/portal/cases/clients?created=1';
// The invitation already exists; the trusted profile still has to be created.
const provisionPending = '/portal/cases/clients?pending=profile';
const failed = '/portal/cases/clients?error=create';
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const email = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const fields = new Set(['email', 'first_name', 'last_name', 'phone']);

// Returns undefined for an invalid field, null for a blank (optional) value and
// the trimmed string otherwise.
function textField(form: FormData, name: string, maximum: number): string | null | undefined {
  const values = form.getAll(name);
  if (values.length !== 1 || typeof values[0] !== 'string') return undefined;
  const value = values[0].trim();
  if ([...value].length > maximum) return undefined;
  return value === '' ? null : value;
}

export async function submitCreateClient(form: FormData, origin: string | null,
  configured: string | undefined, source: CreateClientSource) {
  if (!trustedOrigin(origin, configured)) return failed;
  for (const name of new Set(form.keys())) {
    if ((!fields.has(name) && !name.startsWith('$ACTION_')) || form.getAll(name).length !== 1) return failed;
  }
  const address = textField(form, 'email', 254);
  const first = textField(form, 'first_name', 120);
  const last = textField(form, 'last_name', 120);
  const phone = textField(form, 'phone', 32);
  if (address === undefined || address === null || !email.test(address) ||
      first === undefined || first === null || last === undefined || phone === undefined) return failed;

  try {
    const access = await source.access();
    if (access.state === 'signed_out') return '/portal/login';
    if (access.state === 'setup_pending') return '/portal/account';
    if (access.role !== 'admin') return failed;
    const invited = await source.invite(address);
    if (!invited || typeof invited.id !== 'string' || !uuid.test(invited.id)) return failed;
    try {
      await source.provisionProfile(invited.id, first, last, phone);
      return created;
    } catch { return provisionPending; }
  } catch { return failed; }
}
