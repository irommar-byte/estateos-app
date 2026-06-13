import type { OtodomImportDraft } from '@/lib/otodomImport';
import { capitalizeImportTitle } from '@/lib/otodomImport';

export type OtodomPresentationCopy = {
  title: string;
  descriptionHtml: string;
  descriptionPreview: string;
  /** true = OpenAI, false = reguły/heurystyka */
  rewrittenByAi: boolean;
};

export type OtodomPresentationCopyOptions = {
  /** Głos agenta reprezentującego klienta (domyślnie: true). */
  agentVoice?: boolean;
  /** Wymuś AI nawet gdy OTODOM_IMPORT_AI_REWRITE=0 (jeśli jest klucz API). */
  forceAi?: boolean;
};

const BANNED_PHRASE_PATTERNS: RegExp[] = [
  /\bb(?:iuro|iura)\s+nieruchomo[śs]ci\b/gi,
  /\bagencj[aąę]\s+nieruchomo[śs]ci\b/gi,
  /\bbezpo[śs]rednio\s+od\s+w[łl]a[śs]ciciela\b/gi,
  /\boferta\s+bez\s+po[śs]rednik[óo]w\b/gi,
  /\bw[łl]a[śs]ciciel\s+(?:oferuje|wystawia|zaprasza|wsp[óo][łl]pracuje)\b/gi,
  /\b(?:serdecznie\s+)?zapraszam(?:y)?\s+do\s+kontaktu\b/gi,
  /\b(?:zachęcam|zachęcamy)\s+do\s+kontaktu\b/gi,
  /\bdzi[eę]kuj[eę](?:my)?\s+(?:za\s+)?(?:zainteresowanie|uwagę|kontakt)?\b/gi,
  /\b(?:otodom|olx|nieruchomosci[- ]online|gratka|morizon)\b/gi,
  /\b(?:www\.|https?:\/\/)\S+/gi,
  /\bnumer\s+licencji\b/gi,
  /\bpo[śs]rednik\s+(?:nieruchomo[śs]ci|w\s+obrocie)\b/gi,
  /\b(?:tel\.?|telefon|gsm)\.?\s*[\d\s+\-()]{7,}\b/gi,
  /\bkontakt\s+w\s+godzinach\b/gi,
  /\b(?:napisz|zadzwo[nń])\s+(?:do\s+nas|teraz)\b/gi,
  /\b(?:prezentujemy|oferujemy)\s+pa[nń]stwu\b/gi,
];

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

function sanitizePortalListingText(text: string): string {
  let out = text;
  for (const pattern of BANNED_PHRASE_PATTERNS) {
    out = out.replace(pattern, ' ');
  }
  return out
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeListingHtml(html: string): string {
  const plain = sanitizePortalListingText(stripHtmlToPlain(html));
  const paragraphs = splitParagraphs(plain);
  if (paragraphs.length === 0) return '';
  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
}

function splitParagraphs(text: string): string[] {
  return sanitizePortalListingText(text)
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 16)
    .filter((p) => !/^(otodom|olx|www\.|http)/i.test(p))
    .slice(0, 8);
}

function transactionLabel(type: OtodomImportDraft['transactionType']): string {
  return type === 'RENT' ? 'najmu' : 'sprzedaży';
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
  const original = sanitizePortalListingText(draft.title?.trim() || '');
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
  if (!original || original.length < 8) return capitalizeImportTitle(generated);

  if (normalizeForCompare(original) === normalizeForCompare(generated)) {
    return capitalizeImportTitle(original);
  }

  return capitalizeImportTitle(generated.length >= 16 ? generated : original);
}

function normalizeForCompare(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż]+/g, '');
}

function isAiRewriteEnabled(options?: OtodomPresentationCopyOptions): boolean {
  if (options?.forceAi) return true;
  const flag = String(process.env.OTODOM_IMPORT_AI_REWRITE ?? '1').trim().toLowerCase();
  return flag !== '0' && flag !== 'false' && flag !== 'off';
}

function buildHeuristicDescriptionHtml(
  draft: OtodomImportDraft,
  agentVoice: boolean,
): string {
  const sourcePlain = sanitizePortalListingText(
    stripHtmlToPlain(draft.descriptionHtml || draft.descriptionText || ''),
  );
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

  const htmlParts: string[] = [];

  if (agentVoice) {
    htmlParts.push(
      `<p>Reprezentuję klienta w procesie ${tx} ${typeWord === 'działkę' ? 'tej działki' : `tego ${typeWord === 'dom' ? 'domu' : typeWord === 'lokal użytkowy' ? 'lokalu' : 'mieszkania'}`} w ${escapeHtml(location)}${
        introFacts.length ? ` (${escapeHtml(introFacts.join(' · '))})` : ''
      }. Poniżej zebrane parametry i atuty nieruchomości.</p>`,
    );
  } else {
    htmlParts.push(
      `<p>Oferta ${tx} — ${typeWord} w ${escapeHtml(location)}${
        introFacts.length ? ` (${escapeHtml(introFacts.join(' · '))})` : ''
      }.</p>`,
    );
  }

  if (sourceParagraphs.length > 0) {
    htmlParts.push('<p><strong>O nieruchomości:</strong></p>');
    for (const paragraph of sourceParagraphs.slice(0, 5)) {
      htmlParts.push(`<p>${escapeHtml(paragraph)}</p>`);
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
    }
    if (draft.deposit != null && draft.deposit > 0) {
      extras.push(`kaucja: ${draft.deposit.toLocaleString('pl-PL')} PLN`);
    }
    htmlParts.push(`<p>${escapeHtml(extras.join(' · '))}.</p>`);
  } else if (draft.price != null) {
    htmlParts.push(`<p>Cena: ${escapeHtml(draft.price.toLocaleString('pl-PL'))} PLN.</p>`);
  }

  if (agentVoice) {
    htmlParts.push(
      '<p>Chętnie przekażę szczegóły i umówię prezentację w dogodnym terminie — napisz wiadomość przez EstateOS.</p>',
    );
  }

  return htmlParts.join('\n');
}

