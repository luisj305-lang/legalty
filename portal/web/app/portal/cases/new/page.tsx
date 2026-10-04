import { redirect } from 'next/navigation';
import { caseAdminAccess, participantDirectory } from '../../../../lib/cases/server';
import { parsePublicConfiguration } from '../../../../lib/configuration';
import { CreateCaseForm } from './create-case-form';
import styles from '../cases.module.css';

export const dynamic = 'force-dynamic';
export default async function NewCase({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await caseAdminAccess();
  const failed = (await searchParams).error;
  const configuration = parsePublicConfiguration(process.env);
  if (!configuration) redirect('/portal/login');
  const { clients, staff } = await participantDirectory();
  return <>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>GESTIÓN INTERNA · ADMINISTRACIÓN</p>
      <h1>Crear caso</h1>
      <p>Selecciona clientes y miembros del equipo desde los perfiles ya registrados. Solo se ofrecen las cuentas con el rol correspondiente.</p>
    </header>
    <section className={`${styles.panel} ${styles.createPanel}`}>
      <CreateCaseForm supabaseUrl={configuration.url} supabaseKey={configuration.publishableKey} failed={failed}
        clients={clients} staff={staff} />
    </section>
  </>;
}
