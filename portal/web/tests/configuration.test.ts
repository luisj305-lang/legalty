import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePublicConfiguration } from '../lib/configuration.ts';

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only',
};

test('missing configuration never enables an integration', () => {
  for (const input of [{}, { ...valid, NEXT_PUBLIC_SUPABASE_URL: '' },
    { ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined }]) {
    assert.equal(parsePublicConfiguration(input), null);
  }
});

test('rejects insecure or ambiguous endpoint URLs', () => {
  for (const url of ['http://example.supabase.co', 'invalid',
    'https://user:password@example.com', 'https://example.com/path',
    'https://example.com?token=test', 'https://example.com#fragment',
    ' https://example.com', 'https://exa\nmple.com']) {
    assert.equal(parsePublicConfiguration({ ...valid, NEXT_PUBLIC_SUPABASE_URL: url }), null);
  }
});

test('accepts only the explicit publishable-key format, not server secrets', () => {
  for (const key of ['', 'sb_secret_test', 'eyJlegacy-token', 'sb_publishable_', ' sb_publishable_test']) {
    assert.equal(parsePublicConfiguration({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }), null);
  }
});

test('returns only normalized public settings without mutating input', () => {
  assert.deepEqual(parsePublicConfiguration(Object.freeze(valid)), {
    url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test-only',
  });
});
