import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCaseParticipants, submitParticipantUpdate,
  type ParticipantUpdateSource } from '../lib/cases/participants.ts';

const origin = 'https://portal.example';
const caseId = '11111111-1111-4111-8111-111111111111';
const clientId = '20000000-0000-4000-8000-000000000001';
const otherClientId = '20000000-0000-4000-8000-000000000002';
const staffId = '30000000-0000-4000-8000-000000000001';
const expected = { clientIds: [clientId], staffIds: [staffId] };

function form(clientEmails = 'client@example.com', staffEmails = 'staff@example.com') {
  const data = new FormData();
  data.set('clientEmails', clientEmails);
  data.set('staffEmails', staffEmails);
  return data;
}

function fixture(role: 'admin' | 'staff' | 'client' = 'admin') {
  const calls: unknown[] = [];
  let next = 10;
  const source: ParticipantUpdateSource = {
    access: async () => ({ state: 'eligible', userId: `${role}-id`, role }),
    visibleCase: async id => { calls.push(['visible', id]); return { id }; },
    findParticipant: async (email, participantRole) => {
      calls.push(['find', email, participantRole]);
      return [{ id: `40000000-0000-4000-8000-${String(next++).padStart(12, '0')}`, email, role: participantRole }];
    },
    replaceParticipants: async (id, previous, desired) => {
      calls.push(['replace', id, previous, desired]); return true;
    },
  };
  return { source, calls };
}

test('current participant rows are validated and canonicalized without exposing other profile fields', () => {
  assert.deepEqual(parseCaseParticipants([
    { id: otherClientId, email: 'other@example.com', role: 'client' },
    { id: staffId, email: 'staff@example.com', role: 'staff' },
    { id: clientId, email: 'client@example.com', role: 'client' },
  ]), { clientIds: [clientId, otherClientId], staffIds: [staffId],
    clientEmails: ['client@example.com', 'other@example.com'], staffEmails: ['staff@example.com'] });
  for (const value of [null, {},
    [{ id: 'bad', email: 'client@example.com', role: 'client' }],
    [{ id: clientId, email: 'not-email', role: 'client' }],
    [{ id: clientId, email: 'client@example.com', role: 'owner' }],
    [{ id: clientId, email: 'client@example.com', role: 'client' },
      { id: clientId, email: 'staff@example.com', role: 'staff' }],
    [{ id: clientId, email: 'SAME@example.com', role: 'client' },
      { id: staffId, email: 'same@example.com', role: 'staff' }],
  ]) assert.equal(parseCaseParticipants(value), null);
});

test('admin resolves exact emails then performs one route-bound replacement with trusted expected sets', async () => {
  const { source, calls } = fixture();
  const result = await submitParticipantUpdate(caseId, expected,
    form('SECOND@example.com\nfirst@example.com', 'lawyer@example.com'), origin, origin, source);
  assert.equal(result, `/cases/${caseId}`);
  assert.deepEqual(calls.slice(0, 4), [
    ['visible', caseId], ['find', 'SECOND@example.com', 'client'],
    ['find', 'first@example.com', 'client'], ['find', 'lawyer@example.com', 'staff'],
  ]);
  assert.deepEqual(calls[4], ['replace', caseId, expected, {
    clientIds: ['40000000-0000-4000-8000-000000000010', '40000000-0000-4000-8000-000000000011'],
    staffIds: ['40000000-0000-4000-8000-000000000012'],
  }]);
});

test('RPC false is a successful no-op', async () => {
  const { source } = fixture();
  source.replaceParticipants = async () => false;
  assert.equal(await submitParticipantUpdate(caseId, expected, form(), origin, origin, source), `/cases/${caseId}`);
});

test('origin, route, closed fields, email syntax, duplicates and bounds fail before access', async () => {
  const invalid: [string, FormData, string | null][] = [
    [caseId, form(), 'https://foreign.example'], ['bad-id', form(), origin],
    [caseId, (() => { const value = form(); value.set('caseId', caseId); return value; })(), origin],
    [caseId, (() => { const value = form(); value.append('clientEmails', 'other@example.com'); return value; })(), origin],
    [caseId, form('not-email'), origin], [caseId, form('Same@example.com', 'same@example.com'), origin],
    [caseId, form('  ', ''), origin],
    [caseId, form(Array.from({ length: 101 }, (_, i) => `c${i}@example.com`).join('\n')), origin],
    [caseId, form('client@example.com', Array.from({ length: 101 }, (_, i) => `s${i}@example.com`).join('\n')), origin],
    [caseId, form('x'.repeat(25501), ''), origin],
  ];
  for (const [id, data, requestOrigin] of invalid) {
    const denied = fixture();
    let accessed = false;
    denied.source.access = async () => { accessed = true; return { state: 'eligible', userId: 'admin-id', role: 'admin' }; };
    await submitParticipantUpdate(id, expected, data, requestOrigin, origin, denied.source);
    assert.equal(accessed, false);
    assert.deepEqual(denied.calls, []);
  }
});

test('ineligible, invisible, malformed and failed provider paths remain safe and generic', async () => {
  for (const role of ['staff', 'client'] as const) {
    const denied = fixture(role);
    assert.equal(await submitParticipantUpdate(caseId, expected, form(), origin, origin, denied.source), `/cases/${caseId}`);
    assert.deepEqual(denied.calls, []);
  }
  const signedOut = fixture();
  signedOut.source.access = async () => ({ state: 'signed_out' });
  assert.equal(await submitParticipantUpdate(caseId, expected, form(), origin, origin, signedOut.source), '/login');
  const pending = fixture();
  pending.source.access = async () => ({ state: 'setup_pending', userId: 'pending-id' });
  assert.equal(await submitParticipantUpdate(caseId, expected, form(), origin, origin, pending.source), '/account');
  for (const failure of ['invisible', 'lookup', 'replace'] as const) {
    const denied = fixture();
    if (failure === 'invisible') denied.source.visibleCase = async () => null;
    if (failure === 'lookup') denied.source.findParticipant = async () => [{ id: clientId, email: 'other@example.com', role: 'client' }];
    if (failure === 'replace') denied.source.replaceParticipants = async () => { throw new Error('SYNTHETIC_DATABASE_SECRET'); };
    const result = await submitParticipantUpdate(caseId, expected, form(), origin, origin, denied.source);
    assert.ok(result === '/cases' || result === `/cases/${caseId}/edit?error=participants`);
    if (failure !== 'replace') assert.equal(denied.calls.some(call => Array.isArray(call) && call[0] === 'replace'), false);
    assert.doesNotMatch(result, /database|secret/i);
  }
});

test('edit integration keeps participant reads and controls administrator-only', () => {
  const page = readFileSync(new URL('../app/cases/[id]/edit/page.tsx', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../lib/cases/server.ts', import.meta.url), 'utf8');
  assert.match(page, /view\.role === 'admin'\s*\? await caseParticipants/);
  assert.match(page, /replaceCaseParticipants\.bind\(null, row\.id,\s*participants\.clientIds, participants\.staffIds\)/);
  assert.match(page, /name="clientEmails"/);
  assert.match(page, /name="staffEmails"/);
  assert.doesNotMatch(page, /name="(?:caseId|role|expectedClientIds|expectedStaffIds)"/);
  assert.ok(server.indexOf('accountAccess(client)') < server.indexOf("rpc('get_case_participants'"));
});
