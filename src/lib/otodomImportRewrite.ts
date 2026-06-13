import type { OtodomImportDraft } from '@/lib/otodomImport';
import { capitalizeImportTitle } from '@/lib/otodomImport';

export type OtodomPresentationCopy = {
  title: string;
  descriptionHtml: string;
  descriptionPreview: string;
  rewrittenByAi: boolean;
  aiSkipReason?: string;
};

export type OtodomPresentationCopyOptions = {
  agentVoice?: boolean;
  forceAi?: boolean;
};

const SOURCE_BANNED_PHRASE_PATTERNS: RegExp[] = [
  /\bb(?:iuro|iura)\s+nieruchomo[śs]ci\b/gi,
  /\bagencj[aąę]\s+nieruchomo[śs]ci\b/gi,
  /\bbezpo[śs]rednio\s+od\s+w[łl]a[śs]ciciela\b/gi,
  /\bbez\s+po[śs]rednik[óo]w\b/gi,
  /\boferta\s+bez\s+po[śs]rednik[óo]w\b/gi,
  /\bsprzeda[żz]\s+bezpo[śs]redni[aą]?\b/gi,
  /\bsprzeda[żz]\s+prywatn[aą]\b/gi,
  /\bnie\s+wsp[óo][łl]pracuj[eę](?:my)?\s+z\s+agencj[aą]/gi,
  /\bagencj[aą]\s+(?:nie\s+)?(?:akceptuj[eę]|obsługuj[eę]|prosz[eę]\s+o\s+nie)/gi,
  /\bw[łl]a[śs]ciciel\s+(?:oferuje|wystawia|zaprasza|wsp[óo][łl]pracuje)\b/gi,
  /\bdzi[eę]kuj[eę](?:my)?\s+(?:za\s+)?(?:zainteresowanie|uwagę|kontakt)?\b/gi,
  /\b(?:otodom|olx|nieruchomosci[- ]online|gratka|morizon)\b/gi,
  /\b(?:www\.|https?:\/\/)\S+/gi,
  /\bnumer\s+licencji\b/gi,
  /\bpo[śs]rednik\s+(?:nieruchomo[śs]ci|w\s+obrocie)\b/gi,
  /\b(?:tel\.?|telefon|gsm)\.?\s*[\d\s+\-()]{7,}\b/gi,
  /\bkontakt\s+w\s+godzinach\b/gi,
  /\b(?:napisz|zadzwo[nń])\s+(?:do\s+nas|teraz)\b/gi,
];

const OWNER_VOICE_PATTERNS: RegExp[] = [
  /\bbez\s+po[śs]rednik[óo]w\b/i,
  /\bsprzeda[żz]\s+prywatn[aą]\b/i,
  /\bsprzedajemy\b/i,
  /\bmamy\s+do\s+sprzedania\b/i,
  /\bja\s+jako\b/i,
  /\bbyłam\b/i,
  /\bbyłem\b/i,
  /\bmogliśmy\b/i,
  /\bdla\s+mnie\b/i,
  /\btakże\s+tak\s+naprawdę\b/i,
  /\bnegocjacji\s+ceny\b/i,
  /\bzapraszamy\s+do\s+obejrzenia\b/i,
  /\bprzekonania\s+się\s+osobiście\b/i,
  /\bgenialnie\s+się\s+tutaj\s+mieszka\b/i,
];

const PORTAL_META_FEATURE = /^(cena\s+za|poziom:|umeblowane:|rynek:|rodzaj\s+zabudowy:|powierzchnia:|liczba\s+pokoi:|piętro:|typ\s+oferty:)/i;

const AI_OUTPUT_SANITIZE_PATTERNS: RegExp[] = [
  ...SOURCE_BANNED_PHRASE_PATTERNS,
  ...OWNER_VOICE_PATTERNS,
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
  for (const pattern of SOURCE_BANNED_PHRASE_PATTERNS) {
    out = out.replace(pattern, ' ');
  }
  for (const pattern of OWNER_VOICE_PATTERNS) {
    out = out.replace(pattern, ' ');
  }
  return out
    .replace(/\(\s*\)/g, '')
    .replace(/\s+\./g, '.')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function containsOwnerVoice(text: string): boolean {
  return OWNER_VOICE_PATTERNS.some((p) => p.test(text));
}

function filterListingFeatures(features: string[]): string[] {
  return features
    .map((f) => String(f || '').trim())
    .filter(Boolean)
    .filter((f) => !PORTAL_META_FEATURE.test(f))
    .filter((f) => !/cena\s+za\s+m²/i.test(f))
    .filter((f) => !/^powierzchnia:/i.test(f))
    .filter((f) => !/^liczba\s+pokoi:/i.test(f));
}

function normalizeForCompare(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż]+/g, '');
}

