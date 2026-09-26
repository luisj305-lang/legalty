import type { Access } from '../auth/access.ts';

export const statusLabels = { open: 'Abierto', in_progress: 'En gestión', waiting: 'En espera', closed: 'Cerrado' };
export type CaseRow = { id: string; reference: string; title: string; description: string;
  status: keyof typeof statusLabels; next_action: string; updated_at: string };
type Source = { access(): Promise<Access>; read(id?: string): Promise<unknown> };
type Result = Exclude<Access, { state: 'eligible' }> | { state: 'error' | 'not_found' } |
  { state: 'ready'; role: 'client' | 'staff' | 'admin'; rows: CaseRow[] };
export const caseId = (id: string) => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);

export async function readCaseView(source: Source, id?: string): Promise<Result> {
  try {
    const access = await source.access();
    if (access.state !== 'eligible') return access;
    if (id !== undefined && !caseId(id)) return { state: 'not_found' };
    const data = await source.read(id);
    if (!Array.isArray(data) || data.length > 50) return { state: 'error' };
    const rows: CaseRow[] = [];
    for (const value of data) {
      if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !caseId(value.id) ||
          !Object.hasOwn(statusLabels, value.status) ||
          !['reference','title','description','next_action','updated_at'].every(k => typeof value[k] === 'string') ||
          !Number.isFinite(Date.parse(value.updated_at))) return { state: 'error' };
      const { id, reference, title, description, status, next_action, updated_at } = value;
      rows.push({ id, reference, title, description, status, next_action, updated_at });
    }
    if (id && (!rows.length || rows.length !== 1 || rows[0].id !== id)) return { state: 'not_found' };
    return { state: 'ready', role: access.role, rows };
  } catch { return { state: 'error' }; }
}

export function summarizeCases(rows: CaseRow[]) {
  return { total: rows.length, active: rows.filter(r => ['open','in_progress'].includes(r.status)).length,
    waiting: rows.filter(r => r.status === 'waiting').length, closed: rows.filter(r => r.status === 'closed').length };
}
