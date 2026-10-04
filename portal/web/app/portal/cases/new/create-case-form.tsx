'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { beginCaseUpload, finalizeCaseDocument } from './actions';
import type { BeginFailedReason, BeginInvalidReason } from '../../../../lib/documents/upload';
import type { Candidate } from '../../../../lib/cases/directory';
import { documentLimits } from '../../../../lib/documents/pdf';
import { MultiSelect } from './multi-select';
import styles from '../cases.module.css';

const genericError = 'No fue posible crear el caso. Revisa los datos e intenta nuevamente.';
const noClientError = 'Debes seleccionar al menos un cliente de la lista.';

const tooManyFilesError = `Máximo ${documentLimits.maxFiles} archivos PDF por caso.`;
const fileTooLargeError = `Cada PDF debe pesar como máximo ${documentLimits.maxFileBytes / (1024 * 1024)} MB.`;
const totalTooLargeError = `El total de los PDFs no puede superar ${documentLimits.maxTotalBytes / (1024 * 1024)} MB.`;
const invalidError: Record<BeginInvalidReason, string> = {
  documents: 'Revisa los datos. Máximo 5 PDFs, 10 MB por archivo y 25 MB en total.',
  emails: 'Revisá los correos: un email exacto por línea y no repitas el mismo correo entre clientes y equipo.',
  fields: 'Revisá la referencia, el título y la descripción.',
};
const failedError: Record<BeginFailedReason, string> = {
  participants: 'No encontramos coincidencia con esos correos. Usá correos de usuarios ya registrados con el rol correcto (cliente para clientes, equipo para staff).',
  create: genericError,
  provider: genericError,
};

export function CreateCaseForm({ supabaseUrl, supabaseKey, failed, clients, staff }: {
  supabaseUrl: string; supabaseKey: string; failed?: string;
  clients: Candidate[]; staff: Candidate[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const describedBy = error || failed ? 'case-create-error' : undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true); setError(null); setFailures([]);
    try {
      const selected = (name: string) => data.getAll(name)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
      const clientEmails = selected('clientEmails');
      const staffEmails = selected('staffEmails');
      // Client-side pre-checks are UX only; the server action stays authoritative.
      if (clientEmails.length === 0) { setError(noClientError); return; }
      const files = data.getAll('documents').filter((value): value is File => value instanceof File && value.size > 0);
      if (files.length > documentLimits.maxFiles) { setError(tooManyFilesError); return; }
      if (files.some(file => file.size > documentLimits.maxFileBytes)) { setError(fileTooLargeError); return; }
      if (files.reduce((total, file) => total + file.size, 0) > documentLimits.maxTotalBytes) { setError(totalTooLargeError); return; }
      const result = await beginCaseUpload({
        reference: String(data.get('reference') ?? ''),
        title: String(data.get('title') ?? ''),
        description: String(data.get('description') ?? ''),
        clientEmails: clientEmails.join('\n'),
        staffEmails: staffEmails.join('\n'),
        documents: files.map(file => ({ name: file.name, size: file.size })),
      });
      if (result.state === 'signed_out') { router.push('/portal/login'); return; }
      if (result.state === 'setup_pending') { router.push('/portal/account'); return; }
      if (result.state === 'forbidden') { router.push('/portal/cases'); return; }
      if (result.state === 'invalid') {
        setError(invalidError[result.reason]);
        return;
      }
      if (result.state === 'failed') { setError(failedError[result.reason]); return; }
      setCreatedCaseId(result.caseId);

      const client = createClient(supabaseUrl, supabaseKey);
      const failedNames: string[] = [];
      for (let index = 0; index < result.uploads.length; index++) {
        const upload = result.uploads[index];
        const file = files[index];
        if (!file) continue;
        try {
          const token = upload.signedUrl ? new URL(upload.signedUrl).searchParams.get('token') : null;
          if (!token) throw new Error('Missing token');
          const { error: uploadError } = await client.storage.from('case-documents')
            .uploadToSignedUrl(upload.objectKey, token, file, { contentType: 'application/pdf', upsert: false });
          if (uploadError) throw uploadError;
        } catch { failedNames.push(file.name); }
      }
      for (let index = 0; index < result.uploads.length; index++) {
        const file = files[index];
        let outcome = 'failed';
        try { outcome = await finalizeCaseDocument(result.uploads[index].documentId); }
        catch { outcome = 'failed'; }
        if (outcome !== 'stored' && file && !failedNames.includes(file.name)) failedNames.push(file.name);
      }
      if (failedNames.length > 0 || result.uploads.length !== files.length) {
        setFailures(failedNames);
        setError('El caso fue creado, pero algunos documentos no se guardaron. Vuelve a intentarlo desde el caso.');
        return;
      }
      router.push(`/portal/cases/${result.caseId}`);
    } catch {
      setError(genericError);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {(error || failed) && <p className={styles.formError} id="case-create-error" role="alert">
        {error ?? genericError}
        {failures.length > 0 && <ul>{failures.map(name => <li key={name}>{name}</li>)}</ul>}
      </p>}
      {createdCaseId && error && <p><a href={`/portal/cases/${createdCaseId}`}>Ir al caso creado</a></p>}
      <form onSubmit={onSubmit} className={styles.caseForm} aria-describedby={describedBy}>
        <div><label htmlFor="reference">Referencia</label>
          <input id="reference" name="reference" maxLength={80} required /></div>
        <div><label htmlFor="title">Título</label>
          <input id="title" name="title" maxLength={200} required /></div>
        <div><label htmlFor="description">Descripción visible para clientes</label>
          <textarea id="description" name="description" rows={6} maxLength={10000} /></div>
        <div>
          <MultiSelect name="clientEmails" label="Clientes" candidates={clients} required
            helpId="client-help" emptyText="No hay clientes cargados todavía." disabled={pending} />
          <small id="client-help">Selecciona uno o más clientes de la lista. Debes incluir al menos un cliente.</small>
        </div>
        <div>
          <MultiSelect name="staffEmails" label="Equipo (opcional)" candidates={staff}
            helpId="staff-help" emptyText="No hay miembros del equipo cargados todavía." disabled={pending} />
          <small id="staff-help">Selecciona los miembros del equipo (opcional). Solo se aceptan perfiles con rol de equipo.</small>
        </div>
        <div><label htmlFor="documents">Documentos PDF</label>
          <input id="documents" name="documents" type="file" accept="application/pdf,.pdf" multiple aria-describedby="documents-help" />
          <small id="documents-help">Máximo 5 archivos PDF, 10 MB por archivo y 25 MB en total. Los documentos son internos.</small></div>
        <div className={styles.formActions}><button type="submit" disabled={pending}>{pending ? 'Creando…' : 'Crear caso'}</button><a href="/portal/cases">Cancelar</a></div>
      </form>
    </>
  );
}
