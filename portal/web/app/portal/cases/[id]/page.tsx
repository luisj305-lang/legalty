import { notFound } from 'next/navigation';
import { caseView } from '../../../../lib/cases/server';
import { statusLabels } from '../../../../lib/cases/read';

export default async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const view = await caseView((await params).id);
  if (view.state === 'not_found') notFound();
  if (view.state !== 'ready') return <section className="case-panel" role="alert"><h1>No fue posible consultar el caso</h1><a href="/portal/cases">Volver a mis casos</a></section>;
  const row = view.rows[0];
  return <>
    <a href="/portal/cases">← Mis casos</a><p className="eyebrow">{row.reference}</p><h1>{row.title}</h1>
    <span className={`case-badge ${row.status}`}>{statusLabels[row.status]}</span>
    {view.role !== 'client' && <p><a href={`/portal/cases/${row.id}/edit`}>Editar caso</a></p>}
    <div className="case-detail-grid"><section className="case-panel"><h2>Resumen del caso</h2>
      <p className="preserve-lines">{row.description || 'Aún no hay un resumen registrado.'}</p></section>
      <section className="case-panel"><h2>Próximo paso</h2><p className="preserve-lines">{row.next_action || 'Pendiente de definición por el equipo.'}</p>
        <small>Última actualización: <time dateTime={row.updated_at}>{new Date(row.updated_at).toLocaleDateString('es-CO', { timeZone: 'UTC' })}</time></small></section></div>
  </>;
}
