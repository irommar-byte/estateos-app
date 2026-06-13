import type { OtodomImportDraft } from '@/lib/otodomImport';
import { capitalizeImportTitle } from '@/lib/otodomImport';

export type OtodomPresentationCopy = {
  title: string;
  descriptionHtml: string;
  descriptionPreview: string;
  /** true = OpenAI, false = reguły/heurystyka */
  rewrittenByAi: boolean;
  /** Powód gdy AI nie zadziałało (np. quota). */
  aiSkipReason?: string;
};

export type OtodomPresentationCopyOptions = {
  agentVoice?: boolean;
  forceAi?: boolean;
};

const BANNED_PHRASE_PATTERNS: RegExp[] = [
  /\bb(?:iuro|iura)\s+nieruchomo[śs]ci\b/gi,
  /\bagencj[aąę]\s+nieruchomo[śs]ci\b/gi,
  /\bbezpo[śs]rednio\s+od\s+w[łl]a[śs]ciciela\b/gi,
  /\boferta\s+bez\s+po[śs]rednik[óo]w\b/gi,
  /\bsprzeda[żz]\s+bezpo[śs]redni[aą]?\b/gi,
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
];

const JUNK_PARAGRAPH_PATTERNS: RegExp[] = [
  /^sprzeda[żz]\s+bezpo[śs]redni/i,
  /^oferta\s+bez\s+po[śs]rednik/i,
  /^bezpo[śs]rednio\s+od\s+w[łl]a[śs]ciciela/i,
  /^zapraszam(?:y)?\s+(?:serdecznie\s+)?do\s+kontaktu/i,
  /^dzi[eę]kuj/i,
  /^(?:otodom|olx)\b/i,
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

function isJunkParagraph(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return true;
  return JUNK_PARAGRAPH_PATTERNS.some((p) => p.test(t));
}

function splitParagraphs(text: string): string[] {
  return sanitizePortalListingText(text)
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 12)
    .filter((p) => !isJunkParagraph(p))
    .filter((p) => !/^(otodom|olx|www\.|http)/i.test(p))
    .slice(0, 12);
}

function splitListBlock(text: string): { intro?: string; items: string[]; outro?: string } | null {
  const lines = text.split(/\n|,(?=\s*[a-ząćęłńóśźż])/i).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;
  const items: string[] = [];
  let intro: string | undefined;
  let outro: string | undefined;
  let inList = false;
  for (const line of lines) {
    const looksLikeItem =
      /\d+[,.]?\d*\s*m²/i.test(line) ||
      /^(pokój|kuchnia|łazienka|przedpokój|salon|sypialnia|balkon|taras|garaż)/i.test(line);
    if (looksLikeItem) {
      inList = true;
      items.push(line.replace(/^[-–•]\s*/, ''));
    } else if (!inList) {
      intro = intro ? `${intro} ${line}` : line;
    } else {
      outro = outro ? `${outro} ${line}` : line;
    }
  }
  if (items.length < 2) return null;
  return { intro, items, outro };
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
  const facts: string[] = [];
  if (draft.area != null) facts.push(`${draft.area} m²`);
  if (draft.rooms != null) facts.push(`${draft.rooms} ${draft.rooms === 1 ? 'pokój' : 'pokoje'}`);
  if (draft.floor != null && draft.totalFloors != null) {
    facts.push(`piętro ${draft.floor}/${draft.totalFloors}`);
  }
  const factSuffix = facts.length ? ` (${facts.join(' · ')})` : '';
  return `Prezentujemy Państwu ${noun} ${txPhrase} w ${location}${factSuffix}.`;
}

