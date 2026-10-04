import type { Access } from '../auth/access.ts';
import { trustedOrigin } from '../auth/mutations.ts';

// Recurring weekly windows; weekday is 0=Sunday..6=Saturday and times are the
// wall-clock values the admin sees in America/Bogota.
export type WeeklyRange = { weekday: number; start: string; end: string };

export interface WeeklyHoursSource {
  access(): Promise<Access>;
  readWeekly(): Promise<unknown>;
  writeWeekly(ranges: WeeklyRange[]): Promise<void>;
}

export interface BlockedDateSource {
  access(): Promise<Access>;
  addBlocked(day: string): Promise<void>;
  removeBlocked(day: string): Promise<void>;
}

export interface CancelBookingSource {
  access(): Promise<Access>;
  cancelBooking(appointmentId: string): Promise<void>;
}

export const availabilityPath = '/portal/calls/availability';
export const weeklyError = `${availabilityPath}?error=weekly`;
export const blockedError = `${availabilityPath}?error=blocked`;
export const cancelError = `${availabilityPath}?error=cancel`;

const uuidPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const weekdayPattern = /^[0-6]$/;

function singleField(form: FormData, name: string): string | null {
  const values = form.getAll(name);
  if (values.length !== 1 || typeof values[0] !== 'string') return null;
  return values[0].trim();
}

// Server action forms may carry Next.js internal fields; everything else must be
// declared by the caller, otherwise the mutation is rejected.
function onlyFields(form: FormData, allowed: readonly string[]) {
  for (const name of new Set(form.keys())) {
    if (name.startsWith('$ACTION_')) continue;
    if (!allowed.includes(name) || form.getAll(name).length !== 1) return false;
  }
  return true;
}

function compareRanges(left: WeeklyRange, right: WeeklyRange) {
  return left.weekday - right.weekday || left.start.localeCompare(right.start);
}

// Accepts either the canonical range shape or raw Supabase rows
// ({ weekday, start_time, end_time }) and keeps only valid, ordered windows.
export function normalizeWeeklyRanges(value: unknown): WeeklyRange[] {
  if (!Array.isArray(value)) return [];
  const ranges: WeeklyRange[] = [];
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const weekday = typeof record.weekday === 'number' ? record.weekday
      : typeof record.weekday === 'string' ? Number(record.weekday) : NaN;
    const startValue = typeof record.start === 'string' ? record.start
      : typeof record.start_time === 'string' ? record.start_time : '';
    const endValue = typeof record.end === 'string' ? record.end
      : typeof record.end_time === 'string' ? record.end_time : '';
    const start = startValue.slice(0, 5);
    const end = endValue.slice(0, 5);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
    if (!timePattern.test(start) || !timePattern.test(end) || start >= end) continue;
    ranges.push({ weekday, start, end });
  }
  return ranges.sort(compareRanges);
}

// Applies a single add/remove edit to the current schedule. Returns null when an
// add would create a duplicate weekday/start window (unique in the database).
export function applyWeeklyChange(current: WeeklyRange[], range: WeeklyRange,
  intent: 'add' | 'remove'): WeeklyRange[] | null {
  if (intent === 'remove') {
    return current.filter(item => !(item.weekday === range.weekday && item.start === range.start));
  }
  if (current.some(item => item.weekday === range.weekday && item.start === range.start)) return null;
  return [...current, range].sort(compareRanges);
}

export function isCalendarDate(value: string) {
  const match = datePattern.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1
    && probe.getUTCDate() === day;
}

function accessDestination(access: Access) {
  if (access.state === 'signed_out') return '/portal/login';
  if (access.state === 'setup_pending') return '/portal/account';
  if (access.role !== 'admin' && access.role !== 'staff') return '/portal/cases';
  return null;
}

