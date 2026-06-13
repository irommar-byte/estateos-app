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

function buildPresentationIntro(draft: OtodomImportDraft, location: string, typeWord: string): string {
  const txPhrase = draft.transactionType === 'RENT' ? 'do wynajmu' : 'na sprzedaż';
  const noun =
    typeWord === 'działkę'
      ? 'działkę'
      : typeWord === 'dom'
        ? 'dom'
        : typeWord === 'lokal użytkowy'
          ? 'lokal użytkowy'
          : 'mieszkanie';
  return `Prezentujemy Państwu ${noun} ${txPhrase} w ${location}. Poniżej najważniejsze informacje o nieruchomości.`;
}

function buildHeuristicDescriptionHtml(
  draft: OtodomImportDraft,
  agentVoice: boolean,
): string {
  const location = buildLocationPhrase(draft);
  const typeWord = propertyLabel(draft.propertyType);

  const htmlParts: string[] = [];

  if (agentVoice) {
    htmlParts.push(`<p>${escapeHtml(buildPresentationIntro(draft, location, typeWord))}</p>`);
  } else {
    const tx = transactionLabel(draft.transactionType);
    htmlParts.push(`<p>Oferta ${tx} — ${typeWord} w ${escapeHtml(location)}.</p>`);
  }

  const factLines: string[] = [];
  if (draft.area != null) factLines.push(`Powierzchnia: ${draft.area} m²`);
  if (draft.rooms != null) factLines.push(`Liczba pokoi: ${draft.rooms}`);
  if (draft.floor != null && draft.totalFloors != null) {
    factLines.push(`Piętro: ${draft.floor} z ${draft.totalFloors}`);
  } else if (draft.floor != null) {
    factLines.push(`Piętro: ${draft.floor}`);
  }
  if (draft.yearBuilt != null) factLines.push(`Rok budowy: ${draft.yearBuilt}`);

  if (factLines.length > 0) {
    htmlParts.push('<p><strong>Parametry:</strong></p>');
    htmlParts.push(`<ul>${factLines.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`);
  }

  if (draft.features.length > 0) {
    htmlParts.push('<p><strong>Atuty i wyposażenie:</strong></p>');
    htmlParts.push(
      `<ul>${draft.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`,
    );
  }

  if (draft.transactionType === 'RENT' && draft.price != null) {
    const extras: string[] = [`Czynsz najmu: ${draft.price.toLocaleString('pl-PL')} PLN / miesiąc`];
    if (draft.adminFee != null && draft.adminFee > 0) {
      extras.push(`Opłaty administracyjne: ${draft.adminFee.toLocaleString('pl-PL')} PLN`);
    }
    if (draft.deposit != null && draft.deposit > 0) {
      extras.push(`Kaucja: ${draft.deposit.toLocaleString('pl-PL')} PLN`);
    }
    htmlParts.push(`<p>${escapeHtml(extras.join(' · '))}.</p>`);
  } else if (draft.price != null) {
    htmlParts.push(`<p>Cena: ${escapeHtml(draft.price.toLocaleString('pl-PL'))} PLN.</p>`);
  }

  if (agentVoice) {
    htmlParts.push(
      '<p>Zapraszamy do kontaktu — chętnie umówimy prezentację nieruchomości w dogodnym terminie.</p>',
    );
  }

  return htmlParts.join('\n');
}

function sanitizeAiHtml(html: string): string {
  let out = html.trim();
  for (const pattern of BANNED_PHRASE_PATTERNS) {
    out = out.replace(pattern, ' ');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
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

    const txPhrase = draft.transactionType === 'RENT' ? 'do wynajmu' : 'na sprzedaż';
    const voiceRules = agentVoice
      ? `- Pisz w liczbie mnogiej, profesjonalnie: „Prezentujemy Państwu…”, „Chcielibyśmy zaprezentować Państwu…”, „${txPhrase}”.
- NIE pisz „reprezentuję klienta”, „od właściciela”, „bez pośredników”, „zapraszam serdecznie”, „dziękuję za zainteresowanie”.
- NIE wspominaj nazw portali (OtoDom, OLX), innych agencji, telefonów ani linków www.
- Zakończ eleganckim zaproszeniem do kontaktu (bez numeru telefonu).`
      : `- Profesjonalny ton biura nieruchomości, forma „Prezentujemy Państwu…”.`;

    const prompt = `Jesteś redaktorem ogłoszeń w polskim biurze nieruchomości. Przepisz tytuł i opis importowany z portalu:

ZASADY:
- Zachowaj WSZYSTKIE fakty (cena, metraż, pokoje, piętro, rok, lokalizacja, cechy, opłaty).
- Przepisz CAŁKOWICIE własnymi słowami — zero kopiowania zdań ze źródła.
- Usuń język portali/agencji: podziękowania, „od właściciela”, licencje, CTA sprzedające.
- Minimum 4 akapity + lista atutów (ul/li) jeśli są dane.
- HTML: tylko p, ul, li, strong.
${voiceRules}

DANE:
Tytuł źródłowy: ${draft.title}
Lokalizacja: ${draft.city}, ${draft.district || ''}
Transakcja: ${txPhrase}
Typ: ${draft.propertyType}
Cena: ${draft.price ?? '—'} PLN · ${draft.area ?? '—'} m² · ${draft.rooms ?? '—'} pok.
Piętro: ${draft.floor ?? '—'}/${draft.totalFloors ?? '—'} · Rok: ${draft.yearBuilt ?? '—'}
Cechy: ${draft.features.join(', ') || '—'}

TEKST ŹRÓDŁOWY (tylko fakty — nie kopiuj stylu ani zdań):
${plain || '(brak — napisz od danych)'}

JSON: {"title":"...","descriptionHtml":"..."}`;

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_OTODOM_MODEL || 'gpt-4o-mini',
      temperature: 0.72,
      max_tokens: 2200,
      messages: [
        {
          role: 'system',
          content:
            'Redagujesz ogłoszenia nieruchomości po polsku w tonie „Prezentujemy Państwu…”. Zwracasz wyłącznie JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(raw) as { title?: string; descriptionHtml?: string };
    const title = sanitizePortalListingText(String(parsed.title || '').trim());
    const descriptionHtml = sanitizeAiHtml(String(parsed.descriptionHtml || '').trim());
    const plainOut = stripHtmlToPlain(descriptionHtml);
    if (!title || plainOut.length < 120) {
      console.warn('[otodom-import] OpenAI rewrite too short:', plainOut.length);
      return null;
    }

    const sourcePlain = plain.slice(0, 2000);
    const similarity = normalizeForCompare(plainOut).slice(0, 400);
    const sourceNorm = normalizeForCompare(sourcePlain).slice(0, 400);
    if (similarity.length > 80 && sourceNorm.includes(similarity.slice(0, 120))) {
      console.warn('[otodom-import] OpenAI rewrite too similar to source — retry heuristic');
      return null;
    }

    return {
      title: capitalizeImportTitle(title),
      descriptionHtml,
      descriptionPreview: stripHtmlToPlain(descriptionHtml).slice(0, 500),
      rewrittenByAi: true,
    };
  } catch (error) {
    console.warn('[otodom-import] OpenAI rewrite failed:', error instanceof Error ? error.message : error);
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
