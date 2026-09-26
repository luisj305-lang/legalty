export interface AccessSource {
  verifyIdentity(): Promise<unknown>;
  readOwnProfile(userId: string): Promise<unknown>;
  readAssurance(): Promise<unknown>;
}

export type Access = { state: 'signed_out' } |
  { state: 'setup_pending'; userId: string } |
  { state: 'eligible'; userId: string; role: 'client' | 'staff' | 'admin' };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

// Eligible is a prerequisite only, not permission to any case or operational route.
export async function resolveAccess(source: AccessSource): Promise<Access> {
  let userId: string;
  try {
    const identity = record(await source.verifyIdentity());
    if (typeof identity.id !== 'string' || !identity.id || identity.id.trim() !== identity.id) {
      return { state: 'signed_out' };
    }
    userId = identity.id;
  } catch {
    return { state: 'signed_out' };
  }
  const pending: Access = { state: 'setup_pending', userId };
  try {
    const profile = record(await source.readOwnProfile(userId));
    const role = profile.role;
    if (profile.id !== userId || profile.active !== true || profile.must_change_password !== false ||
        (role !== 'client' && role !== 'staff' && role !== 'admin')) return pending;
    const assurance = await source.readAssurance();
    if (assurance !== 'aal2' && !(role === 'client' && assurance === 'aal1')) return pending;
    return { state: 'eligible', userId, role };
  } catch {
    // Absent tables, revoked access, malformed data and provider errors fail closed.
    return pending;
  }
}
