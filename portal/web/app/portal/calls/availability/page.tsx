import { redirect } from 'next/navigation';
import { serverClient } from '../../../../lib/supabase/next-client';
import { accountAccess } from '../../../../lib/supabase/server';
import { logout } from '../../login/actions';
import {
  bogotaDate, buildMonthCalendar, collectBookedDates, normalizeWeeklyRanges,
  type CalendarCell, type WeeklyRange,
} from '../../../../lib/calls/availability';
import { cancelBooking, changeBlockedDate, saveWeeklyHours } from './actions';
import styles from '../../cases/cases.module.css';
import calendar from './availability.module.css';

export const dynamic = 'force-dynamic';

const weekdayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const calendarHeadings = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const bogotaDateTime = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long',
  year: 'numeric', hour: 'numeric', minute: '2-digit',
});

type Appointment = {
  id: string; starts_at: string; service_id: string; status: string;
  client_name: string; client_email: string; client_phone: string;
  payment_id: string | null;
};

function parseAppointments(value: unknown): Appointment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (item === null || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || typeof record.starts_at !== 'string') return [];
    return [{
      id: record.id,
      starts_at: record.starts_at,
      service_id: typeof record.service_id === 'string' ? record.service_id : '',
      status: typeof record.status === 'string' ? record.status : '',
      client_name: typeof record.client_name === 'string' ? record.client_name : '',
      client_email: typeof record.client_email === 'string' ? record.client_email : '',
      client_phone: typeof record.client_phone === 'string' ? record.client_phone : '',
      payment_id: typeof record.payment_id === 'string' ? record.payment_id : null,
    }];
  });
}

function parseBlockedDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (item === null || typeof item !== 'object') return [];
    const day = (item as Record<string, unknown>).day;
    return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day) ? [day.slice(0, 10)] : [];
  }).sort();
}

function statusLabel(status: string) {
  if (status === 'confirmed') return 'Confirmada';
  if (status === 'cancelled') return 'Cancelada';
  return 'Pendiente de pago';
}

function serviceLabel(serviceId: string) {
  if (serviceId === 'llamada-30min') return 'Llamada 30 min';
  if (serviceId === 'llamada-45min') return 'Llamada 45 min';
  return serviceId;
}

async function availabilityAccess() {
  const client = await serverClient().catch(() => null);
  if (!client) redirect('/portal/login');
  const access = await accountAccess(client);
  if (access.state === 'signed_out') redirect('/portal/login');
  if (access.state === 'setup_pending') redirect('/portal/account');
  if (access.role !== 'admin' && access.role !== 'staff') redirect('/portal/cases');
  return client;
}

