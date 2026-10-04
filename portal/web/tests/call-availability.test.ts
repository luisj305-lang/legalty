import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWeeklyChange, availabilityPath, blockedError, bogotaDate, buildMonthCalendar,
  cancelError, collectBookedDates, isCalendarDate, normalizeWeeklyRanges,
  submitBlockedDate, submitCancelBooking, submitWeeklyHours, weeklyError,
  type BlockedDateSource, type CancelBookingSource, type WeeklyHoursSource,
} from '../lib/calls/availability.ts';

const origin = 'https://portal.example';
const appointmentId = '11111111-1111-4111-8111-111111111111';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

function weeklyFixture(role: 'admin' | 'staff' | 'client' = 'admin') {
  const writes: unknown[] = [];
  let current: unknown[] = [{ weekday: 1, start: '09:00', end: '12:00' }];
  const source: WeeklyHoursSource = {
    access: async () => ({ state: 'eligible', userId: `${role}-id`, role }),
    readWeekly: async () => current,
    writeWeekly: async ranges => { writes.push(ranges); },
  };
  return { source, writes, setCurrent: (value: unknown[]) => { current = value; } };
}

function blockedFixture(role: 'admin' | 'staff' | 'client' = 'admin') {
  const calls: unknown[] = [];
  const source: BlockedDateSource = {
    access: async () => ({ state: 'eligible', userId: `${role}-id`, role }),
    addBlocked: async day => { calls.push(['add', day]); },
    removeBlocked: async day => { calls.push(['remove', day]); },
  };
  return { source, calls };
}

function cancelFixture(role: 'admin' | 'staff' | 'client' = 'admin') {
  const calls: unknown[] = [];
  const source: CancelBookingSource = {
    access: async () => ({ state: 'eligible', userId: `${role}-id`, role }),
    cancelBooking: async id => { calls.push(id); },
  };
  return { source, calls };
}

test('normalizeWeeklyRanges accepts canonical ranges and raw Supabase rows', () => {
  assert.deepEqual(normalizeWeeklyRanges([
    { weekday: 2, start: '14:00', end: '16:00' },
    { weekday: 0, start_time: '08:00:00', end_time: '09:30:00' },
  ]), [
    { weekday: 0, start: '08:00', end: '09:30' },
    { weekday: 2, start: '14:00', end: '16:00' },
  ]);
});

test('normalizeWeeklyRanges drops malformed or reversed windows', () => {
  assert.deepEqual(normalizeWeeklyRanges([
    null, 'x', { weekday: 7, start: '09:00', end: '10:00' },
    { weekday: 1, start: '10:00', end: '09:00' },
    { weekday: 1, start: '9:00', end: '10:00' },
    { weekday: 1, start: '09:00', end: '10:00' },
  ]), [{ weekday: 1, start: '09:00', end: '10:00' }]);
  assert.deepEqual(normalizeWeeklyRanges('not-an-array'), []);
});

test('applyWeeklyChange adds, rejects duplicates and removes by weekday/start', () => {
  const base = [{ weekday: 1, start: '09:00', end: '12:00' }];
  assert.deepEqual(applyWeeklyChange(base, { weekday: 3, start: '14:00', end: '15:00' }, 'add'), [
    { weekday: 1, start: '09:00', end: '12:00' },
    { weekday: 3, start: '14:00', end: '15:00' },
  ]);
  assert.equal(applyWeeklyChange(base, { weekday: 1, start: '09:00', end: '11:00' }, 'add'), null);
  assert.deepEqual(applyWeeklyChange(base, { weekday: 1, start: '09:00', end: '12:00' }, 'remove'), []);
  assert.deepEqual(applyWeeklyChange(base, { weekday: 2, start: '09:00', end: '12:00' }, 'remove'), base);
});

test('bogotaDate converts instants to the local America/Bogota date', () => {
  assert.equal(bogotaDate('2026-10-21T02:00:00Z'), '2026-10-20');
  assert.equal(bogotaDate('2026-10-05T14:30:00Z'), '2026-10-05');
  assert.equal(bogotaDate('not-a-date'), null);
});