function paragraphToHtml(paragraph: string): string {
  const listBlock = splitListBlock(paragraph);
  if (!listBlock) {
    return `<p>${escapeHtml(paragraph)}</p>`;
  }
  const parts: string[] = [];
  if (listBlock.intro) parts.push(`<p>${escapeHtml(listBlock.intro)}</p>`);
  parts.push(
    `<ul>${listBlock.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
  );
  if (listBlock.outro) parts.push(`<p>${escapeHtml(listBlock.outro)}</p>`);
  return parts.join('\n');
}

function buildHeuristicDescriptionHtml(
  draft: OtodomImportDraft,
  agentVoice: boolean,
): string {
  const location = buildLocationPhrase(draft);
  const typeWord = propertyLabel(draft.propertyType);
  const sourcePlain = sanitizePortalListingText(
    stripHtmlToPlain(draft.descriptionHtml || draft.descriptionText || ''),
  );
  const paragraphs = splitParagraphs(sourcePlain);

  const htmlParts: string[] = [];

  if (agentVoice) {
    htmlParts.push(`<p>${escapeHtml(buildPresentationIntro(draft, location, typeWord))}</p>`);
  } else {
    const tx = transactionLabel(draft.transactionType);
    htmlParts.push(`<p>Oferta ${tx} — ${typeWord} w ${escapeHtml(location)}.</p>`);
  }

  if (paragraphs.length > 0) {
    for (const paragraph of paragraphs) {
      htmlParts.push(paragraphToHtml(paragraph));
    }
  } else {
    const factLines: string[] = [];
    if (draft.area != null) factLines.push(`Powierzchnia: ${draft.area} m²`);
    if (draft.rooms != null) factLines.push(`Liczba pokoi: ${draft.rooms}`);
    if (draft.floor != null && draft.totalFloors != null) {
      factLines.push(`Piętro: ${draft.floor} z ${draft.totalFloors}`);
    }
    if (draft.yearBuilt != null) factLines.push(`Rok budowy: ${draft.yearBuilt}`);
    if (factLines.length > 0) {
      htmlParts.push('<p><strong>Szczegóły:</strong></p>');
      htmlParts.push(`<ul>${factLines.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`);
    }
  }

  if (draft.features.length > 0) {
    const inBody = normalizeForCompare(paragraphs.join(' '));
    const extraFeatures = draft.features.filter(
      (f) => !inBody.includes(normalizeForCompare(f)),
    );
    if (extraFeatures.length > 0) {
      htmlParts.push('<p><strong>Atuty:</strong></p>');
      htmlParts.push(
        `<ul>${extraFeatures.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`,
      );
    }
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

function validateAiOutput(
  title: string,
  descriptionHtml: string,
  sourcePlain: string,
): string | null {
  const plainOut = stripHtmlToPlain(descriptionHtml);
  if (!title || plainOut.length < 280) {
    return `za krótki opis (${plainOut.length} znaków)`;
  }
  const paragraphCount = (descriptionHtml.match(/<p\b/gi) || []).length;
  const listCount = (descriptionHtml.match(/<ul\b/gi) || []).length;
  if (paragraphCount + listCount < 2) {
    return 'za mało sekcji w opisie';
  }
  if (sourcePlain.length > 200) {
    const sourceNorm = normalizeForCompare(sourcePlain);
    const outNorm = normalizeForCompare(plainOut);
    const sourceWords = new Set(sourceNorm.match(/[a-ząćęłńóśźż]{5,}/g) || []);
    const outWords = outNorm.match(/[a-ząćęłńóśźż]{5,}/g) || [];
    if (sourceWords.size > 8 && outWords.length > 0) {
      let overlap = 0;
      for (const w of outWords) {
        if (sourceWords.has(w)) overlap += 1;
      }
      const ratio = overlap / outWords.length;
      if (ratio < 0.12) {
        return 'opis AI nie zawiera faktów ze źródła';
      }
    }
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
  const voiceRules = agentVoice
    ? `- Ton biura: „Prezentujemy Państwu…”, „Chcielibyśmy zaprezentować Państwu…”, transakcja: ${txPhrase}.
- NIE pisz „reprezentuję klienta”, „od właściciela”, „bez pośredników”, „sprzedaż bezpośrednia”.
- NIE wspominaj portali (OtoDom, OLX), telefonów, linków www.
- Zakończ krótkim zaproszeniem do kontaktu (bez numeru telefonu).`
    : `- Profesjonalny ton biura nieruchomości.`;

  const prompt = `Jesteś redaktorem ogłoszeń w polskim biurze nieruchomości. Przepisz tytuł i PEŁNY opis na podstawie tekstu źródłowego.

CEL: Opis ma być RÓWNIE BOGATY jak oryginał — nie skracaj. Każdy fakt ze źródła musi zostać (metraże pomieszczeń, układ, ekspozycja okien, okolica, infrastruktura, komunikacja, stan prawny/hipoteka itd.).

ZASADY:
- Przepisz własnymi słowami — nie kopiuj zdań 1:1, ale NIE pomijaj treści.
- Usuń tylko język portali/agencji (podziękowania, „bez pośredników”, licencje).
- Struktura: wstęp (Prezentujemy Państwu…) → układ/pomieszczenia (lista ul/li jeśli są metraże) → atuty lokalu → okolica → cena/stan prawny → zaproszenie do kontaktu.
- Minimum 5 akapitów LUB 3 akapity + lista pomieszczeń.
- HTML: tylko p, ul, li, strong.
${voiceRules}

DANE:
Tytuł źródłowy: ${draft.title}
Lokalizacja: ${draft.city}, ${draft.district || ''}, ${draft.neighborhood || ''}
Transakcja: ${txPhrase}
Typ: ${draft.propertyType}
Cena: ${draft.price ?? '—'} PLN · ${draft.area ?? '—'} m² · ${draft.rooms ?? '—'} pok.
Piętro: ${draft.floor ?? '—'}/${draft.totalFloors ?? '—'} · Rok: ${draft.yearBuilt ?? '—'}
Cechy: ${draft.features.join(', ') || '—'}

TEKST ŹRÓDŁOWY:
${plain || '(brak — opracuj z danych)'}

JSON: {"title":"...","descriptionHtml":"..."}`;

  let lastReason = 'nieznany błąd';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey });
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_OTODOM_MODEL || 'gpt-4o-mini',
        temperature: attempt === 0 ? 0.65 : 0.55,
        max_tokens: 3500,
        messages: [
          {
            role: 'system',
            content:
              'Piszesz bogate ogłoszenia nieruchomości po polsku. Zachowujesz wszystkie fakty ze źródła. Zwracasz wyłącznie JSON.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content || '';
      const parsed = JSON.parse(raw) as { title?: string; descriptionHtml?: string };
      const title = sanitizePortalListingText(String(parsed.title || '').trim());
      const descriptionHtml = sanitizeAiHtml(String(parsed.descriptionHtml || '').trim());
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
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  let aiSkipReason: string | undefined;

  if (apiKey && isAiRewriteEnabled(options)) {
    const { copy, skipReason } = await rewriteWithOpenAI(draft, apiKey, agentVoice);
    aiSkipReason = skipReason;
    if (copy) return copy;
  } else if (!apiKey) {
    aiSkipReason = 'brak OPENAI_API_KEY na serwerze';
  }

  const title = refineTitle(draft);
  const descriptionHtml = buildHeuristicDescriptionHtml(draft, agentVoice);
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