function copiedSentenceRatio(sourcePlain: string, outputPlain: string): number {
  const sentences = sourcePlain
    .split(/[.!?]+/)
    .map((s) => normalizeForCompare(s))
    .filter((s) => s.length > 40);
  if (sentences.length === 0) return 0;
  const outNorm = normalizeForCompare(outputPlain);
  let hits = 0;
  for (const sentence of sentences) {
    const chunk = sentence.slice(0, Math.min(80, sentence.length));
    if (chunk.length > 40 && outNorm.includes(chunk)) hits += 1;
  }
  return hits / sentences.length;
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
  return capitalizeImportTitle(generated.length >= 16 ? generated : original);
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
  const facts: string[] = [];
  if (draft.area != null) facts.push(`${draft.area} m²`);
  if (draft.rooms != null) facts.push(`${draft.rooms} ${draft.rooms === 1 ? 'pokój' : 'pokoje'}`);
  if (draft.floor != null && draft.totalFloors != null) {
    facts.push(`piętro ${draft.floor}/${draft.totalFloors}`);
  }
  const factSuffix = facts.length ? ` (${facts.join(' · ')})` : '';
  return `Prezentujemy Państwu ${noun} ${txPhrase} w ${location}${factSuffix}. Chcielibyśmy przedstawić szczegóły tej nieruchomości.`;
}

function buildAncillaryFeesHtml(draft: OtodomImportDraft): string | null {
  if (draft.transactionType !== 'RENT') return null;
  const lines: string[] = [];
  if (draft.adminFee != null && draft.adminFee > 0) {
    lines.push(`Opłaty administracyjne: ${draft.adminFee.toLocaleString('pl-PL')} PLN / miesiąc`);
  }
  if (draft.deposit != null && draft.deposit > 0) {
    lines.push(`Kaucja: ${draft.deposit.toLocaleString('pl-PL')} PLN`);
  }
  if (lines.length === 0) return null;
  return `<p><strong>Opłaty dodatkowe:</strong></p><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`;
}

function stripMainPriceFromDescription(html: string, draft: OtodomImportDraft): string {
  if (draft.price == null) return html;
  const priceFormatted = draft.price.toLocaleString('pl-PL');
  const priceDigits = String(Math.round(draft.price));
  const pricePatterns = [
    new RegExp(`\\b${priceFormatted.replace(/\s/g, '[\\s\\u00a0]?')}\\b`, 'i'),
    new RegExp(`\\b${priceDigits}\\b`),
  ];

  const isPriceBlock = (plain: string): boolean => {
    const norm = plain.toLowerCase();
    if (/cena\s+za\s+m²/i.test(norm)) return true;
    const hasPriceWord = /(?:^|\s)(?:cena|koszt|kwota|w\s+cenie|czynsz\s+najmu)(?:\s|:)/i.test(norm);
    if (!hasPriceWord) return false;
    return pricePatterns.some((p) => p.test(plain.replace(/\s/g, ' ')));
  };

  let out = html.replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (block) => {
    const plain = stripHtmlToPlain(block);
    return isPriceBlock(plain) || containsOwnerVoice(plain) ? '' : block;
  });

  out = out.replace(/<li\b[^>]*>[\s\S]*?<\/li>/gi, (block) => {
    const plain = stripHtmlToPlain(block);
    return isPriceBlock(plain) || containsOwnerVoice(plain) || PORTAL_META_FEATURE.test(plain) ? '' : block;
  });

  return out.replace(/<ul>\s*<\/ul>/gi, '').trim();
}

function finalizeDescriptionHtml(html: string, draft: OtodomImportDraft): string {
  let out = html.trim();
  for (const pattern of AI_OUTPUT_SANITIZE_PATTERNS) {
    out = out.replace(pattern, ' ');
  }
  out = stripMainPriceFromDescription(out, draft);
  return out.replace(/\s{2,}/g, ' ').trim();
}

