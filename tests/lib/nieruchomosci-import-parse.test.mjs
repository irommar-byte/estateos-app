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

const STOCK_PHOTO_FILENAMES = new Set([
  'mieszkanie-lublin-sprzedaz.jpg',
  'mieszkanie-przy-lesie.jpg',
  'mieszkanie-blok-mieszkalny-sprzedaz.jpg',
  'mieszkanie-blok-mieszkalny-przy-lesie.jpg',
  'mieszkanie-blok-mieszkalny-lublin.jpg',
]);

function isNierOnlineStockPhoto(url, alt = '') {
  const file = String(url).split('/').pop()?.toLowerCase() || '';
  if (STOCK_PHOTO_FILENAMES.has(file)) return true;
  if (/mieszkanie\s+(lublin\s+sprzedaż|przy\s+lesie|blok\s+mieszkalny)/i.test(String(alt || ''))) return true;
  return false;
}

function parseNierOnlineAreaFromJsonLd(html) {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    const data = JSON.parse(script[1] || '');
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      if (String(node?.['@type'] || '').toLowerCase() !== 'apartment') continue;
      const props = Array.isArray(node.additionalProperty) ? node.additionalProperty : [];
      for (const prop of props) {
        const name = String(prop?.name || '').toLowerCase();
        if (!/floor size|powierzchnia/i.test(name)) continue;
        const value = Number(String(prop?.value || '').match(/([\d\s.,]+)\s*m/i)?.[1]?.replace(',', '.'));
        if (Number.isFinite(value) && value >= 10) return value;
      }
    }
  }
  return null;
}

function parseNierOnlineAreaSnippet(html, title) {
  const garageMatch = html.match(/garaż[^.]{0,80}powierzchni\s*([\d.,]+)\s*m2/i);
  const jsonLd = parseNierOnlineAreaFromJsonLd(html);
  const fromTitle = Number(title.match(/([\d.,]+)\s*m²/i)?.[1]?.replace(',', '.'));
  if (jsonLd) return jsonLd;
  if (Number.isFinite(fromTitle)) return fromTitle;
  if (garageMatch) return Number(garageMatch[1].replace(',', '.'));
  return null;
}

test('Nieruchomosci area prefers JSON-LD/title over garage mention in description', () => {
  const html = `
    <title>Mieszkanie 72,67 m² z kuchnią z oknem na sprzedaż</title>
  <script type="application/ld+json">{
    "@type":"Apartment",
    "additionalProperty":[{"@type":"PropertyValue","name":"Floor size","value":"72.67 m²"}]
  }</script>
  <p>Do mieszkania przynależy garaż o powierzchni 15m2.</p>`;
  assert.equal(parseNierOnlineAreaSnippet(html, 'Mieszkanie 72,67 m² z kuchnią z oknem'), 72.67);
});

test('Nieruchomosci stock photo filenames are filtered out', () => {
  assert.equal(
    isNierOnlineStockPhoto('https://i.st-nieruchomosci-online.pl/kyz7vhx/mieszkanie-lublin-sprzedaz.jpg', 'Mieszkanie Lublin sprzedaż'),
    true,
  );
  assert.equal(
    isNierOnlineStockPhoto('https://i.st-nieruchomosci-online.pl/kyz7b1x/mieszkanie-lublin.jpg', 'Mieszkanie Lublin'),
    false,
  );
});
