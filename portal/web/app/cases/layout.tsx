import type { ReactNode } from 'react';
import { logout } from '../login/actions';

export const dynamic = 'force-dynamic';
export default function CaseLayout({ children }: { children: ReactNode }) {
  return <div className="workspace">
    <a className="skip-link" href="#case-content">Saltar al contenido</a>
    <aside className="workspace-nav">
      <a href="/cases" className="workspace-brand"><span>L</span> LEGALTY<small>PORTAL PRIVADO</small></a>
      <nav aria-label="Navegación principal">
        <a href="/cases">Mis casos</a><a href="/setup/password">Contraseña</a><a href="/setup/mfa">Autenticador</a>
      </nav>
      <div className="workspace-help"><p>Información protegida</p><small>Solo ves los casos autorizados para tu cuenta.</small></div>
      <form action={logout}><button type="submit">Cerrar sesión</button></form>
    </aside>
    <div className="workspace-body"><header className="workspace-topbar"><span>Centro de seguimiento</span><span>Acceso privado</span></header>
      <main id="case-content" className="workspace-main">{children}</main>
    </div>
  </div>;
}
