import test from 'node:test';
import assert from 'node:assert/strict';
import { submitCaseUpdate, type CaseUpdateSource } from '../lib/cases/update.ts';

const origin = 'https://portal.example';
const id = '11111111-1111-4111-8111-111111111111';

function form(values: Partial<Record<'title' | 'description' | 'status' | 'nextAction', string>> = {}) {
  const data = new FormData();
  for (const [name, value] of Object.entries({
    title: 'Updated case', description: 'Client-visible update', status: 'in_progress',
    nextAction: 'Review the response', ...values,
  })) data.set(name, value);
  return data;
}

function fixture(role: 'admin' | 'staff' | 'client' = 'admin') {
  const calls: unknown[] = [];
  const source: CaseUpdateSource = {
    access: async () => ({ state: 'eligible', userId: `${role}-id`, role }),
    visibleCase: async caseId => { calls.push(['visible', caseId]); return { id: caseId }; },
    updateCase: async (caseId, input) => { calls.push(['update', caseId, input]); return true; },
  };
  return { source, calls };
}

test('fresh admin and assigned staff validate visibility before one scoped update', async () => {
  for (const role of ['admin', 'staff'] as const) {
    const { source, calls } = fixture(role);
    assert.equal(await submitCaseUpdate(id, form(), origin, origin, source), `/portal/cases/${id}`);
    assert.deepEqual(calls, [
      ['visible', id],
      ['update', id, { title: 'Updated case', description: 'Client-visible update',
        status: 'in_progress', nextAction: 'Review the response' }],
    ]);
  }
});

test('only the four canonical database statuses are accepted', async () => {
  for (const status of ['open', 'in_progress', 'waiting', 'closed']) {
    const { source } = fixture();
    assert.equal(await submitCaseUpdate(id, form({ status }), origin, origin, source), `/portal/cases/${id}`);
  }
  const denied = fixture();
  assert.equal(await submitCaseUpdate(id, form({ status: 'review' }), origin, origin, denied.source),
    `/portal/cases/${id}/edit?error=update`);
  assert.deepEqual(denied.calls, []);
});

test('foreign origin, malformed route id and tampered or invalid fields fail before access', async t => {
  const invalid: [string, string, () => FormData, string | null][] = [
    ['foreign origin', id, () => form(), 'https://foreign.example'],
    ['malformed id', 'not-a-uuid', () => form(), origin],
    ['submitted id', id, () => { const data = form(); data.set('caseId', id); return data; }, origin],
    ['unknown field', id, () => { const data = form(); data.set('role', 'admin'); return data; }, origin],
    ['duplicate field', id, () => { const data = form(); data.append('title', 'Other'); return data; }, origin],
    ['empty title', id, () => form({ title: '  ' }), origin],
    ['long title', id, () => form({ title: 'T'.repeat(201) }), origin],
    ['long description', id, () => form({ description: 'D'.repeat(10001) }), origin],
    ['long next action', id, () => form({ nextAction: 'N'.repeat(2001) }), origin],
  ];
  for (const [name, caseId, make, requestOrigin] of invalid) await t.test(name, async () => {
    const denied = fixture();
    let accessed = false;
    denied.source.access = async () => { accessed = true; return { state: 'eligible', userId: 'admin-id', role: 'admin' }; };
    const result = await submitCaseUpdate(caseId, make(), requestOrigin, origin, denied.source);
    assert.equal(result, caseId === id ? `/portal/cases/${id}/edit?error=update` : '/portal/cases');
    assert.equal(accessed, false);
    assert.deepEqual(denied.calls, []);
  });
});

test('clients and ineligible sessions stop before scope lookup and write', async () => {
  const client = fixture('client');
  assert.equal(await submitCaseUpdate(id, form(), origin, origin, client.source), `/portal/cases/${id}`);
  assert.deepEqual(client.calls, []);

  const signedOut = fixture();
  signedOut.source.access = async () => ({ state: 'signed_out' });
  assert.equal(await submitCaseUpdate(id, form(), origin, origin, signedOut.source), '/portal/login');
  const pending = fixture();
  pending.source.access = async () => ({ state: 'setup_pending', userId: 'pending-id' });
  assert.equal(await submitCaseUpdate(id, form(), origin, origin, pending.source), '/portal/account');
});

test('assignment-scope mismatch and provider failures never reach the update RPC', async () => {
  for (const visible of [null, {}, { id: '22222222-2222-4222-8222-222222222222' }]) {
    const denied = fixture('staff');
    denied.source.visibleCase = async () => visible;
    assert.equal(await submitCaseUpdate(id, form(), origin, origin, denied.source), '/portal/cases');
    assert.equal(denied.calls.some(call => Array.isArray(call) && call[0] === 'update'), false);
  }
  const failed = fixture();
  failed.source.updateCase = async () => { throw new Error('SYNTHETIC_POSTGRES_SECRET'); };
  const result = await submitCaseUpdate(id, form(), origin, origin, failed.source);
  assert.equal(result, `/portal/cases/${id}/edit?error=update`);
  assert.doesNotMatch(result, /postgres|secret/i);
});
