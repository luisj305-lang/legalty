import { redirect } from 'next/navigation';
import { serverClient } from '../../../../lib/supabase/next-client';
import { MfaForm } from './form';

export const dynamic = 'force-dynamic';
export default async function MfaSetup() {
  const client = await serverClient().catch(() => null);
  const identity = await client?.auth.getUser().catch(() => null);
  if (!client || identity?.error || !identity?.data.user) redirect('/portal/login');
  const factors = await client.auth.mfa.listFactors().catch(() => null);
  return <main className="portal-shell"><section className="access-card">
    <p className="eyebrow">LEGALTY · SEGURIDAD</p><h1>Verificación en dos pasos</h1>
    <p>Configura o verifica tu autenticador opcional. Esto no activa tu cuenta ni habilita casos o documentos.</p>
    {factors?.data && !factors.error ? <MfaForm factors={factors.data.all
      .filter(f => f.factor_type === 'totp').map(({ id, status, factor_type }) => ({ id, status, factor_type }))} /> :
      <p role="alert">No fue posible consultar tus autenticadores. Intenta nuevamente.</p>}
    <p><a href="/portal/account">Volver a mi cuenta</a></p>
  </section></main>;
}
