import test from 'node:test';
import assert from 'node:assert/strict';
import {
  documentLimits, isPdf, validateDocumentBytes, validateDocumentMetadata,
} from '../lib/documents/pdf.ts';
import {
  beginCaseUpload, finalizeCaseDocument,
  type CaseDocumentSource, type DocumentMeta,
} from '../lib/documents/upload.ts';

const origin = 'https://portal.example';
const caseId = '11111111-1111-4111-8111-111111111111';
const docOne = '22222222-2222-4222-8222-222222222222';
const docTwo = '33333333-3333-4333-8333-333333333333';

function pdfBytes(size = 8): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
  return bytes;
}

function uuid(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    reference: 'CASE-2026-001', title: 'Contract review', description: 'Visible summary',
    clientEmails: 'client@example.com', staffEmails: '',
    documents: [{ name: 'contract.pdf', size: 8 }],
    ...overrides,
  };
}

function fixture() {
  const calls: unknown[] = [];
  let participant = 0;
  const source: CaseDocumentSource = {
    access: async () => { calls.push(['access']); return { state: 'eligible', userId: 'admin-id', role: 'admin' }; },
    findParticipant: async (email, role) => {
      calls.push(['find', email, role]);
      participant++;
      return [{ id: uuid(participant), email, role }];
    },
    createCase: async input => { calls.push(['create', input]); return caseId; },
    beginDocuments: async (id, documents) => {
      calls.push(['begin', id, documents]);
      return documents.map((_document, index) => ({
        document_id: index === 0 ? docOne : docTwo,
        object_key: `${caseId}/${uuid(90 + index)}.pdf`,
      }));
    },
    signUpload: async objectKey => { calls.push(['sign', objectKey]); return { signedUrl: `https://project.supabase.co/storage/v1/object/upload/sign/case-documents/${objectKey}?token=token-${objectKey}` }; },
    finalizeDocument: async documentId => { calls.push(['finalize', documentId]); return true; },
  };
  return { source, calls };
}

test('document limits and PDF byte signature are explicit', () => {
  assert.deepEqual(documentLimits, { maxFiles: 5, maxFileBytes: 10 * 1024 * 1024, maxTotalBytes: 25 * 1024 * 1024 });
  assert.equal(isPdf(pdfBytes()), true);
  assert.equal(isPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46])), false, 'truncated signature');
  assert.equal(isPdf(new Uint8Array([0x50, 0x44, 0x46, 0x2d, 0x31])), false, 'shifted signature');
  assert.equal(isPdf(new Uint8Array(0)), false);
});

