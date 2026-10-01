export default function Home() {
  return (
    <main className="portal-shell">
      <header className="brand" aria-label="Legalty">
        <span className="brand-mark" aria-hidden="true">L</span>
        <span>LEGALTY<small>Asesoría jurídica y financiera</small></span>
      </header>
      <section className="access-card" aria-labelledby="access-title">
        <p className="eyebrow">PORTAL DE CLIENTES Y EQUIPO</p>
        <p className="status">En preparación</p>
        <h1 id="access-title">Tu próximo paso,<br />con respaldo.</h1>
        <p className="intro">Estamos preparando un espacio para acompañar tus procesos
          y conectar cada avance con el equipo de Legalty.</p>
        <div className="notice">
          <h2>Acceso para cuentas invitadas</h2>
          <p>Ya puedes iniciar sesión con tu cuenta existente. La consulta de casos
            y la carga de documentos todavía no están habilitadas.</p>
          <p><a href="/portal/login">Iniciar sesión</a></p>
        </div>
        <p className="guidance">Si ya eres cliente, continúa usando tus canales
          habituales de atención con Legalty.</p>
      </section>
      <footer>Legalty · Portal en desarrollo</footer>
    </main>
  );
}