test('collectBookedDates maps active bookings and skips cancelled ones', () => {
  assert.deepEqual(collectBookedDates([
    { starts_at: '2026-10-21T02:00:00Z', status: 'pending_payment' },
    { starts_at: '2026-10-05T14:30:00Z', status: 'confirmed' },
    { starts_at: '2026-10-06T14:30:00Z', status: 'cancelled' },
    null,
    { starts_at: 7 },
  ]), ['2026-10-05', '2026-10-20']);
});

test('buildMonthCalendar marks blocked, booked and free dates in a month grid', () => {
  // 2026-10-01 is a Thursday, so the first grid row has four leading blanks.
  const cells = buildMonthCalendar(2026, 10, ['2026-10-05'], ['2026-10-06']);
  assert.equal(cells.length, 35);
  assert.deepEqual(cells.slice(0, 4).map(cell => cell.status), ['outside', 'outside', 'outside', 'outside']);
  assert.equal(cells[4]!.day, 1);
  assert.equal(cells[4]!.status, 'free');
  assert.equal(cells[8]!.date, '2026-10-05');
  assert.equal(cells[8]!.status, 'blocked');
  assert.equal(cells[9]!.status, 'booked');
  assert.equal(cells[10]!.status, 'free');
});

test('isCalendarDate rejects impossible and malformed dates', () => {
  assert.equal(isCalendarDate('2026-10-05'), true);
  assert.equal(isCalendarDate('2026-02-30'), false);
  assert.equal(isCalendarDate('2026-13-01'), false);
  assert.equal(isCalendarDate('05-10-2026'), false);
  assert.equal(isCalendarDate('2026-2-5'), false);
});

test('admin and staff add a weekly window with the full desired set', async () => {
  for (const role of ['admin', 'staff'] as const) {
    const { source, writes } = weeklyFixture(role);
    const result = await submitWeeklyHours(form({ intent: 'add', weekday: '2', start: '14:00', end: '16:00' }),
      origin, origin, source);
    assert.equal(result, availabilityPath);
    assert.deepEqual(writes, [[
      { weekday: 1, start: '09:00', end: '12:00' },
      { weekday: 2, start: '14:00', end: '16:00' },
    ]]);
  }
});

test('a duplicate weekly window fails before any write', async () => {
  const { source, writes } = weeklyFixture();
  const result = await submitWeeklyHours(form({ intent: 'add', weekday: '1', start: '09:00', end: '10:00' }),
    origin, origin, source);
  assert.equal(result, weeklyError);
  assert.deepEqual(writes, []);
});

test('removing a weekly window writes the filtered set', async () => {
  const { source, writes } = weeklyFixture();
  const result = await submitWeeklyHours(form({ intent: 'remove', weekday: '1', start: '09:00', end: '12:00' }),
    origin, origin, source);
  assert.equal(result, availabilityPath);
  assert.deepEqual(writes, [[]]);
});

test('foreign origin fails weekly, blocked and cancel before access', async () => {
  for (const requestOrigin of ['https://foreign.example', null]) {
    const weekly = weeklyFixture();
    assert.equal(await submitWeeklyHours(form({ intent: 'add', weekday: '2', start: '14:00', end: '16:00' }),
      requestOrigin, origin, weekly.source), weeklyError);
    assert.deepEqual(weekly.writes, []);

    const blocked = blockedFixture();
    assert.equal(await submitBlockedDate(form({ intent: 'add', day: '2026-10-05' }), requestOrigin, origin, blocked.source),
      blockedError);
    assert.deepEqual(blocked.calls, []);

    const cancel = cancelFixture();
    assert.equal(await submitCancelBooking(appointmentId, new FormData(), requestOrigin, origin, cancel.source),
      cancelError);
    assert.deepEqual(cancel.calls, []);
  }
});

test('clients and ineligible sessions stop before the write', async () => {
  const client = blockedFixture('client');
  assert.equal(await submitBlockedDate(form({ intent: 'add', day: '2026-10-05' }), origin, origin, client.source),
    '/portal/cases');
  assert.deepEqual(client.calls, []);

  const signedOut = weeklyFixture();
  signedOut.source.access = async () => ({ state: 'signed_out' });
  assert.equal(await submitWeeklyHours(form({ intent: 'add', weekday: '2', start: '14:00', end: '16:00' }),
    origin, origin, signedOut.source), '/portal/login');

  const pending = cancelFixture();
  pending.source.access = async () => ({ state: 'setup_pending', userId: 'pending-id' });
  assert.equal(await submitCancelBooking(appointmentId, new FormData(), origin, origin, pending.source),
    '/portal/account');
  assert.deepEqual(pending.calls, []);
});

