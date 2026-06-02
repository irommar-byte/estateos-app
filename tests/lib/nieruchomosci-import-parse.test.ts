import test from 'node:test';
import assert from 'node:assert/strict';

const SAMPLE = `
<ul><li>
  <strong>Czynsz:</strong>
  <span>600&nbsp;zł</span>
</li></ul>
<ul><li>
  <strong>Media:</strong>
  <span>ogrzewanie: miejskie</span>
</li></ul>
`;

test('Nieruchomosci HTML exposes czynsz and district heating labels', () => {
  const czynsz = SAMPLE.match(
    /<strong>\s*Czynsz:\s*<\/strong>\s*<span[^>]*>\s*([\d\s.&nbsp;]+)\s*zł/i,
  )?.[1];
  assert.ok(czynsz?.includes('600'));
  const media = SAMPLE.match(
    /<strong>\s*Media:\s*<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>/i,
  )?.[1];
  assert.match(media || '', /ogrzewanie:\s*miejskie/i);
});
