import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCandidates, type Candidate } from '../lib/cases/directory.ts';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'client@example.com',
    name: 'Ana Cliente',
    active: true,
    ...overrides,
  };
}

test('valid directory rows parse with names, null names and active flags', () => {
  const value = [
    row(),
    row({ id: '22222222-2222-4222-8222-222222222222', email: 'second@example.com', name: null, active: false }),
  ];
  const parsed = parseCandidates(value);
  const expected: Candidate[] = [
    { id: '11111111-1111-4111-8111-111111111111', email: 'client@example.com', name: 'Ana Cliente', active: true },
    { id: '22222222-2222-4222-8222-222222222222', email: 'second@example.com', name: null, active: false },
  ];
  assert.deepEqual(parsed, expected);
});

test('an empty directory is a valid empty list', () => {
  assert.deepEqual(parseCandidates([]), []);
});

test('malformed rows are rejected as a whole', () => {
  const invalid: [string, unknown][] = [
    ['non-array', 'candidates'],
    ['null', null],
    ['array of null', [null]],
    ['missing id', [row({ id: undefined })]],
    ['non-uuid id', [row({ id: 'not-a-uuid' })]],
    ['missing email', [row({ email: undefined })]],
    ['malformed email', [row({ email: 'not-an-email' })]],
    ['untrimmed email', [row({ email: ' client@example.com ' })]],
    ['over-long email', [row({ email: `${'a'.repeat(250)}@example.com` })]],
    ['numeric name', [row({ name: 7 })]],
    ['empty name', [row({ name: '   ' })]],
    ['non-boolean active', [row({ active: 'true' })]],
    ['missing active', [row({ active: undefined })]],
    ['duplicate id', [row(), row({ email: 'other@example.com' })]],
    ['duplicate email', [row(), row({ id: '33333333-3333-4333-8333-333333333333', email: 'CLIENT@example.com' })]],
  ];
  for (const [label, value] of invalid) assert.equal(parseCandidates(value), null, label);
});

test('over-cap directories are rejected', () => {
  const value = Array.from({ length: 1001 }, (_, index) => row({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    email: `user${index}@example.com`,
  }));
  assert.equal(parseCandidates(value), null);
});
