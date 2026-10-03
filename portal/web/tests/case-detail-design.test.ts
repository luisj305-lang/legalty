import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('case detail presents only authorized case fields in a concept-aligned hierarchy', () => {
  const page = source('../app/portal/cases/[id]/page.tsx');
  assert.match(page, /import styles from ['"]\.\/case-detail\.module\.css['"]/);
  assert.match(page, /<header className=\{styles\.hero\}>/);
  assert.match(page, /<p className=\{styles\.reference\}>\{row\.reference\}<\/p>/);
  assert.match(page, /<h1>\{row\.title\}<\/h1>/);
  assert.match(page, /statusLabels\[row\.status\]/);
  assert.match(page, /<time dateTime=\{row\.updated_at\}>/);
  assert.match(page, /<h2 id="case-summary">Resumen del caso<\/h2>/);
  assert.match(page, /<h2 id="next-action">Próximo paso<\/h2>/);
  assert.match(page, /Aún no hay un resumen registrado\./);
  assert.match(page, /Pendiente de definición por el equipo\./);
  assert.match(page, /href="\/portal\/cases"/);
  assert.doesNotMatch(page, /activity|document|message|appointment|service|payment|receipt|progress|milestone|avatar|notification/i);
});

test('case detail styles provide responsive navy and ivory presentation with visible focus', () => {
  const css = source('../app/portal/cases/[id]/case-detail.module.css');
  assert.match(css, /#0b3154/i);
  assert.match(css, /#f7f6f1/i);
  assert.match(css, /\.hero\s*\{/);
  assert.match(css, /\.contentGrid\s*\{/);
  assert.match(css, /grid-template-columns:/);
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /:focus-visible/);
});