export async function submitWeeklyHours(form: FormData, origin: string | null,
  configured: string | undefined, source: WeeklyHoursSource) {
  if (!trustedOrigin(origin, configured)) return weeklyError;
  if (!onlyFields(form, ['intent', 'weekday', 'start', 'end'])) return weeklyError;
  const intent = singleField(form, 'intent');
  const weekdayValue = singleField(form, 'weekday');
  const start = singleField(form, 'start');
  const end = singleField(form, 'end');
  if (intent !== 'add' && intent !== 'remove') return weeklyError;
  if (weekdayValue === null || !weekdayPattern.test(weekdayValue)) return weeklyError;
  if (start === null || end === null) return weeklyError;
  if (!timePattern.test(start) || !timePattern.test(end) || start >= end) return weeklyError;
  const weekday = Number(weekdayValue);

  try {
    const destination = accessDestination(await source.access());
    if (destination) return destination;
    const current = normalizeWeeklyRanges(await source.readWeekly());
    const next = applyWeeklyChange(current, { weekday, start, end }, intent);
    if (!next) return weeklyError;
    await source.writeWeekly(next);
    return availabilityPath;
  } catch (error) { console.error('[call-availability] weekly', error); return weeklyError; }
}

export async function submitBlockedDate(form: FormData, origin: string | null,
  configured: string | undefined, source: BlockedDateSource) {
  if (!trustedOrigin(origin, configured)) return blockedError;
  if (!onlyFields(form, ['intent', 'day'])) return blockedError;
  const intent = singleField(form, 'intent');
  const day = singleField(form, 'day');
  if (intent !== 'add' && intent !== 'remove') return blockedError;
  if (day === null || !isCalendarDate(day)) return blockedError;

  try {
    const destination = accessDestination(await source.access());
    if (destination) return destination;
    if (intent === 'add') await source.addBlocked(day);
    else await source.removeBlocked(day);
    return availabilityPath;
  } catch { return blockedError; }
}

export async function submitCancelBooking(appointmentId: string, form: FormData,
  origin: string | null, configured: string | undefined, source: CancelBookingSource) {
  if (!uuidPattern.test(appointmentId)) return availabilityPath;
  if (!trustedOrigin(origin, configured)) return cancelError;
  if (!onlyFields(form, [])) return cancelError;

  try {
    const destination = accessDestination(await source.access());
    if (destination) return destination;
    await source.cancelBooking(appointmentId);
    return availabilityPath;
  } catch { return cancelError; }
}

// Renders an instant as the local America/Bogota calendar date (YYYY-MM-DD).
export function bogotaDate(instant: string): string | null {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  const year = value('year');
  const month = value('month');
  const day = value('day');
  return year && month && day ? `${year}-${month}-${day}` : null;
}

// Distinct Bogota dates that hold at least one active (non-cancelled) booking.
export function collectBookedDates(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  const dates = new Set<string>();
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    if (record.status === 'cancelled') continue;
    if (typeof record.starts_at !== 'string') continue;
    const date = bogotaDate(record.starts_at);
    if (date) dates.add(date);
  }
  return [...dates].sort();
}

export type CalendarStatus = 'booked' | 'blocked' | 'free' | 'outside';
export interface CalendarCell { date: string | null; day: number | null; status: CalendarStatus; }

// Builds a Sunday-first month grid. Leading/trailing blanks are `outside`; each
// real date is `blocked` when explicitly blocked, otherwise `booked` when it
// holds an active appointment, otherwise `free`.
export function buildMonthCalendar(year: number, month: number,
  blockedDates: Iterable<string>, bookedDates: Iterable<string>): CalendarCell[] {
  const blocked = new Set(blockedDates);
  const booked = new Set(bookedDates);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: CalendarCell[] = [];
  for (let blank = 0; blank < firstWeekday; blank += 1) {
    cells.push({ date: null, day: null, status: 'outside' });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status: CalendarStatus = blocked.has(date) ? 'blocked'
      : booked.has(date) ? 'booked' : 'free';
    cells.push({ date, day, status });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null, status: 'outside' });
  return cells;
}
