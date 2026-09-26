import { login } from './actions';
import './login.css';

export const dynamic = 'force-dynamic';
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const failed = (await searchParams).error;
  return <main className="login-layout">
    <section className="login-story" aria-label="Portal de clientes LEGALTY">
      <a className="login-brand" href="/" aria-label="LEGALTY, volver al inicio">LEGALTY<span>PORTAL DE CLIENTES</span></a>
      <div className="login-message">
        <h1>Tu tranquilidad legal,<br />en un solo lugar.</h1>
        <p>Consulta tus casos y mantente al día con tu equipo legal.</p>
      </div>
      <p className="login-signature">Claridad. Confianza. Respaldo.</p>
    </section>
    <section className="login-panel" aria-labelledby="login-heading">
      <div className="login-content">
        <header className="login-heading">
          <svg className="login-lock" viewBox="0 0 32 40" fill="none" aria-hidden="true"><rect x="3" y="17" width="26" height="20" rx="3" /><path d="M8 17V10a8 8 0 0 1 16 0v7M16 26v5" /><circle cx="16" cy="25" r="2" /></svg>
          <p className="login-kicker">ACCESO SEGURO</p>
          <h2 id="login-heading">Bienvenido de nuevo</h2>
          <p>Ingresa a tu portal LEGALTY.</p>
        </header>
        {failed && <p className="login-error" id="login-error" role="alert">No fue posible iniciar sesión. Revisa tus datos e intenta nuevamente.</p>}
        <form action={login} className="login-form" aria-describedby={failed ? 'login-error' : undefined}>
          <div><label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" placeholder="nombre@correo.com" autoComplete="username" maxLength={254} required /></div>
          <div><label htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" autoComplete="current-password" maxLength={1024} required /></div>
          <button type="submit">Ingresar al portal <span aria-hidden="true">→</span></button>
        </form>
        <p className="login-assurance">Acceso privado para clientes y equipo legal.</p>
        <p className="login-support">Si necesitas ayuda con tu cuenta, comunícate con tu asesor.</p>
      </div>
      <footer className="login-footer"><span>LEGALTY © {new Date().getFullYear()}</span><a href="/">Volver al inicio</a></footer>
    </section>
  </main>;
}
