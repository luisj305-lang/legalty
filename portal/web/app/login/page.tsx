import { login } from './actions';

export const dynamic = 'force-dynamic';
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const failed = (await searchParams).error;
  return <main className="portal-shell"><section className="access-card">
    <p className="eyebrow">LEGALTY · ACCESO POR INVITACIÓN</p>
    <h1>Iniciar sesión</h1>
    <p>Ingresa con tu cuenta existente. Las funciones del portal siguen en preparación.</p>
    {failed && <p id="login-error" role="alert">No fue posible iniciar sesión. Revisa tus datos e intenta nuevamente.</p>}
    <form action={login} className="auth-form" aria-describedby={failed ? 'login-error' : undefined}>
      <label htmlFor="email">Correo electrónico</label>
      <input id="email" name="email" type="email" autoComplete="username" maxLength={254} required />
      <label htmlFor="password">Contraseña</label>
      <input id="password" name="password" type="password" autoComplete="current-password" maxLength={1024} required />
      <button type="submit">Ingresar</button>
    </form>
    <p><a href="/">Volver al inicio</a></p>
  </section></main>;
}
