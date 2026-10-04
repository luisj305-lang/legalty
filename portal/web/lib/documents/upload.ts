import type { Access } from '../auth/access.ts';
import { trustedOrigin } from '../auth/mutations.ts';
import {
  participantEmails, participantLookupId,
  type CaseCreateInput, type ParticipantRole,
} from '../cases/create.ts';
import { validateDocumentMetadata } from './pdf.ts';

export type DocumentMeta = { name: string; size: number };
export type BeginUpload = { documentId: string; objectKey: string; signedUrl: string | null };
export type BeginInvalidReason = 'fields' | 'emails' | 'documents';
export type BeginFailedReason = 'participants' | 'create' | 'provider';
export type BeginResult =
  | { state: 'signed_out' }
  | { state: 'setup_pending' }
  | { state: 'forbidden' }
  | { state: 'invalid'; reason: BeginInvalidReason }
  | { state: 'failed'; reason: BeginFailedReason }
  | { state: 'ok'; caseId: string; uploads: BeginUpload[] };
export type FinalizeResult = 'stored' | 'failed' | 'signed_out' | 'setup_pending' | 'forbidden' | 'invalid';

// The action supplies every side effect; this orchestration stays pure and testable.
export interface CaseDocumentSource {
  access(): Promise<Access>;
  findParticipant(email: string, role: ParticipantRole): Promise<unknown>;
  createCase(input: CaseCreateInput): Promise<unknown>;
  beginDocuments(caseId: string, documents: DocumentMeta[]): Promise<unknown>;
  signUpload(objectKey: string): Promise<unknown>;
  finalizeDocument(documentId: string): Promise<boolean>;
}

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const beginFields = new Set(['reference', 'title', 'description', 'clientEmails', 'staffEmails', 'documents']);
const documentFields = new Set(['name', 'size']);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function bounded(value: unknown, maximum: number, required: boolean) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return [...trimmed].length > maximum || required && !trimmed ? null : trimmed;
}

type BeginPayload = {
  reference: string; title: string; description: string;
  clientEmails: string[]; staffEmails: string[]; documents: DocumentMeta[];
};

type BeginParseResult =
  | { ok: true; value: BeginPayload }
  | { ok: false; reason: BeginInvalidReason };

function parseBeginPayload(value: unknown): BeginParseResult {
  if (!record(value)) return { ok: false, reason: 'fields' };
  for (const key of Object.keys(value)) if (!beginFields.has(key)) return { ok: false, reason: 'fields' };
  for (const key of beginFields) if (!(key in value)) return { ok: false, reason: 'fields' };
  const reference = bounded(value.reference, 80, true);
  const title = bounded(value.title, 200, true);
  const description = bounded(value.description, 10000, false);
  if (reference === null || title === null || description === null) return { ok: false, reason: 'fields' };
  if (typeof value.clientEmails !== 'string' || typeof value.staffEmails !== 'string') return { ok: false, reason: 'emails' };
  const clientEmails = participantEmails(value.clientEmails, true);
  const staffEmails = participantEmails(value.staffEmails, false);
  if (!clientEmails || !staffEmails ||
      new Set([...clientEmails, ...staffEmails].map(email => email.toLowerCase())).size !==
        clientEmails.length + staffEmails.length) return { ok: false, reason: 'emails' };
  if (!Array.isArray(value.documents)) return { ok: false, reason: 'documents' };
  const documents: DocumentMeta[] = [];
  for (const item of value.documents) {
    if (!record(item)) return { ok: false, reason: 'documents' };
    for (const key of Object.keys(item)) if (!documentFields.has(key)) return { ok: false, reason: 'documents' };
    if (typeof item.name !== 'string' || typeof item.size !== 'number') return { ok: false, reason: 'documents' };
    documents.push({ name: item.name, size: item.size });
  }
  if (!validateDocumentMetadata(documents)) return { ok: false, reason: 'documents' };
  return { ok: true, value: { reference, title, description, clientEmails, staffEmails, documents } };
}

