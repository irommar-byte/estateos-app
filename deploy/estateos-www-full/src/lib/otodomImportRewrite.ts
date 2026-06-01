import type { OtodomImportDraft } from '@/lib/otodomImport';

export type OtodomPresentationCopy = {
  title: string;
  descriptionHtml: string;
  descriptionPreview: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 12)
    .filter((p) => !/otodom/i.test(p))
    .slice(0, 8);
}

function transactionLabel(type: OtodomImportDraft['transactionType']): string {
  return type === 'RENT' ? 'ofertę najmu' : 'ofertę sprzedaży';
}

function propertyLabel(type: OtodomImportDraft['propertyType']): string {
  switch (type) {
    case 'HOUSE':
      return 'dom';
    case 'PLOT':
      return 'działkę';
    case 'COMMERCIAL':
      return 'lokal użytkowy';
    default:
      return 'mieszkanie';
  }
}

function buildLocationPhrase(draft: OtodomImportDraft): string {
  const parts = [draft.district, draft.neighborhood, draft.city].filter(Boolean);
  const unique = [...new Set(parts.map((p) => String(p).trim()))];
  return unique.join(', ') || draft.city || 'wybranej lokalizacji';
}

function refineTitle(draft: OtodomImportDraft): string {
  const original = draft.title?.trim() || '';
  const location = buildLocationPhrase(draft);
  const rooms =
    draft.rooms != null && draft.rooms > 0
      ? draft.rooms === 1
        ? 'kawalerka'
        : `${draft.rooms}-pokojowe`
      : '';
  const area = draft.area != null ? `${draft.area} m²` : '';
  const typeWord = propertyLabel(draft.propertyType);

  const parts: string[] = [];
  if (rooms) parts.push(rooms.charAt(0).toUpperCase() + rooms.slice(1));
  parts.push(typeWord);
  if (area) parts.push(area);
  if (location) parts.push(`— ${location}`);

  const generated = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!original || original.length < 8) return generated;

  if (normalizeForCompare(original) === normalizeForCompare(generated)) {
    return original;
  }

  return generated.length >= 16 ? generated : original;
}

function normalizeForCompare(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż]+/g, '');
}

function buildHeuristicDescriptionHtml(draft: OtodomImportDraft): string {
  const sourcePlain = stripHtmlToPlain(draft.descriptionHtml || draft.descriptionText || '');
  const sourceParagraphs = splitParagraphs(sourcePlain);
  const location = buildLocationPhrase(draft);
  const tx = transactionLabel(draft.transactionType);
  const typeWord = propertyLabel(draft.propertyType);

  const introFacts: string[] = [];
  if (draft.area != null) introFacts.push(`${draft.area} m²`);
  if (draft.rooms != null) introFacts.push(`${draft.rooms} ${draft.rooms === 1 ? 'pokój' : 'pokoje'}`);
  if (draft.floor != null && draft.totalFloors != null) {
    introFacts.push(`piętro ${draft.floor}/${draft.totalFloors}`);
  } else if (draft.floor != null) {
    introFacts.push(`piętro ${draft.floor}`);
  }
  if (draft.yearBuilt != null) introFacts.push(`rok budowy ${draft.yearBuilt}`);

  const htmlParts: string[] = [
    `<p>Przedstawiamy ${tx} — ${typeWord} w ${escapeHtml(location)}${
      introFacts.length ? ` (${escapeHtml(introFacts.join(' · '))})` : ''
    }. Poniżej najważniejsze informacje o nieruchomości.</p>`,
  ];

  for (const paragraph of sourceParagraphs) {
    const cleaned = paragraph
      .replace(/\bOTODOM\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (cleaned.length > 20) {
      htmlParts.push(`<p>${escapeHtml(cleaned)}</p>`);
    }
  }

  if (draft.features.length > 0) {
    htmlParts.push('<p><strong>Atuty i wyposażenie:</strong></p>');
    htmlParts.push(
      `<ul>${draft.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`,
    );
  }

  if (draft.transactionType === 'RENT' && draft.price != null) {
    const rentLine = `Czynsz najmu: ${draft.price.toLocaleString('pl-PL')} PLN / miesiąc`;
    const extras: string[] = [rentLine];
    if (draft.adminFee != null && draft.adminFee > 0) {
      extras.push(`opłaty administracyjne: ${draft.adminFee.toLocaleString('pl-PL')} PLN`);
    } else {
      extras.push('opłaty administracyjne mogą być wliczone w cenę (szczegóły w treści ogłoszenia)');
    }
    if (draft.deposit != null && draft.deposit > 0) {
      extras.push(`kaucja: ${draft.deposit.toLocaleString('pl-PL')} PLN`);
    }
    htmlParts.push(`<p>${escapeHtml(extras.join(' · '))}.</p>`);
  } else if (draft.price != null) {
    htmlParts.push(
      `<p>Cena: ${escapeHtml(draft.price.toLocaleString('pl-PL'))} PLN.</p>`,
    );
  }

  htmlParts.push(
    '<p><em>Opis przygotowany na podstawie publicznych danych rynkowych i sformułowany na potrzeby prezentacji w serwisie EstateOS.</em></p>',
  );

  return htmlParts.join('\n');
}

async function rewriteWithOpenAI(
  draft: OtodomImportDraft,
  apiKey: string,
): Promise<OtodomPresentationCopy | null> {
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });
    const plain = stripHtmlToPlain(draft.descriptionHtml || draft.descriptionText || '').slice(0, 6000);

    const prompt = `Jesteś redaktorem ogłoszeń nieruchomości w Polsce. Przepisz tytuł i opis tak, aby:
- zachować wszystkie fakty (cena, metraż, pokoje, lokalizacja, cechy),
- brzmieć profesjonalnie i elegancko po polsku,
- NIE kopiować sformułowań 1:1 (unikaj duplikatu treści),
- NIE wspominać OtoDom ani innych portali,
- opis zwróć jako krótki HTML (tylko tagi: p, ul, li, strong).

Dane:
Tytuł źródłowy: ${draft.title}
Miasto: ${draft.city}
Dzielnica: ${draft.district}
Transakcja: ${draft.transactionType}
Typ: ${draft.propertyType}
Cena: ${draft.price ?? '—'} PLN
Metraż: ${draft.area ?? '—'} m²
Pokoje: ${draft.rooms ?? '—'}
Cechy: ${draft.features.join(', ')}
Tekst źródłowy:
${plain}

Odpowiedz wyłącznie JSON: {"title":"...","descriptionHtml":"..."}`;

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_OTODOM_MODEL || 'gpt-4o-mini',
      temperature: 0.65,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(raw) as { title?: string; descriptionHtml?: string };
    const title = String(parsed.title || '').trim();
    const descriptionHtml = String(parsed.descriptionHtml || '').trim();
    if (!title || !descriptionHtml) return null;

    return {
      title,
      descriptionHtml,
      descriptionPreview: stripHtmlToPlain(descriptionHtml).slice(0, 500),
    };
  } catch (error) {
    console.warn('[otodom-import] OpenAI rewrite skipped:', error);
    return null;
  }
}

export async function buildOtodomPresentationCopy(
  draft: OtodomImportDraft,
): Promise<OtodomPresentationCopy> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    const ai = await rewriteWithOpenAI(draft, apiKey);
    if (ai) return ai;
  }

  const title = refineTitle(draft);
  const descriptionHtml = buildHeuristicDescriptionHtml(draft);
  return {
    title,
    descriptionHtml,
    descriptionPreview: stripHtmlToPlain(descriptionHtml).slice(0, 500),
  };
}
