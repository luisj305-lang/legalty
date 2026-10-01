import { redirect } from 'next/navigation';
import { serverClient } from '../../../../lib/supabase/next-client';
import { changePassword } from './actions';

export const dynamic = 'force-dynamic';
export default async function PasswordSetup({ searchParams }: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const client = await serverClient().catch(() => null);
  const identity = await client?.auth.getUser().catch(() => null);
  if (!client || identity?.error || !identity?.data.user) redirect('/portal/login');
  const profile = await client.from('profiles').select('must_change_password')
    .eq('id', identity.data.user.id).maybeSingle();
  const params = await searchParams;
  const confirmed = params.status === 'updated' && !profile.error && profile.data?.must_change_password === false;
  return <main className="portal-shell"><section className="access-card">
    <p className="eyebrow">LEGALTY · SEGURIDAD</p><h1>Cambiar contraseña</h1>
    <p>Usa una contraseña diferente, de al menos 12 caracteres y máximo 72 bytes. El cambio no activa tu cuenta.</p>
    {confirmed && <p role="status">Cambio confirmado. La habilitación del portal sigue pendiente.</p>}
    {params.error && <p id="password-error" role="alert">No fue posible confirmar todo el proceso. La contraseña puede haber cambiado. Inicia sesión nuevamente y usa otra contraseña diferente, o contacta al equipo. Puede requerirse verificación adicional.</p>}
    <form action={changePassword} className="auth-form" aria-describedby={params.error ? 'password-error' : undefined}>
      <label htmlFor="password">Nueva contraseña</label>
      <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />
      <label htmlFor="confirmation">Confirmar contraseña</label>
      <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />
      <button type="submit">Guardar contraseña</button>
    </form>
    <p><a href="/portal/account">Volver a mi cuenta</a></p>
    <p><a href="/portal/setup/mfa">Configurar autenticador opcional</a></p>
  </section></main>;
}
