import { redirect } from 'next/navigation';
import { serverClient } from '../../../lib/supabase/next-client';
import { accountAccess } from '../../../lib/supabase/server';
import { logout } from '../login/actions';

export const dynamic = 'force-dynamic';
export default async function Account({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const access = await serverClient().then(accountAccess).catch(() => ({ state: 'signed_out' as const }));
  if (access.state === 'signed_out') redirect('/portal/login');
  if (access.state === 'eligible') redirect('/portal/cases');
  return <main className="portal-shell"><section className="access-card">
    <p className="eyebrow">LEGALTY · CUENTA VERIFICADA</p>
    <h1>Configuración pendiente</h1>
    <p>Tu sesión está verificada. Los casos, documentos y funciones operativas todavía no están habilitados.</p>
    <p>El equipo debe completar la configuración de acceso y seguridad antes de habilitar el portal.</p>
    {(await searchParams).error && <p role="alert">No fue posible cerrar sesión. Intenta nuevamente.</p>}
    <p><a href="/portal/setup/password">Configurar mi contraseña</a></p>
    <p><a href="/portal/setup/mfa">Configurar o verificar autenticador opcional</a></p>
    <form action={logout}><button type="submit">Cerrar sesión</button></form>
  </section></main>;
}
