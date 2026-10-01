import type { Access } from '../auth/access.ts';
import { trustedOrigin } from '../auth/mutations.ts';
import { caseId, statusLabels } from './read.ts';

export type CaseUpdateInput = { title: string; description: string;
  status: keyof typeof statusLabels; nextAction: string };
export interface CaseUpdateSource {
  access(): Promise<Access>;
  visibleCase(id: string): Promise<unknown>;
  updateCase(id: string, input: CaseUpdateInput): Promise<boolean>;
}

const fields = new Set(['title', 'description', 'status', 'nextAction']);
function field(form: FormData, name: string, maximum: number, required = false) {
  const values = form.getAll(name);
  if (values.length !== 1 || typeof values[0] !== 'string') return null;
  const value = values[0].trim();
  return [...value].length > maximum || required && !value ? null : value;
}

export async function submitCaseUpdate(id: string, form: FormData, origin: string | null,
  configured: string | undefined, source: CaseUpdateSource) {
  if (!caseId(id)) return '/portal/cases';
  const failure = `/portal/cases/${id}/edit?error=update`;
  if (!trustedOrigin(origin, configured)) return failure;
  for (const name of new Set(form.keys())) {
    if ((!fields.has(name) && !name.startsWith('$ACTION_')) || form.getAll(name).length !== 1) return failure;
  }
  const title = field(form, 'title', 200, true);
  const description = field(form, 'description', 10000);
  const status = field(form, 'status', 20);
  const nextAction = field(form, 'nextAction', 2000);
  if (title === null || description === null || status === null || nextAction === null ||
      !Object.hasOwn(statusLabels, status)) return failure;

  try {
    const access = await source.access();
    if (access.state === 'signed_out') return '/portal/login';
    if (access.state === 'setup_pending') return '/portal/account';
    if (access.state !== 'eligible' || access.role !== 'admin' && access.role !== 'staff') return `/portal/cases/${id}`;
    const visible = await source.visibleCase(id);
    if (!visible || typeof visible !== 'object' || (visible as Record<string, unknown>).id !== id) return '/portal/cases';
    const updated = await source.updateCase(id, {
      title, description, status: status as keyof typeof statusLabels, nextAction,
    });
    return updated ? `/portal/cases/${id}` : failure;
  } catch { return failure; }
}
