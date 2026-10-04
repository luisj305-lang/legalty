import test from 'node:test';
import assert from 'node:assert/strict';
import { navItems } from '../lib/cases/nav.ts';

test('admins see the Clientes and calls links alongside the shared links', () => {
  const items = navItems('admin');
  assert.equal(items.length, 5);
  assert.deepEqual(items.map(item => item.href), [
    '/portal/cases',
    '/portal/cases/clients',
    '/portal/calls/availability',
    '/portal/setup/password',
    '/portal/setup/mfa',
  ]);
  assert.deepEqual(items.find(item => item.href === '/portal/cases/clients'),
    { href: '/portal/cases/clients', label: 'Clientes', adminOnly: true });
  assert.deepEqual(items.find(item => item.href === '/portal/calls/availability'),
    { href: '/portal/calls/availability', label: 'Disponibilidad de llamadas', adminOnly: false });
});

test('staff see the calls link but never the admin-only Clientes link', () => {
  const items = navItems('staff');
  assert.equal(items.length, 4);
  assert.equal(items.some(item => item.href === '/portal/cases/clients'), false);
  assert.deepEqual(items.map(item => item.href), [
    '/portal/cases',
    '/portal/calls/availability',
    '/portal/setup/password',
    '/portal/setup/mfa',
  ]);
});

test('clients and signed-out users only see the shared links', () => {
  for (const role of ['client', null] as const) {
    const items = navItems(role);
    assert.equal(items.length, 3);
    assert.equal(items.some(item => item.href === '/portal/cases/clients'), false);
    assert.equal(items.some(item => item.href === '/portal/calls/availability'), false);
    assert.deepEqual(items.map(item => item.href), [
      '/portal/cases',
      '/portal/setup/password',
      '/portal/setup/mfa',
    ]);
  }
});

test('each call returns a fresh array that callers can mutate safely', () => {
  const first = navItems('admin');
  const second = navItems('admin');
  assert.notEqual(first, second);
  first.push({ href: '/mutated', label: 'Mutated', adminOnly: false });
  assert.equal(navItems('admin').length, 5);
});
