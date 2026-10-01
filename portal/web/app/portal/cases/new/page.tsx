import { caseAdminAccess } from '../../../../lib/cases/server';
import { createCase } from './actions';
import styles from '../cases.module.css';

export const dynamic = 'force-dynamic';
export default async function NewCase({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await caseAdminAccess();
  const failed = (await searchParams).error;
  return <>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>GESTIÓN INTERNA · ADMINISTRACIÓN</p>
      <h1>Crear caso</h1>
      <p>Vincula clientes y miembros del equipo mediante sus correos exactos. Esta búsqueda no muestra perfiles.</p>
    </header>
    <section className={`${styles.panel} ${styles.createPanel}`}>
      {failed && <p className={styles.formError} id="case-create-error" role="alert">No fue posible crear el caso. Revisa los datos e intenta nuevamente.</p>}
      <form action={createCase} className={styles.caseForm} aria-describedby={failed ? 'case-create-error' : undefined}>
        <div><label htmlFor="reference">Referencia</label>
          <input id="reference" name="reference" maxLength={80} required /></div>
        <div><label htmlFor="title">Título</label>
          <input id="title" name="title" maxLength={200} required /></div>
        <div><label htmlFor="description">Descripción visible para clientes</label>
          <textarea id="description" name="description" rows={6} maxLength={10000} /></div>
        <div><label htmlFor="clientEmails">Correos de clientes</label>
          <textarea id="clientEmails" name="clientEmails" rows={4} maxLength={25500} required aria-describedby="client-help" />
          <small id="client-help">Un correo exacto por línea. Debes incluir al menos un cliente.</small></div>
        <div><label htmlFor="staffEmails">Correos del equipo (opcional)</label>
          <textarea id="staffEmails" name="staffEmails" rows={3} maxLength={25500} aria-describedby="staff-help" />
          <small id="staff-help">Un correo exacto por línea. Solo se aceptan perfiles con rol de equipo.</small></div>
        <div className={styles.formActions}><button type="submit">Crear caso</button><a href="/portal/cases">Cancelar</a></div>
      </form>
    </section>
  </>;
}
