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

const SAMPLE_HTML_ANCHOR = `
<ul><li>
  <strong>Media:</strong>
  <span>ogrzewanie: <a href="//wroclaw.nieruchomosci-online.pl/mieszkania">miejskie</a></span>
</li></ul>
`;

function plainImportListText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeImportHeating(raw) {
  const plain = plainImportListText(String(raw || ''));
  const probe = plain.toLowerCase();
  if (!probe) return null;
  if (/miejsk|ciepłoci|mco|co\s+miejsk|centraln/i.test(probe)) return 'Miejskie';
  if (/<a\s|href\s*=|https?:\/\//i.test(plain)) return null;
  if (plain.length > 48) return null;
  return 'Inne';
}

function extractNierOnlineListValue(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<strong>\\s*${escaped}\\s*:\\s*<\\/strong>\\s*<span[^>]*>([\\s\\S]*?)<\\/span>`,
    'i',
  );
  const match = html.match(re);
  if (!match?.[1]) return '';
  return plainImportListText(match[1]);
}

function parseNierOnlineHeating(html) {
  const media = extractNierOnlineListValue(html, 'Media');
  if (!media) return null;
  const labeled = media.match(/ogrzewanie\s*:\s*([^,;]+)/i);
  if (labeled?.[1]) return sanitizeImportHeating(labeled[1]);
  if (/miejsk/i.test(media)) return 'Miejskie';
  return sanitizeImportHeating(media.length <= 80 ? media : null);
}

test('Nieruchomosci HTML exposes czynsz and district heating labels', () => {
  const czynsz = SAMPLE.match(
    /<strong>\s*Czynsz:\s*<\/strong>\s*<span[^>]*>\s*([\d\s.&nbsp;]+)\s*zł/i,
  )?.[1];
  assert.ok(czynsz?.includes('600'));
  const media = SAMPLE.match(
    /<strong>\s*Media:\s*<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>/i,
  )?.[1];
  assert.match(media || '', /ogrzewanie:\s*miejskie/i);
  assert.equal(parseNierOnlineHeating(SAMPLE), 'Miejskie');
});

test('Nieruchomosci heating strips anchor HTML instead of leaking href', () => {
  const media = extractNierOnlineListValue(SAMPLE_HTML_ANCHOR, 'Media');
  assert.equal(media, 'ogrzewanie: miejskie');
  assert.equal(parseNierOnlineHeating(SAMPLE_HTML_ANCHOR), 'Miejskie');
  assert.doesNotMatch(String(parseNierOnlineHeating(SAMPLE_HTML_ANCHOR) || ''), /<a|href/i);
});