test('malformed weekly edits fail before access', async t => {
  const invalid: [string, FormData][] = [
    ['missing intent', form({ weekday: '1', start: '09:00', end: '10:00' })],
    ['bad intent', form({ intent: 'save', weekday: '1', start: '09:00', end: '10:00' })],
    ['bad weekday', form({ intent: 'add', weekday: '7', start: '09:00', end: '10:00' })],
    ['bad start', form({ intent: 'add', weekday: '1', start: '9:00', end: '10:00' })],
    ['reversed', form({ intent: 'add', weekday: '1', start: '10:00', end: '09:00' })],
    ['unknown field', (() => { const data = form({ intent: 'add', weekday: '1', start: '09:00', end: '10:00' }); data.set('role', 'admin'); return data; })()],
    ['duplicate field', (() => { const data = form({ intent: 'add', weekday: '1', start: '09:00', end: '10:00' }); data.append('start', '11:00'); return data; })()],
  ];
  for (const [name, data] of invalid) await t.test(name, async () => {
    const denied = weeklyFixture();
    let accessed = false;
    denied.source.access = async () => { accessed = true; return { state: 'eligible', userId: 'admin-id', role: 'admin' }; };
    assert.equal(await submitWeeklyHours(data, origin, origin, denied.source), weeklyError);
    assert.equal(accessed, false);
    assert.deepEqual(denied.writes, []);
  });
});

test('blocked dates add and remove through the matching RPC', async () => {
  for (const intent of ['add', 'remove'] as const) {
    const { source, calls } = blockedFixture();
    assert.equal(await submitBlockedDate(form({ intent, day: '2026-10-05' }), origin, origin, source),
      availabilityPath);
    assert.deepEqual(calls, [[intent, '2026-10-05']]);
  }
});

test('impossible blocked dates and tampered fields fail before access', async () => {
  const impossible = blockedFixture();
  assert.equal(await submitBlockedDate(form({ intent: 'add', day: '2026-02-30' }), origin, origin, impossible.source),
    blockedError);
  assert.deepEqual(impossible.calls, []);

  const tampered = blockedFixture();
  const data = form({ intent: 'add', day: '2026-10-05' });
  data.set('extra', 'x');
  assert.equal(await submitBlockedDate(data, origin, origin, tampered.source), blockedError);
  assert.deepEqual(tampered.calls, []);
});

test('admin and staff cancel a booking; malformed ids never reach the provider', async () => {
  for (const role of ['admin', 'staff'] as const) {
    const { source, calls } = cancelFixture(role);
    assert.equal(await submitCancelBooking(appointmentId, new FormData(), origin, origin, source),
      availabilityPath);
    assert.deepEqual(calls, [appointmentId]);
  }

  const malformed = cancelFixture();
  assert.equal(await submitCancelBooking('not-a-uuid', new FormData(), origin, origin, malformed.source),
    availabilityPath);
  assert.deepEqual(malformed.calls, []);

  const tampered = cancelFixture();
  const data = new FormData();
  data.set('appointmentId', appointmentId);
  assert.equal(await submitCancelBooking(appointmentId, data, origin, origin, tampered.source), cancelError);
  assert.deepEqual(tampered.calls, []);
});

test('provider failures stay generic and never leak internals', async () => {
  const weekly = weeklyFixture();
  weekly.source.writeWeekly = async () => { throw new Error('SYNTHETIC_DATABASE_SECRET'); };
  const saved = await submitWeeklyHours(form({ intent: 'add', weekday: '2', start: '14:00', end: '16:00' }),
    origin, origin, weekly.source);
  assert.equal(saved, weeklyError);
  assert.doesNotMatch(saved, /database|secret/i);

  const cancel = cancelFixture();
  cancel.source.cancelBooking = async () => { throw new Error('SYNTHETIC_DATABASE_SECRET'); };
  const cancelled = await submitCancelBooking(appointmentId, new FormData(), origin, origin, cancel.source);
  assert.equal(cancelled, cancelError);
  assert.doesNotMatch(cancelled, /database|secret/i);
});
