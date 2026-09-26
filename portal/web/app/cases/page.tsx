import { caseView } from '../../lib/cases/server';
import { statusLabels, summarizeCases } from '../../lib/cases/read';

export default async function Cases() {
  const view = await caseView();
  if (view.state !== 'ready') return <section className="case-panel" role="alert"><h1>Casos no disponibles</h1><p>No pudimos consultar tus casos. Intenta nuevamente.</p><a href="/cases">Volver a consultar</a></section>;
  const counts = summarizeCases(view.rows);
  return <>
    <p className="eyebrow">{view.role === 'client' ? 'TU ACOMPAÑAMIENTO LEGAL' : 'GESTIÓN INTERNA'}</p>
    <h1>Tus casos, en un solo lugar.</h1><p className="workspace-intro">Consulta el estado y el próximo paso de cada proceso autorizado.</p>
    <div className="case-metrics" aria-label="Resumen de los casos mostrados">
      {[['En esta vista', counts.total], ['En gestión', counts.active], ['En espera', counts.waiting], ['Cerrados', counts.closed]].map(([label, count]) =>
        <div key={label}><span>{label}</span><strong>{count}</strong></div>)}
    </div>
    <section className="case-panel"><div className="section-heading"><h2>Seguimiento de casos</h2><span>Actualización más reciente primero</span></div>
      {view.rows.length === 0 ? <div className="case-empty"><h3>Todavía no tienes casos visibles</h3><p>Cuando el equipo vincule un caso a tu cuenta, podrás seguirlo aquí.</p></div> :
        <ul className="case-list">{view.rows.map(row => <li key={row.id}>
          <div><span className="case-reference">{row.reference}</span><h3><a href={`/cases/${row.id}`}>{row.title}</a></h3>
            <p>{row.next_action || 'El equipo aún no ha registrado el próximo paso.'}</p></div>
          <div className="case-row-meta"><span className={`case-badge ${row.status}`}>{statusLabels[row.status]}</span>
            <time dateTime={row.updated_at}>{new Date(row.updated_at).toLocaleDateString('es-CO', { timeZone: 'UTC' })}</time></div>
        </li>)}</ul>}
      {view.rows.length === 50 && <p>Se muestran hasta 50 casos recientes. Este resumen corresponde únicamente a esta vista.</p>}
    </section>
  </>;
}
