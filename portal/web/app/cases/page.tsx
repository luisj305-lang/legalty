import { caseView } from '../../lib/cases/server';
import { statusLabels, summarizeCases } from '../../lib/cases/read';
import styles from './cases.module.css';

export default async function Cases() {
  const view = await caseView();
  if (view.state !== 'ready') return <section className={`${styles.panel} ${styles.statePanel}`} role="alert">
    <p className={styles.eyebrow}>PORTAL DE CLIENTES</p><h1>Casos no disponibles</h1>
    <p>No pudimos consultar tus casos. Intenta nuevamente.</p><a href="/cases">Volver a consultar</a>
  </section>;
  const counts = summarizeCases(view.rows);
  const metrics = [
    ['En esta vista', counts.total], ['En gestión', counts.active],
    ['En espera', counts.waiting], ['Cerrados', counts.closed],
  ] as const;
  return <>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>{view.role === 'client' ? 'TU ACOMPAÑAMIENTO LEGAL' : 'GESTIÓN INTERNA'}</p>
      <h1>Resumen de casos</h1><p>Consulta el estado y el próximo paso de cada proceso autorizado.</p>
    </header>
    <div className={styles.metrics} aria-label="Resumen de los casos mostrados">
      {metrics.map(([label, count]) =>
        <div className={styles.metric} key={label}><span>{label}</span><strong>{count}</strong></div>)}
    </div>
    <section className={styles.panel}><div className={styles.sectionHeading}><h2>Casos autorizados</h2><span>Actualización más reciente primero</span></div>
      {view.rows.length === 0 ? <div className={styles.empty}><h3>Todavía no tienes casos visibles</h3><p>Cuando el equipo vincule un caso a tu cuenta, podrás seguirlo aquí.</p></div> :
        <ul className={styles.caseList}>{view.rows.map(row => <li key={row.id}>
          <div className={styles.caseSummary}><span className={styles.reference}>{row.reference}</span><h3><a href={`/cases/${row.id}`}>{row.title}</a></h3>
            <span className={styles.nextLabel}>Próximo paso</span><p>{row.next_action || 'El equipo aún no ha registrado el próximo paso.'}</p></div>
          <div className={styles.caseMeta}><span className={`${styles.badge} ${styles[row.status]}`}>{statusLabels[row.status]}</span>
            <span>Actualizado <time dateTime={row.updated_at}>{new Date(row.updated_at).toLocaleDateString('es-CO', { timeZone: 'UTC' })}</time></span></div>
        </li>)}</ul>}
      {view.rows.length === 50 && <p className={styles.truncation}>Se muestran hasta 50 casos recientes. Este resumen corresponde únicamente a esta vista.</p>}
    </section>
  </>;
}
