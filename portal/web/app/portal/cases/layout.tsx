import type { ReactNode } from 'react';
import { logout } from '../login/actions';
import styles from './cases.module.css';

export const dynamic = 'force-dynamic';
export default function CaseLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#case-content">Saltar al contenido</a>
    <header className={styles.header}>
      <a href="/portal/cases" className={styles.brand} aria-label="Legalty, resumen de casos">
        <span className={styles.brandMark} aria-hidden="true">L</span>
        <span>LEGALTY<small>Servicios Jurídicos Integrales S.A.S</small></span>
      </a>
      <span className={styles.portalName}>Portal de clientes</span>
      <span className={styles.privateLabel}>Acceso privado</span>
    </header>
    <aside className={styles.sidebar}>
      <nav className={styles.navigation} aria-label="Navegación principal">
        <a href="/portal/cases" aria-current="page" className={styles.activeLink}>Resumen de casos</a>
        <a href="/portal/setup/password">Configurar contraseña</a>
        <a href="/portal/setup/mfa">Autenticador opcional</a>
      </nav>
      <div className={styles.securityNote}><span>INFORMACIÓN PROTEGIDA</span><p>Solo ves los casos autorizados para tu cuenta.</p></div>
      <form className={styles.logout} action={logout}><button type="submit">Cerrar sesión</button></form>
    </aside>
    <div className={styles.content}>
      <main id="case-content" className={styles.main}>{children}</main>
      <footer className={styles.footer}>LEGALTY · Portal de clientes</footer>
    </div>
  </div>;
}