function parseDocumentRows(value: unknown, caseId: string, expected: number) {
  if (!Array.isArray(value) || value.length !== expected) return null;
  const rows: { documentId: string; objectKey: string }[] = [];
  for (const item of value) {
    if (!record(item) || typeof item.document_id !== 'string' || !uuid.test(item.document_id) ||
        typeof item.object_key !== 'string' || !item.object_key.startsWith(`${caseId}/`) ||
        item.object_key.includes('..') || !/\.pdf$/.test(item.object_key)) return null;
    rows.push({ documentId: item.document_id, objectKey: item.object_key });
  }
  return rows;
}

function parseSignedUrl(value: unknown) {
  if (!record(value) || typeof value.signedUrl !== 'string' || !value.signedUrl) return null;
  try {
    const url = new URL(value.signedUrl);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.pathname.includes('/object/upload/sign/')) return null;
    return value.signedUrl;
  } catch { return null; }
}

// Phase 1: no bytes travel here, only validated metadata and signed upload URLs.
export async function beginCaseUpload(payload: unknown, origin: string | null,
  configured: string | undefined, source: CaseDocumentSource): Promise<BeginResult> {
  const parsed = parseBeginPayload(payload);
  if (!parsed.ok) return { state: 'invalid', reason: parsed.reason };
  const input = parsed.value;
  if (!trustedOrigin(origin, configured)) return { state: 'forbidden' };
  try {
    const access = await source.access();
    if (access.state === 'signed_out') return { state: 'signed_out' };
    if (access.state === 'setup_pending') return { state: 'setup_pending' };
    if (access.state !== 'eligible' || access.role !== 'admin') return { state: 'forbidden' };
    const used = new Set<string>();
    const resolve = async (emails: string[], role: ParticipantRole) => {
      const ids: string[] = [];
      for (const email of emails) {
        const id = participantLookupId(await source.findParticipant(email, role), email, role);
        if (!id || used.has(id)) return null;
        used.add(id); ids.push(id);
      }
      return ids;
    };
    const clientIds = await resolve(input.clientEmails, 'client');
    if (!clientIds) return { state: 'failed', reason: 'participants' };
    const staffIds = await resolve(input.staffEmails, 'staff');
    if (!staffIds) return { state: 'failed', reason: 'participants' };

    const created = await source.createCase({
      reference: input.reference, title: input.title, description: input.description, clientIds, staffIds,
    });
    if (typeof created !== 'string' || !uuid.test(created)) return { state: 'failed', reason: 'create' };
    const caseId = created;

    // Documents are optional: a case with zero attachments never registers or signs an object.
    if (input.documents.length === 0) return { state: 'ok', caseId, uploads: [] };

    let rows: { documentId: string; objectKey: string }[] | null = null;
    try { rows = parseDocumentRows(await source.beginDocuments(caseId, input.documents), caseId, input.documents.length); }
    catch { rows = null; }
    if (!rows) return { state: 'ok', caseId, uploads: [] };

    const uploads: BeginUpload[] = [];
    for (const row of rows) {
      let signedUrl: string | null = null;
      try { signedUrl = parseSignedUrl(await source.signUpload(row.objectKey)); } catch { signedUrl = null; }
      uploads.push({ documentId: row.documentId, objectKey: row.objectKey, signedUrl });
    }
    return { state: 'ok', caseId, uploads };
  } catch { return { state: 'failed', reason: 'provider' }; }
}

// Phase 3: the caller already downloaded the object; this reports the verified outcome.
export async function finalizeCaseDocument(documentId: unknown, source: CaseDocumentSource): Promise<FinalizeResult> {
  if (typeof documentId !== 'string' || !uuid.test(documentId)) return 'invalid';
  try {
    const access = await source.access();
    if (access.state === 'signed_out') return 'signed_out';
    if (access.state === 'setup_pending') return 'setup_pending';
    if (access.state !== 'eligible' || access.role !== 'admin') return 'forbidden';
    return await source.finalizeDocument(documentId) ? 'stored' : 'failed';
  } catch { return 'failed'; }
}
