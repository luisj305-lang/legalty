const test = require('node:test');
const assert = require('node:assert/strict');
const { canReadCase, canReadRecord } = require('../domain/access-policy.cjs');

const principal = (role, id = `${role}-1`) => ({ id, role, active: true });
const caseFile = () => ({ id: 'case-1', staffIds: ['staff-1'], clientIds: ['client-1', 'client-2'] });
const record = (visibility = 'client', clientIds = ['client-1']) => ({
  id: 'record-1', caseId: 'case-1', visibility, clientIds,
});

test('recognized active roles read only their case scope', () => {
  for (const role of ['admin', 'staff', 'client']) {
    assert.equal(canReadCase(principal(role), caseFile()), true);
  }
  assert.equal(canReadCase(principal('staff', 'staff-2'), caseFile()), false);
  assert.equal(canReadCase(principal('client', 'client-3'), caseFile()), false);
  assert.equal(canReadCase(principal('admin'), { ...caseFile(), staffIds: [], clientIds: [] }), true);
});

test('missing, inactive, revoked, unknown and malformed principals fail closed', () => {
  const invalid = [undefined, null, [], {}, ...['', ' ', ' client-1 ', 1, false].map(id => principal('client', id)),
    Object.create(principal('admin')), principal('owner'), principal('ADMIN'),
    ...[false, undefined, 'true', 1].map(active => ({ ...principal('admin'), active }))];
  for (const actor of invalid) {
    assert.equal(canReadCase(actor, caseFile()), false);
    assert.equal(canReadRecord(actor, caseFile(), record()), false);
  }
});

test('case shape and every relationship identifier are validated even for admin', () => {
  const invalid = [undefined, null, [], {}, { ...caseFile(), id: '' }, { ...caseFile(), id: 1 },
    ...[undefined, null, 'staff-1', ['staff-1', ''], ['staff-1', 1], new Array(1)].map(staffIds => ({ ...caseFile(), staffIds })),
    ...[undefined, null, {}, ['client-1', ' '], ['client-1', null]].map(clientIds => ({ ...caseFile(), clientIds }))];
  for (const item of invalid) {
    assert.equal(canReadCase(principal('admin'), item), false);
    assert.equal(canReadRecord(principal('admin'), item, record()), false);
  }
});

test('relationship removal and inactive identity immediately deny subsequent calls', () => {
  const item = caseFile();
  assert.equal(canReadCase(principal('staff'), item), true);
  assert.equal(canReadCase(principal('staff'), { ...item, staffIds: [] }), false);
  assert.equal(canReadRecord(principal('client'), { ...item, clientIds: [] }, record()), false);
  assert.equal(canReadRecord({ ...principal('admin'), active: false }, item, record()), false);
});

test('internal records require admin or assigned staff', () => {
  const internal = record('internal', []);
  for (const role of ['admin', 'staff']) {
    assert.equal(canReadRecord(principal(role), caseFile(), internal), true);
  }
  assert.equal(canReadRecord(principal('client'), caseFile(), internal), false);
  assert.equal(canReadRecord(principal('staff', 'staff-2'), caseFile(), internal), false);
});

test('client visibility requires explicit record audience, not just shared case membership', () => {
  const item = caseFile();
  for (const role of ['admin', 'staff', 'client']) {
    assert.equal(canReadRecord(principal(role), item, record()), true);
  }
  assert.equal(canReadRecord(principal('client', 'client-2'), item, record()), false);
  assert.equal(canReadRecord(principal('client', 'client-2'), item, record('client', ['client-1', 'client-2'])), true);
  assert.equal(canReadRecord(principal('client', 'client-3'), item, record('client', ['client-3'])), false);
});

test('malformed records, unknown visibility, foreign cases and invalid audiences deny every role', () => {
  const invalid = [undefined, null, [], {}, { ...record(), id: '' }, { ...record(), id: 1 },
    { ...record(), caseId: 'case-2' }, { ...record(), caseId: 1 },
    ...[undefined, null, 'public', 'CLIENT', true].map(visibility => ({ ...record(), visibility })),
    ...[undefined, null, 'client-1', [], ['client-1', ''], ['client-1', 1], ['client-3'], new Array(1)].map(clientIds => ({ ...record(), clientIds })),
    record('internal', ['client-1'])];
  invalid.push({ id: 'record-1', caseId: 'case-1', clientIds: ['client-1'] });
  for (const role of ['admin', 'staff', 'client']) {
    for (const item of invalid) {
      assert.equal(canReadRecord(principal(role), caseFile(), item), false);
    }
  }
});

test('identifier comparisons are exact strings without case folding or coercion', () => {
  assert.equal(canReadCase(principal('client', 'CLIENT-1'), caseFile()), false);
  assert.equal(canReadCase(principal('client', '1'), { ...caseFile(), clientIds: [1] }), false);
  assert.equal(canReadCase(principal('client', '1'), { ...caseFile(), clientIds: ['1'] }), true);
});

test('repeated decisions do not mutate frozen inputs', () => {
  const actor = Object.freeze(principal('client'));
  const item = Object.freeze({ ...caseFile(), staffIds: Object.freeze(['staff-1']), clientIds: Object.freeze(['client-1']) });
  const resource = Object.freeze({ ...record(), clientIds: Object.freeze(['client-1']) });
  const before = JSON.stringify([actor, item, resource]);
  for (let i = 0; i < 3; i++) {
    assert.equal(canReadCase(actor, item), true);
    assert.equal(canReadRecord(actor, item, resource), true);
  }
  assert.equal(JSON.stringify([actor, item, resource]), before);
});
