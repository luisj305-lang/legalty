// Pure parser for the administrator-only candidate directory. It validates the
// shape returned by the list_case_candidates RPC and never trusts provider data.
export type Candidate = { id: string; email: string; name: string | null; active: boolean };

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const email = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
// Mirrors the RPC limit so an unexpected oversized payload fails closed.
const maxCandidates = 1000;

export function parseCandidates(value: unknown): Candidate[] | null {
  if (!Array.isArray(value) || value.length > maxCandidates) return null;
  const candidates: Candidate[] = [];
  const ids = new Set<string>();
  const emails = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const name = row.name;
    if (typeof row.id !== 'string' || !uuid.test(row.id) ||
        typeof row.email !== 'string' || row.email.trim() !== row.email ||
        row.email.length > 254 || !email.test(row.email) ||
        (name !== null && (typeof name !== 'string' || name.trim() !== name || !name)) ||
        typeof row.active !== 'boolean') return null;
    const normalizedEmail = row.email.toLowerCase();
    if (ids.has(row.id) || emails.has(normalizedEmail)) return null;
    ids.add(row.id); emails.add(normalizedEmail);
    candidates.push({ id: row.id, email: row.email, name, active: row.active });
  }
  return candidates;
}
