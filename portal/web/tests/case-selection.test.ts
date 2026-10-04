import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCandidates, toggleSelection } from '../lib/cases/selection.ts';
import type { Candidate } from '../lib/cases/directory.ts';

const ana: Candidate = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com', name: 'Ana Cliente', active: true };
const bruno: Candidate = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@example.com', name: 'Bruno Staff', active: false };
const carla: Candidate = { id: '33333333-3333-4333-8333-333333333333', email: 'carla@example.com', name: null, active: true };
const all: Candidate[] = [ana, bruno, carla];

test('filterCandidates matches a name substring case-insensitively', () => {
  assert.deepEqual(filterCandidates(all, 'CLIENTE'), [ana]);
});

test('filterCandidates matches by email', () => {
  assert.deepEqual(filterCandidates(all, 'bruno@'), [bruno]);
});

test('filterCandidates matches a partial case-insensitive query', () => {
  assert.deepEqual(filterCandidates(all, 'arl'), [carla]);
});

test('a whitespace-only query returns every candidate in stable order as a new list', () => {
  const result = filterCandidates(all, '   ');
  assert.deepEqual(result, all);
  assert.notEqual(result, all);
});

test('no match returns an empty list', () => {
  assert.deepEqual(filterCandidates(all, 'zzz'), []);
});

test('filterCandidates never mutates its input', () => {
  const snapshot = structuredClone(all);
  filterCandidates(all, 'ana');
  assert.deepEqual(all, snapshot);
  assert.deepEqual(filterCandidates([], 'ana'), []);
});

test('toggleSelection adds an absent value and removes a present one', () => {
  assert.deepEqual(toggleSelection([], 'a'), ['a']);
  assert.deepEqual(toggleSelection(['a', 'b'], 'b'), ['a']);
});

test('toggleSelection preserves insertion order', () => {
  const selected = toggleSelection(toggleSelection(['b'], 'a'), 'c');
  assert.deepEqual(selected, ['b', 'a', 'c']);
});

test('toggleSelection never mutates its input', () => {
  const original = ['a'];
  toggleSelection(original, 'b');
  assert.deepEqual(original, ['a']);
});

test('toggleSelection does not add a duplicate of an already-selected value', () => {
  assert.deepEqual(toggleSelection(['a'], 'a'), []);
});