test('document metadata accepts the documented envelope and rejects every boundary breach', () => {
  const valid: DocumentMeta[] = [{ name: ' a.pdf ', size: 1 }];
  assert.equal(validateDocumentMetadata(valid), true);
  assert.equal(validateDocumentMetadata([]), true, 'zero documents is a valid envelope');
  assert.equal(validateDocumentMetadata([{ name: 'a.pdf', size: documentLimits.maxFileBytes }]), true);
  assert.equal(validateDocumentMetadata(Array.from({ length: 5 }, (_, i) => ({ name: `f${i}.pdf`, size: 1 }))), true);

  const invalid: [string, unknown][] = [
    ['too many files', Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.pdf`, size: 1 }))],
    ['zero size', [{ name: 'a.pdf', size: 0 }]],
    ['over per-file limit', [{ name: 'a.pdf', size: documentLimits.maxFileBytes + 1 }]],
    ['non-integer size', [{ name: 'a.pdf', size: 1.5 }]],
    ['over aggregate limit', [
      { name: 'a.pdf', size: documentLimits.maxFileBytes }, { name: 'b.pdf', size: documentLimits.maxFileBytes },
      { name: 'c.pdf', size: documentLimits.maxFileBytes },
    ]],
    ['empty name', [{ name: '   ', size: 1 }]],
    ['over name length', [{ name: `${'a'.repeat(256)}.pdf`, size: 1 }]],
    ['missing name', [{ size: 1 }]],
    ['not an object', [null]],
  ];
  for (const [label, value] of invalid) {
    assert.equal(validateDocumentMetadata(value as DocumentMeta[]), false, label);
  }
});

test('real bytes must match the declared name, size and PDF signature', () => {
  assert.equal(validateDocumentBytes('a.pdf', 8, pdfBytes()), true);
  assert.equal(validateDocumentBytes('a.pdf', 7, pdfBytes()), false, 'declared size mismatch');
  assert.equal(validateDocumentBytes('a.pdf', 8, new Uint8Array(8)), false, 'missing signature');
  assert.equal(validateDocumentBytes('a.pdf', 8, pdfBytes(11)), false, 'actual size mismatch');
  assert.equal(validateDocumentBytes('a.pdf', 0, new Uint8Array(0)), false, 'empty file');
});

test('malformed begin payloads fail closed with a specific reason before access or any write', async t => {
  const invalid: [string, unknown, string][] = [
    ['null payload', null, 'fields'],
    ['not an object', 'documents', 'fields'],
    ['unknown field', payload({ extra: true }), 'fields'],
    ['missing documents', (() => { const value = payload(); delete (value as Record<string, unknown>).documents; return value; })(), 'fields'],
    ['empty reference', payload({ reference: '   ' }), 'fields'],
    ['over-long reference', payload({ reference: 'r'.repeat(81) }), 'fields'],
    ['empty title', payload({ title: '' }), 'fields'],
    ['over-long title', payload({ title: 't'.repeat(201) }), 'fields'],
    ['empty client email', payload({ clientEmails: '   ' }), 'emails'],
    ['malformed client email', payload({ clientEmails: 'not-an-email' }), 'emails'],
    ['duplicate across client and staff', payload({ clientEmails: 'same@example.com', staffEmails: 'Same@example.com' }), 'emails'],
    ['documents not an array', payload({ documents: 'contract.pdf' }), 'documents'],
    ['document item malformed', payload({ documents: [{ name: 7, size: 8 }] }), 'documents'],
    ['document item unknown field', payload({ documents: [{ name: 'a.pdf', size: 8, path: '../x' }] }), 'documents'],
    ['too many documents', payload({ documents: Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.pdf`, size: 1 })) }), 'documents'],
    ['oversize document', payload({ documents: [{ name: 'a.pdf', size: documentLimits.maxFileBytes + 1 }] }), 'documents'],
    ['over aggregate limit', payload({ documents: Array.from({ length: 3 }, (_, i) => ({ name: `f${i}.pdf`, size: documentLimits.maxFileBytes })) }), 'documents'],
  ];
  for (const [label, value, reason] of invalid) await t.test(label, async () => {
    const { source, calls } = fixture();
    const result = await beginCaseUpload(value, origin, origin, source);
    assert.equal(result.state, 'invalid');
    if (result.state !== 'invalid') return;
    assert.equal(result.reason, reason);
    assert.deepEqual(calls, [], 'no access or write for invalid metadata');
  });
});

test('admin resolves participants, creates one case, begins documents and signs each object', async () => {
  const { source, calls } = fixture();
  const result = await beginCaseUpload(payload(), origin, origin, source);
  assert.equal(result.state, 'ok');
  if (result.state !== 'ok') return;
  assert.equal(result.caseId, caseId);
  assert.equal(result.uploads.length, 1);
  assert.equal(result.uploads[0].documentId, docOne);
  assert.equal(result.uploads[0].objectKey, `${caseId}/${uuid(90)}.pdf`);
  assert.equal(typeof result.uploads[0].signedUrl, 'string');
  assert.deepEqual(calls.map(call => Array.isArray(call) ? call[0] : call),
    ['access', 'find', 'create', 'begin', 'sign']);
});

test('zero documents creates the case without beginning or signing any object', async () => {
  const { source, calls } = fixture();
  const result = await beginCaseUpload(payload({ documents: [] }), origin, origin, source);
  assert.equal(result.state, 'ok');
  if (result.state !== 'ok') return;
  assert.equal(result.caseId, caseId);
  assert.deepEqual(result.uploads, [], 'no uploads for zero documents');
  assert.deepEqual(calls.map(call => Array.isArray(call) ? call[0] : call), ['access', 'find', 'create']);
});

test('a signing failure keeps the created case and leaves the document without a signed URL', async () => {
  const { source, calls } = fixture();
  source.signUpload = async () => { throw new Error('SIGNING_SECRET'); };
  const result = await beginCaseUpload(payload(), origin, origin, source);
  assert.equal(result.state, 'ok');
  if (result.state !== 'ok') return;
  assert.equal(result.caseId, caseId);
  assert.equal(result.uploads.length, 1);
  assert.equal(result.uploads[0].signedUrl, null);
  assert.equal(calls.some(call => Array.isArray(call) && call[0] === 'create'), true);
  assert.doesNotMatch(JSON.stringify(result), /SIGNING_SECRET/);
});