function CalendarGrid({ cells, monthLabel }: { cells: CalendarCell[]; monthLabel: string }) {
  const statusText = { blocked: 'Bloqueado', booked: 'Reservado', free: 'Libre', outside: '' } as const;
  const statusClass = {
    blocked: calendar.statusBlocked, booked: calendar.statusBooked,
    free: calendar.statusFree, outside: '',
  } as const;
  return <div className={calendar.calendarWrap}>
    <table className={calendar.calendar}>
      <caption>{monthLabel}</caption>
      <thead><tr>{calendarHeadings.map(heading => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
      <tbody>
        {Array.from({ length: cells.length / 7 }, (_, week) => <tr key={week}>
          {cells.slice(week * 7, week * 7 + 7).map((cell, index) => cell.day === null
            ? <td key={index} aria-hidden="true" />
            : <td key={index}>
              <span className={calendar.calendarDay}>{cell.day}</span>
              <span className={`${calendar.calendarStatus} ${statusClass[cell.status]}`}>
                {statusText[cell.status]}
              </span>
            </td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function WeeklyEditor({ weekly }: { weekly: WeeklyRange[] }) {
  return <div className={calendar.weekGrid}>
    {weekdayNames.map((name, weekday) => {
      const ranges = weekly.filter(range => range.weekday === weekday);
      return <div className={calendar.weekRow} key={name}>
        <span className={calendar.weekday}>{name}</span>
        <div>
          {ranges.length === 0
            ? <p className={styles.empty}>Sin horario.</p>
            : <ul className={calendar.rangeList}>{ranges.map(range => <li
              className={calendar.rangeItem} key={`${range.start}-${range.end}`}>
              <span className={calendar.rangeTime}>{range.start} – {range.end}</span>
              <form action={saveWeeklyHours}>
                <input type="hidden" name="intent" value="remove" />
                <input type="hidden" name="weekday" value={weekday} />
                <input type="hidden" name="start" value={range.start} />
                <input type="hidden" name="end" value={range.end} />
                <button type="submit" aria-label={`Quitar el horario de ${range.start} a ${range.end} del ${name}`}>Quitar</button>
              </form>
            </li>)}</ul>}
          <form action={saveWeeklyHours} className={calendar.inlineForm}>
            <input type="hidden" name="intent" value="add" />
            <input type="hidden" name="weekday" value={weekday} />
            <label>Desde<input type="time" name="start" required /></label>
            <label>Hasta<input type="time" name="end" required /></label>
            <button type="submit">Agregar</button>
          </form>
        </div>
      </div>;
    })}
  </div>;
}

export default async function CallAvailability({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const client = await availabilityAccess();
  const failed = (await searchParams).error;
  const [weeklyResult, appointmentResult, blockedResult] = await Promise.all([
    client.from('call_weekly_hours').select('weekday,start_time,end_time')
      .order('weekday', { ascending: true }).order('start_time', { ascending: true }),
    client.rpc('list_call_appointments'),
    client.rpc('list_call_blocked_dates'),
  ]);

  const weekly = normalizeWeeklyRanges(weeklyResult.data);
  const appointments = parseAppointments(appointmentResult.data);
  const blockedDates = parseBlockedDates(blockedResult.data);
  const bookedDates = collectBookedDates(appointmentResult.data);
  const unavailable = Boolean(weeklyResult.error || appointmentResult.error || blockedResult.error);

  const today = bogotaDate(new Date().toISOString()) ?? '2026-01-01';
  const [year, month] = today.split('-').map(Number);
  const cells = buildMonthCalendar(year, month, blockedDates, bookedDates);
  const monthLabel = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC', month: 'long', year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1))).replace(/^./, character => character.toUpperCase());

  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#availability-content">Saltar al contenido</a>
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
        <a href="/portal/cases">Resumen de casos</a>
        <a href="/portal/calls/availability" aria-current="page" className={styles.activeLink}>Disponibilidad de llamadas</a>
        <a href="/portal/setup/password">Configurar contraseña</a>
        <a href="/portal/setup/mfa">Autenticador opcional</a>
      </nav>
      <div className={styles.securityNote}><span>INFORMACIÓN PROTEGIDA</span>
        <p>Solo el equipo autorizado puede administrar los horarios de llamadas.</p></div>
      <form className={styles.logout} action={logout}><button type="submit">Cerrar sesión</button></form>
    </aside>
    <div className={styles.content}>
      <main id="availability-content" className={styles.main}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>GESTIÓN INTERNA · ADMINISTRACIÓN Y EQUIPO</p>
          <h1>Disponibilidad de llamadas</h1>
          <p>Defina su horario semanal recurrente, bloquee fechas concretas y libere reservas abandonadas. Todos los horarios se muestran en la zona horaria de Bogotá (UTC-5).</p>
        </header>

        {failed === 'weekly' && <p className={styles.formError} role="alert">
          No fue posible guardar el horario semanal. Revisa las horas e intenta nuevamente.</p>}
        {failed === 'blocked' && <p className={styles.formError} role="alert">
          No fue posible actualizar la fecha bloqueada. Revisa la fecha e intenta nuevamente.</p>}
        {failed === 'cancel' && <p className={styles.formError} role="alert">
          No fue posible cancelar la reserva. Recarga la página e intenta nuevamente.</p>}
        {unavailable && <p className={styles.formError} role="alert">
          No fue posible consultar la disponibilidad. Recarga la página e intenta nuevamente.</p>}

        <section className={`${styles.panel} ${styles.createPanel}`} aria-labelledby="weekly-heading">
          <div className={styles.sectionHeading}>
            <h2 id="weekly-heading">Horario semanal</h2>
            <span>Se repite cada semana; la última llamada comienza 30 minutos antes del cierre.</span>
          </div>
          <WeeklyEditor weekly={weekly} />
        </section>

        <section className={`${styles.panel} ${styles.createPanel}`} aria-labelledby="blocked-heading">
          <div className={styles.sectionHeading}>
            <h2 id="blocked-heading">Fechas bloqueadas</h2><span>Los días bloqueados no ofrecen horarios.</span>
          </div>
          {blockedDates.length === 0
            ? <p className={styles.empty}>No hay fechas bloqueadas.</p>
            : <ul className={calendar.rangeList}>{blockedDates.map(day => <li className={calendar.rangeItem} key={day}>
              <span className={calendar.rangeTime}>{day}</span>
              <form action={changeBlockedDate}>
                <input type="hidden" name="intent" value="remove" />
                <input type="hidden" name="day" value={day} />
                <button type="submit" aria-label={`Quitar el bloqueo del ${day}`}>Quitar</button>
              </form>
            </li>)}</ul>}
          <form action={changeBlockedDate} className={calendar.inlineForm}>
            <input type="hidden" name="intent" value="add" />
            <label>Fecha<input type="date" name="day" required /></label>
            <button type="submit">Bloquear fecha</button>
          </form>
        </section>

        <section className={`${styles.panel} ${styles.createPanel}`} aria-labelledby="calendar-heading">
          <div className={styles.sectionHeading}><h2 id="calendar-heading">Calendario del mes</h2></div>
          <CalendarGrid cells={cells} monthLabel={monthLabel} />
          <div className={calendar.legend}>
            <span><i className={`${calendar.swatch} ${calendar.statusFree}`} aria-hidden="true" />Libre</span>
            <span><i className={`${calendar.swatch} ${calendar.statusBooked}`} aria-hidden="true" />Reservado</span>
            <span><i className={`${calendar.swatch} ${calendar.statusBlocked}`} aria-hidden="true" />Bloqueado</span>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.createPanel}`} aria-labelledby="appointments-heading">
          <div className={styles.sectionHeading}>
            <h2 id="appointments-heading">Reservas registradas</h2><span>La cita se registra antes del pago.</span>
          </div>
          {appointments.length === 0
            ? <p className={styles.empty}>No hay reservas registradas.</p>
            : <ul className={calendar.appointmentList}>{appointments.map(appointment => <li
              className={calendar.appointment} key={appointment.id}>
              <div className={calendar.appointmentMeta}>
                <span className={styles.reference}>{serviceLabel(appointment.service_id)}</span>
                <time dateTime={appointment.starts_at}>{bogotaDateTime.format(new Date(appointment.starts_at))}</time>
                <p className={calendar.appointmentContact}>
                  {appointment.client_name} · {appointment.client_email} · {appointment.client_phone}
                </p>
              </div>
              <div className={calendar.appointmentActions}>
                <span className={`${styles.badge} ${appointment.status === 'cancelled' ? styles.closed : appointment.status === 'pending_payment' ? styles.waiting : ''}`}>
                  {statusLabel(appointment.status)}
                </span>
                {appointment.status !== 'cancelled' && <form action={cancelBooking.bind(null, appointment.id)}>
                  <button type="submit">Cancelar reserva</button>
                </form>}
              </div>
            </li>)}</ul>}
        </section>
      </main>
      <footer className={styles.footer}>LEGALTY · Portal de clientes</footer>
    </div>
  </div>;
}