async function rewriteWithOpenAI(
  draft: OtodomImportDraft,
  apiKey: string,
  agentVoice: boolean,
): Promise<OtodomPresentationCopy | null> {
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });
    const plain = sanitizePortalListingText(
      stripHtmlToPlain(draft.descriptionHtml || draft.descriptionText || ''),
    ).slice(0, 6500);

    const voiceRules = agentVoice
      ? `- Pisz w pierwszej osobie liczby pojedynczej jako agent nieruchomości reprezentujący klienta (np. „reprezentuję”, „przedstawiam”, „proponuję”).
- NIE pisz „od właściciela”, „bez pośredników”, „zapraszam serdecznie”, „dziękuję za zainteresowanie”.
- NIE wspominaj nazw innych portali, agencji konkurencyjnych, numerów telefonu ani linków www.
- Zakończ krótkim wezwaniem do kontaktu przez EstateOS (bez numeru telefonu).`
      : `- Profesjonalny ton, bez marketingowego bełkotu portali.`;

    const prompt = `Jesteś doświadczonym agentem nieruchomości w Polsce. Przepisz tytuł i opis ogłoszenia importowanego z portalu tak, aby:

ZASADY OBOWiĄZKOWE:
- Zachowaj WSZYSTKIE fakty: cena, metraż, pokoje, piętro, rok budowy, lokalizacja, cechy, opłaty.
- Przepisz własnymi słowami — tekst NIE może wyglądać jak kopia 1:1 (unikaj plagiatu).
- Usuń całkowicie: podziękowania agencji, „bezpośrednio od właściciela”, nazwy OtoDom/OLX, CTA portali, telefony, linki, licencje pośrednika.
- Opis ma być rozbudowany (min. 3 akapity + lista atutów jeśli są dane).
- HTML: tylko tagi p, ul, li, strong. Bez nagłówków h1-h6.
${voiceRules}

DANE OFERTY:
Tytuł źródłowy: ${draft.title}
Miasto: ${draft.city}
Dzielnica: ${draft.district || '—'}
Transakcja: ${draft.transactionType}
Typ: ${draft.propertyType}
Cena: ${draft.price ?? '—'} PLN
Metraż: ${draft.area ?? '—'} m²
Pokoje: ${draft.rooms ?? '—'}
Piętro: ${draft.floor ?? '—'} / ${draft.totalFloors ?? '—'}
Rok budowy: ${draft.yearBuilt ?? '—'}
Cechy: ${draft.features.join(', ') || '—'}

TEKST ŹRÓDŁOWY (do przeróbki, nie kopiuj zdań):
${plain || '(brak — opracuj opis z samych danych)'}

Odpowiedz WYŁĄCZNIE JSON: {"title":"...","descriptionHtml":"..."}`;

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_OTODOM_MODEL || 'gpt-4o-mini',
      temperature: 0.62,
      messages: [
        {
          role: 'system',
          content:
            'Redagujesz ogłoszenia nieruchomości po polsku. Zwracasz wyłącznie poprawny JSON bez markdown.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(raw) as { title?: string; descriptionHtml?: string };
    const title = sanitizePortalListingText(String(parsed.title || '').trim());
    let descriptionHtml = sanitizeListingHtml(String(parsed.descriptionHtml || '').trim());
    if (!title || !descriptionHtml || stripHtmlToPlain(descriptionHtml).length < 80) {
      return null;
    }

    return {
      title: capitalizeImportTitle(title),
      descriptionHtml,
      descriptionPreview: stripHtmlToPlain(descriptionHtml).slice(0, 500),
      rewrittenByAi: true,
    };
  } catch (error) {
    console.warn('[otodom-import] OpenAI rewrite skipped:', error);
    return null;
  }
}

export async function buildOtodomPresentationCopy(
  draft: OtodomImportDraft,
  options?: OtodomPresentationCopyOptions,
): Promise<OtodomPresentationCopy> {
  const agentVoice = options?.agentVoice !== false;
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (apiKey && isAiRewriteEnabled(options)) {
    const ai = await rewriteWithOpenAI(draft, apiKey, agentVoice);
    if (ai) return ai;
  }

  const title = refineTitle(draft);
  const descriptionHtml = buildHeuristicDescriptionHtml(draft, agentVoice);
  return {
    title,
    descriptionHtml,
    descriptionPreview: stripHtmlToPlain(descriptionHtml).slice(0, 500),
    rewrittenByAi: false,
  };
}

export function isOtodomImportAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim()) && isAiRewriteEnabled();
}
