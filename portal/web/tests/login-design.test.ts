import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('approved login keeps native authentication in a responsive split presentation', () => {
  const page = readFileSync(new URL('../app/portal/login/page.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../app/portal/login/login.css', import.meta.url), 'utf8');
  assert.match(page, /className="login-layout"/);
  assert.match(page, /action=\{login\}/);
  assert.match(page, /role="alert"/);
  assert.match(page, /autoComplete="username"/);
  assert.match(page, /autoComplete="current-password"/);
  assert.match(css, /53fr 47fr/);
  assert.match(css, /@media/);
  assert.doesNotMatch(page, /href="#"|forgot-password|dangerouslySetInnerHTML/);
});