function buildStructuredFallbackHtml(draft: OtodomImportDraft, agentVoice: boolean): string {
  const location = buildLocationPhrase(draft);
  const typeWord = propertyLabel(draft.propertyType);
  const htmlParts: string[] = [];

  if (agentVoice) {
    htmlParts.push(`<p>${escapeHtml(buildPresentationIntro(draft, location, typeWord))}</p>`);
  } else {
    htmlParts.push(`<p>Oferta ${transactionLabel(draft.transactionType)} — ${typeWord} w ${escapeHtml(location)}.</p>`);
  }

  const factLines: string[] = [];
  if (draft.area != null) factLines.push(`Powierzchnia użytkowa: ${draft.area} m²`);
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

  const features = filterListingFeatures(draft.features);
  if (features.length > 0) {
    htmlParts.push('<p><strong>Atuty:</strong></p>');
    htmlParts.push(`<ul>${features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`);
  }

  const ancillary = buildAncillaryFeesHtml(draft);
  if (ancillary) htmlParts.push(ancillary);

  if (agentVoice) {
    htmlParts.push(
      '<p>Zapraszamy do kontaktu — chętnie umówimy prezentację nieruchomości i odpowiemy na pytania.</p>',
    );
  }

  return finalizeDescriptionHtml(htmlParts.join('\n'), draft);
}

function formatAiError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/429|quota|insufficient/i.test(msg)) {
    return 'OpenAI: przekroczony limit konta (quota) — doładuj billing';
  }
  if (/401|invalid.*api.*key/i.test(msg)) {
    return 'OpenAI: nieprawidłowy klucz API';
  }
  return `OpenAI: ${msg.slice(0, 120)}`;
}

function validateAiOutput(title: string, descriptionHtml: string, sourcePlain: string): string | null {
  const plainOut = stripHtmlToPlain(descriptionHtml);
  if (!title || plainOut.length < 350) {
    return `za krótki opis (${plainOut.length} znaków)`;
  }
  if (containsOwnerVoice(plainOut)) {
    return 'opis zawiera język właściciela';
  }
  const copyRatio = copiedSentenceRatio(sourcePlain, plainOut);
  if (copyRatio > 0.2) {
    return `opis zbyt podobny do źródła (${Math.round(copyRatio * 100)}%)`;
  }
  const paragraphCount = (descriptionHtml.match(/<p\b/gi) || []).length;
  const listCount = (descriptionHtml.match(/<ul\b/gi) || []).length;
  if (paragraphCount + listCount < 2) {
    return 'za mało sekcji w opisie';
  }
  if (/cena\s+za\s+m²/i.test(plainOut)) {
    return 'opis zawiera cenę za m²';
  }
  return null;
}