test('origin, access and provider failures fail closed with no secret leakage', async () => {
  const foreign = fixture();
  assert.equal((await beginCaseUpload(payload(), 'https://foreign.example', origin, foreign.source)).state, 'forbidden');
  assert.deepEqual(foreign.calls, []);

  const signedOut = fixture();
  signedOut.source.access = async () => ({ state: 'signed_out' });
  assert.equal((await beginCaseUpload(payload(), origin, origin, signedOut.source)).state, 'signed_out');
  assert.deepEqual(signedOut.calls, []);

  const forbidden = fixture();
  forbidden.source.access = async () => ({ state: 'eligible', userId: 'user-id', role: 'staff' });
  assert.equal((await beginCaseUpload(payload(), origin, origin, forbidden.source)).state, 'forbidden');
  assert.deepEqual(forbidden.calls, []);

  for (const operation of ['findParticipant', 'createCase'] as const) {
    const broken = fixture();
    broken.source[operation] = async () => { throw new Error('DATABASE_SECRET'); };
    const result = await beginCaseUpload(payload(), origin, origin, broken.source);
    assert.equal(result.state, 'failed');
    assert.doesNotMatch(JSON.stringify(result), /DATABASE_SECRET/);
  }
});

test('failed uploads expose the exact failing step without leaking provider details', async () => {
  const unresolved = fixture();
  unresolved.source.findParticipant = async () => [];
  const unresolvedResult = await beginCaseUpload(payload(), origin, origin, unresolved.source);
  assert.equal(unresolvedResult.state, 'failed');
  if (unresolvedResult.state === 'failed') assert.equal(unresolvedResult.reason, 'participants');

  const duplicate = fixture();
  duplicate.source.findParticipant = async (email, role) => [{ id: caseId, email, role }];
  const duplicateResult = await beginCaseUpload(payload({ clientEmails: 'one@example.com\ntwo@example.com' }), origin, origin, duplicate.source);
  assert.equal(duplicateResult.state, 'failed');
  if (duplicateResult.state === 'failed') assert.equal(duplicateResult.reason, 'participants');

  const badCreate = fixture();
  badCreate.source.createCase = async () => 'not-a-uuid';
  const badCreateResult = await beginCaseUpload(payload(), origin, origin, badCreate.source);
  assert.equal(badCreateResult.state, 'failed');
  if (badCreateResult.state === 'failed') assert.equal(badCreateResult.reason, 'create');

  const thrown = fixture();
  thrown.source.findParticipant = async () => { throw new Error('DATABASE_SECRET'); };
  const thrownResult = await beginCaseUpload(payload(), origin, origin, thrown.source);
  assert.equal(thrownResult.state, 'failed');
  if (thrownResult.state === 'failed') assert.equal(thrownResult.reason, 'provider');
  assert.doesNotMatch(JSON.stringify(thrownResult), /DATABASE_SECRET/);
});

test('finalize reports the verified storage outcome and rejects bad callers', async () => {
  const stored = fixture();
  assert.equal(await finalizeCaseDocument(docOne, stored.source), 'stored');
  assert.deepEqual(stored.calls.filter(call => Array.isArray(call) && call[0] === 'finalize'), [['finalize', docOne]]);

  const failed = fixture();
  failed.source.finalizeDocument = async () => false;
  assert.equal(await finalizeCaseDocument(docOne, failed.source), 'failed');

  const thrown = fixture();
  thrown.source.finalizeDocument = async () => { throw new Error('STORAGE_SECRET'); };
  assert.equal(await finalizeCaseDocument(docOne, thrown.source), 'failed');

  const invalid = fixture();
  assert.equal(await finalizeCaseDocument('not-a-uuid', invalid.source), 'invalid');
  assert.deepEqual(invalid.calls, []);

  const signedOut = fixture();
  signedOut.source.access = async () => ({ state: 'signed_out' });
  assert.equal(await finalizeCaseDocument(docOne, signedOut.source), 'signed_out');
  assert.deepEqual(signedOut.calls, []);

  const denied = fixture();
  denied.source.access = async () => ({ state: 'eligible', userId: 'user-id', role: 'client' });
  assert.equal(await finalizeCaseDocument(docOne, denied.source), 'forbidden');
  assert.deepEqual(denied.calls, []);
});
