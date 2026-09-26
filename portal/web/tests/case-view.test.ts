import test from 'node:test';
import assert from 'node:assert/strict';
import { readCaseView, summarizeCases } from '../lib/cases/read.ts';

const row = { id: '11111111-1111-4111-8111-111111111111', reference: 'SYN-1', title: 'Synthetic',
  description: '', status: 'open', next_action: '', updated_at: '2026-09-26T00:00:00Z' };
const eligible = { state: 'eligible', userId: 'own', role: 'client' } as const;

test('case reads require fresh eligible access before touching data', async () => {
  for (const access of [{ state: 'signed_out' }, { state: 'setup_pending', userId: 'own' }] as const) {
    let reads = 0;
    const result = await readCaseView({ access: async () => access, read: async () => { reads++; return []; } });
    assert.equal(result.state, access.state); assert.equal(reads, 0);
  }
});

test('case views whitelist fields and never expose provider error or internal extras', async () => {
  const result = await readCaseView({ access: async () => eligible,
    read: async () => [{ ...row, internal_note: 'PRIVATE' }] });
  assert.equal(result.state, 'ready');
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  for (const read of [async () => null, async () => [{ ...row, status: 'invented' }],
    async () => { throw new Error('PRIVATE_PROVIDER_ERROR'); }]) {
    assert.deepEqual(await readCaseView({ access: async () => eligible, read }), { state: 'error' });
  }
});

test('invalid detail ids stop before query and missing rows remain notfound', async () => {
  let queried = false;
  const source = { access: async () => eligible, read: async () => { queried = true; return []; } };
  assert.deepEqual(await readCaseView(source, '../bad'), { state: 'not_found' });
  assert.equal(queried, false);
  assert.deepEqual(await readCaseView(source, row.id), { state: 'not_found' });
});

test('dashboard counts describe only real rows in the bounded view', async () => {
  const result = await readCaseView({ access: async () => eligible, read: async () => [row, { ...row, status: 'closed' }] });
  if (result.state !== 'ready') assert.fail('Expected real rows');
  assert.deepEqual(summarizeCases(result.rows), { total: 2, active: 1, waiting: 0, closed: 1 });
});