async function rewriteWithOpenAI(
  draft: OtodomImportDraft,
  apiKey: string,
  agentVoice: boolean,
): Promise<{ copy: OtodomPresentationCopy | null; skipReason?: string }> {
  const plain = sanitizePortalListingText(
    stripHtmlToPlain(draft.descriptionHtml || draft.descriptionText || ''),
  ).slice(0, 8000);

  const txPhrase = draft.transactionType === 'RENT' ? 'do wynajmu' : 'na sprzedaż';
  const amenities = filterListingFeatures(draft.features).join(', ') || '—';

  const voiceRules = agentVoice
    ? `- Jesteś AGENTEM biura nieruchomości. Forma: „Prezentujemy Państwu…”, „Lokal oferuje…”, „W okolicy…”.
- ZABRONIONE: „bez pośredników”, „sprzedaż prywatna”, „sprzedajemy”, „mamy do sprzedania”, „ja jako”, „byłam”, „zapraszamy do obejrzenia”, „negocjacji ceny”.
- ZABRONIONE: cena główna, cena za m², czynsz — są w systemie. Dozwolone: opłaty dodatkowe (admin, kaucja).
- Przepisz KAŻDE zdanie własnymi słowami. Zero kopiowania zdań ze źródła.
- Zachowaj WSZYSTKIE fakty: metraże, pokoje, wyposażenie, remonty, komunikacja, sklepy, place zabaw, stan prawny.`
    : `- Ton biura nieruchomości; bez ceny głównej w tekście.`;

  const prompt = `Przepisz tytuł i opis ogłoszenia importowanego z portalu w tonie profesjonalnego agenta.

TRANSAKCJA: ${txPhrase}
LOKALIZACJA: ${draft.city}, ${draft.district || ''}
Metraż: ${draft.area ?? '—'} m² · Pokoje: ${draft.rooms ?? '—'} · Piętro: ${draft.floor ?? '—'}/${draft.totalFloors ?? '—'}
Atuty (pomocniczo): ${amenities}

STRUKTURA HTML (p, ul, li, strong):
1. Wstęp agenta (Prezentujemy Państwu…)
2. Opis lokalu i układu (lista pomieszczeń jeśli są w źródle)
3. Wyposażenie i stan
4. Okolica i komunikacja
5. Stan prawny
6. Zaproszenie do kontaktu i prezentacji

TEKST ŹRÓDŁOWY (tylko fakty — przepisz, nie kopiuj):
${plain || '(brak)'}

${voiceRules}

JSON: {"title":"...","descriptionHtml":"..."}`;

  let lastReason = 'nieznany błąd';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey });
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_OTODOM_MODEL || 'gpt-4o-mini',
        temperature: attempt === 0 ? 0.72 : attempt === 1 ? 0.58 : 0.45,
        max_tokens: 4000,
        messages: [
          {
            role: 'system',
            content:
              'Redagujesz ogłoszenia nieruchomości po polsku jako agent biura. Nigdy nie używasz języka właściciela. Zwracasz wyłącznie JSON.',
          },
          {
            role: 'user',
            content:
              attempt > 0
                ? `${prompt}\n\nPOPRZEDNIA PRÓBA ODRZUCONA: ${lastReason}. Przepisz całkowicie od nowa, bez języka właściciela i bez kopiowania zdań.`
                : prompt,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content || '';
      const parsed = JSON.parse(raw) as { title?: string; descriptionHtml?: string };
      const title = sanitizePortalListingText(String(parsed.title || '').trim());
      const descriptionHtml = finalizeDescriptionHtml(String(parsed.descriptionHtml || '').trim(), draft);
      const validationError = validateAiOutput(title, descriptionHtml, plain);
      if (validationError) {
        lastReason = validationError;
        console.warn(`[otodom-import] OpenAI rewrite rejected (attempt ${attempt + 1}):`, validationError);
        continue;
      }

      return {
        copy: {
          title: capitalizeImportTitle(title),
          descriptionHtml,
          descriptionPreview: stripHtmlToPlain(descriptionHtml).slice(0, 500),
          rewrittenByAi: true,
        },
      };
    } catch (error) {
      lastReason = formatAiError(error);
      console.warn(`[otodom-import] OpenAI rewrite failed (attempt ${attempt + 1}):`, lastReason);
      if (/429|quota|401|invalid.*api.*key/i.test(lastReason)) {
        break;
      }
    }
  }

  return { copy: null, skipReason: lastReason };
}

export async function buildOtodomPresentationCopy(
  draft: OtodomImportDraft,
  options?: OtodomPresentationCopyOptions,
): Promise<OtodomPresentationCopy> {
  const agentVoice = options?.agentVoice !== false;
  const apiKey = process.env.OPENAI_API_KEY?.trim()?.replace(/^"|"$/g, '');
  let aiSkipReason: string | undefined;

  if (apiKey && isAiRewriteEnabled(options)) {
    const { copy, skipReason } = await rewriteWithOpenAI(draft, apiKey, agentVoice);
    aiSkipReason = skipReason;
    if (copy) return copy;
  } else if (!apiKey) {
    aiSkipReason = 'brak OPENAI_API_KEY na serwerze';
  }

  const title = refineTitle(draft);
  const descriptionHtml = buildStructuredFallbackHtml(draft, agentVoice);
  return {
    title,
    descriptionHtml,
    descriptionPreview: stripHtmlToPlain(descriptionHtml).slice(0, 500),
    rewrittenByAi: false,
    aiSkipReason,
  };
}

export function isOtodomImportAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim()) && isAiRewriteEnabled();
}
