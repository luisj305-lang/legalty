import { caseAdminAccess, profileContacts } from '../../../../lib/cases/server';
import { createClientAccount, saveProfileContact } from './actions';
import styles from '../cases.module.css';

function displayName(contact: { first_name: string | null; last_name: string | null }) {
  return [contact.first_name, contact.last_name].filter((value): value is string => !!value).join(' ') || 'Sin nombre';
}

export const dynamic = 'force-dynamic';
export default async function ClientContacts({ searchParams }: {
  searchParams: Promise<{ saved?: string; created?: string; pending?: string; error?: string }>;
}) {
  await caseAdminAccess();
  const contacts = await profileContacts();
  const query = await searchParams;
  return <>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>GESTIÓN INTERNA · ADMINISTRACIÓN</p>
      <h1>Clientes y equipo</h1>
      <p>Actualiza los nombres y el teléfono de cada perfil. Puedes cambiar solo estos campos: el rol y el estado no se editan aquí. El teléfono es de uso administrativo y no aparece en el selector de participantes.</p>
    </header>
    {query.saved === '1' && <p className={styles.formSuccess} role="status">Datos guardados.</p>}
    {query.created === '1' && <p className={styles.formSuccess} role="status">Cliente creado. Se envió una invitación por correo para que configure su propia contraseña.</p>}
    {query.pending === 'profile' && <p className={styles.formError} role="alert">La invitación se envió, pero el perfil del cliente quedó pendiente. Verifica el correo enviado y vuelve a ejecutar la creación, o contacta al equipo. La invitación no se elimina automáticamente.</p>}
    {query.error && <p className={styles.formError} role="alert">No fue posible completar la operación. Revisa los datos e intenta nuevamente.</p>}
    <section className={`${styles.panel} ${styles.contactsPanel}`}>
      <h2>Crear cliente</h2>
      <p>Ingresa un correo y los datos del nuevo cliente. El sistema enviará una invitación para que configure su propia contraseña.</p>
      <form action={createClientAccount} className={styles.contactForm}>
        <label>Correo electrónico
          <input name="email" type="email" maxLength={254} autoComplete="off" required />
        </label>
        <label>Nombres
          <input name="first_name" maxLength={120} autoComplete="off" required />
        </label>
        <label>Apellidos
          <input name="last_name" maxLength={120} autoComplete="off" />
        </label>
        <label>Teléfono
          <input name="phone" maxLength={32} autoComplete="off" />
        </label>
        <button type="submit">Crear cliente</button>
      </form>
    </section>
    <section className={`${styles.panel} ${styles.contactsPanel}`}>
      {contacts.length === 0
        ? <p className={styles.empty}>No hay perfiles registrados todavía.</p>
        : <ul className={styles.contactList}>
            {contacts.map(contact => <li key={contact.id} className={styles.contactRow}>
              <div className={styles.contactIdentity}>
                <strong>{displayName(contact)}</strong>
                <span>{contact.email}</span>
                <span>{contact.role} · {contact.active ? 'Activo' : 'Inactivo'}</span>
              </div>
              <form action={saveProfileContact} className={styles.contactForm}>
                <input type="hidden" name="id" value={contact.id} />
                <label>Nombres
                  <input name="first_name" maxLength={120} defaultValue={contact.first_name ?? ''} />
                </label>
                <label>Apellidos
                  <input name="last_name" maxLength={120} defaultValue={contact.last_name ?? ''} />
                </label>
                <label>Teléfono
                  <input name="phone" maxLength={32} defaultValue={contact.phone ?? ''} />
                </label>
                <button type="submit">Guardar</button>
              </form>
            </li>)}
          </ul>}
    </section>
  </>;
}
