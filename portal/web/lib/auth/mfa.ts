import { trustedOrigin } from './mutations.ts';

export type Factor = { id: string; factor_type: string; status: string };
export type MfaState = { state: 'idle' | 'error' | 'verified' } |
  { state: 'enrolled'; factorId: string; qr: string };
export interface MfaSource {
  identity(): Promise<string | null>;
  factors(): Promise<Factor[]>;
  enroll(): Promise<{ id: string; svg: string } | null>;
  verify(id: string, code: string): Promise<boolean>;
  assurance(): Promise<string | null>;
}

export async function mutateMfa(form: FormData, origin: string | null,
  configured: string | undefined, source: MfaSource): Promise<MfaState> {
  const failure: MfaState = { state: 'error' };
  if (!trustedOrigin(origin, configured)) return failure;
  for (const name of form.keys()) {
    if (!['intent', 'factorId', 'code'].includes(name) && !name.startsWith('$ACTION_')) return failure;
    if (form.getAll(name).length !== 1) return failure;
  }
  try {
    if (!await source.identity()) return failure;
    const factors = await source.factors();
    if (form.get('intent') === 'enroll') {
      if (factors.some(f => f.factor_type === 'totp')) return failure;
      const enrollment = await source.enroll();
      // auth-js wraps raw provider SVG in this data URI; re-encode the image payload.
      const svg = enrollment?.svg.replace(/^data:image\/svg\+xml;utf-8,/, '');
      if (!enrollment?.id || !svg?.startsWith('<svg') || svg.length > 100000) return failure;
      return { state: 'enrolled', factorId: enrollment.id,
        qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
    }
    const id = form.get('factorId');
    const code = form.get('code');
    if (form.get('intent') !== 'verify' || typeof id !== 'string' || typeof code !== 'string' ||
        !/^\d{6}$/.test(code) || !factors.some(f => f.id === id && f.factor_type === 'totp' &&
          ['verified', 'unverified'].includes(f.status))) return failure;
    if (!await source.verify(id, code) || await source.assurance() !== 'aal2') return failure;
    return { state: 'verified' };
  } catch { return failure; }
}
