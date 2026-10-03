import { notFound } from 'next/navigation';
import { caseView } from '../../../../lib/cases/server';
import { statusLabels } from '../../../../lib/cases/read';
import styles from './case-detail.module.css';

export default async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const view = await caseView((await params).id);
  if (view.state === 'not_found') notFound();
  if (view.state !== 'ready') return <section className={styles.statePanel} role="alert">
    <p className={styles.eyebrow}>PORTAL DE CLIENTES</p><h1>No fue posible consultar el caso</h1>
    <a className={styles.backLink} href="/portal/cases">Volver a mis casos</a>
  </section>;
  const row = view.rows[0];
  return <article className={styles.detail}>
    <a className={styles.backLink} href="/portal/cases">← Mis casos</a>
    <header className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>CASO AUTORIZADO</p>
        <p className={styles.reference}>{row.reference}</p><h1>{row.title}</h1>
      </div>
      <div className={styles.statusSummary}>
        <span className={`${styles.badge} ${styles[row.status]}`}>{statusLabels[row.status]}</span>
        <p>Última actualización <time dateTime={row.updated_at}>{new Date(row.updated_at).toLocaleDateString('es-CO', { timeZone: 'UTC' })}</time></p>
      </div>
    </header>
    {view.role !== 'client' && <p className={styles.editAction}><a href={`/portal/cases/${row.id}/edit`}>Editar caso</a></p>}
    <div className={styles.contentGrid}>
      <section className={styles.panel} aria-labelledby="case-summary">
        <p className={styles.sectionLabel}>INFORMACIÓN DEL CASO</p><h2 id="case-summary">Resumen del caso</h2>
        <p className={styles.preserveLines}>{row.description || 'Aún no hay un resumen registrado.'}</p>
      </section>
      <section className={styles.panel} aria-labelledby="next-action">
        <p className={styles.sectionLabel}>SEGUIMIENTO</p><h2 id="next-action">Próximo paso</h2>
        <p className={styles.preserveLines}>{row.next_action || 'Pendiente de definición por el equipo.'}</p>
      </section>
    </div>
  </article>;
}
