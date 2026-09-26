import { notFound, redirect } from 'next/navigation';
import { caseView } from '../../../../lib/cases/server';
import { statusLabels } from '../../../../lib/cases/read';
import { updateCase } from './actions';
import styles from '../../cases.module.css';

export const dynamic = 'force-dynamic';
export default async function EditCase({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const view = await caseView((await params).id);
  if (view.state === 'not_found') notFound();
  if (view.state !== 'ready') return <section className="case-panel" role="alert"><h1>No fue posible consultar el caso</h1><a href="/cases">Volver a mis casos</a></section>;
  const row = view.rows[0];
  if (view.role === 'client') redirect(`/cases/${row.id}`);
  const action = updateCase.bind(null, row.id);
  const failed = (await searchParams).error;
  return <>
    <header className={styles.intro}><p className={styles.eyebrow}>{row.reference} · GESTIÓN INTERNA</p>
      <h1>Actualizar caso</h1><p>Edita únicamente la información operativa visible para el cliente.</p></header>
    <section className={`${styles.panel} ${styles.createPanel}`}>
      {failed && <p className={styles.formError} id="case-update-error" role="alert">No fue posible actualizar el caso. Revisa los datos e intenta nuevamente.</p>}
      <form action={action} className={styles.caseForm} aria-describedby={failed ? 'case-update-error' : undefined}>
        <div><label htmlFor="title">Título</label><input id="title" name="title" defaultValue={row.title} maxLength={200} required /></div>
        <div><label htmlFor="description">Descripción visible para clientes</label>
          <textarea id="description" name="description" defaultValue={row.description} rows={6} maxLength={10000} /></div>
        <div><label htmlFor="status">Estado</label><select id="status" name="status" defaultValue={row.status}>
          {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
        <div><label htmlFor="nextAction">Próximo paso</label>
          <textarea id="nextAction" name="nextAction" defaultValue={row.next_action} rows={4} maxLength={2000} /></div>
        <div className={styles.formActions}><button type="submit">Guardar cambios</button><a href={`/cases/${row.id}`}>Cancelar</a></div>
      </form>
    </section>
  </>;
}
