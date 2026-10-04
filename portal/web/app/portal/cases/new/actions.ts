'use server';

import { headers } from 'next/headers';
import {
  beginCaseUpload as orchestrateBegin, finalizeCaseDocument as orchestrateFinalize,
  type CaseDocumentSource,
} from '../../../../lib/documents/upload';
import { validateDocumentBytes } from '../../../../lib/documents/pdf';
import { serverClient } from '../../../../lib/supabase/next-client';
import { accountAccess } from '../../../../lib/supabase/server';

// Builds one request-scoped source. No file bytes ever pass through here.
async function requestSource(): Promise<CaseDocumentSource> {
  let client: Awaited<ReturnType<typeof serverClient>> | undefined;
  const requestClient = async () => client ??= await serverClient(true);
  return {
    access: async () => accountAccess(await requestClient()),
    findParticipant: async (email, role) => {
      const { data, error } = await (await requestClient()).rpc('find_case_participant', {
        exact_email: email, expected_role: role,
      });
      if (error) throw new Error('Participant lookup failed');
      return data;
    },
    createCase: async input => {
      const { data, error } = await (await requestClient()).rpc('create_case', {
        case_reference: input.reference, case_title: input.title, case_description: input.description,
        client_ids: input.clientIds, staff_ids: input.staffIds,
      });
      if (error) throw new Error('Case creation failed');
      return data;
    },
    beginDocuments: async (caseId, documents) => {
      const { data, error } = await (await requestClient()).rpc('begin_case_documents', {
        target_case: caseId, document_names: documents.map(document => document.name),
        document_sizes: documents.map(document => document.size),
      });
      if (error) throw new Error('Document registration failed');
      return data;
    },
    signUpload: async objectKey => {
      const { data, error } = await (await requestClient()).storage.from('case-documents')
        .createSignedUploadUrl(objectKey);
      if (error) throw new Error('Upload signing failed');
      return data;
    },
    finalizeDocument: async documentId => {
      const session = await requestClient();
      const { data, error } = await session.rpc('get_case_document', { target_document: documentId });
      if (error) throw new Error('Document lookup failed');
      const row = Array.isArray(data) ? data[0] : null;
      const byteSize = row && (typeof row.byte_size === 'number' ? row.byte_size :
        typeof row.byte_size === 'string' ? Number(row.byte_size) : NaN);
      if (!row || typeof row.object_key !== 'string' || typeof row.file_name !== 'string' ||
          !Number.isInteger(byteSize)) throw new Error('Document lookup failed');
      let stored = false;
      try {
        const { data: blob, error: downloadError } = await session.storage.from('case-documents')
          .download(row.object_key);
        if (!downloadError && blob) {
          stored = validateDocumentBytes(row.file_name, byteSize, new Uint8Array(await blob.arrayBuffer()));
        }
      } catch { stored = false; }
      if (!stored) {
        try { await session.storage.from('case-documents').remove([row.object_key]); }
        catch { /* cleanup is best effort; the document stays failed either way */ }
      }
      const { error: finalizeError } = await session.rpc('finalize_case_document', {
        document_id: documentId, stored,
      });
      if (finalizeError) throw new Error('Document finalize failed');
      return stored;
    },
  };
}

export async function beginCaseUpload(payload: unknown) {
  return orchestrateBegin(payload, (await headers()).get('origin'), process.env.PORTAL_ORIGIN, await requestSource());
}

export async function finalizeCaseDocument(documentId: unknown) {
  return orchestrateFinalize(documentId, await requestSource());
}
