import type { ClientOfferFeedback } from '@/lib/crm/clientPortalFeedback';
import { extractFeedbackSignals, feedbackBlob } from '@/lib/crm/feedbackSignals';
import { formatPln } from '@/lib/market/format';

type OfferLike = {
  id: number;
  title?: string | null;
  city?: string | null;
  district?: string | null;
  street?: string | null;
  price?: number | null;
  area?: number | null;
  rooms?: number | null;
  yearBuilt?: number | null;
  hasBalcony?: boolean | null;
  hasParking?: boolean | null;
  hasElevator?: boolean | null;
  hasGarden?: boolean | null;
  floor?: number | string | null;
};

export type RichFollowUpContext = {
  agentFirstName?: string | null;
  prevOffer?: OfferLike | null;
  prevFeedback?: ClientOfferFeedback | null;
  nextOffer?: OfferLike | null;
  lessonBits: string[];
  reasons: string[];
  city?: string | null;
  district?: string | null;
};

function stableVariant(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return count > 0 ? hash % count : 0;
}

function greeting(firstName?: string | null): string {
  const name = String(firstName || '').trim();
  if (name) return `Dzień dobry — tu ${name}, Twój agent nieruchomości.`;
  return 'Dzień dobry — kontaktuję się w sprawie kolejnej propozycji dopasowanej do Twoich kryteriów.';
}

function collectClientObjections(feedback: ClientOfferFeedback | null | undefined): string[] {
  if (!feedback) return [];
  const parts: string[] = [];
  if (feedback.disliked.trim()) parts.push(feedback.disliked.trim());
  if (feedback.note.trim() && feedback.note.trim() !== feedback.disliked.trim()) {
    parts.push(feedback.note.trim());
  }
  for (const phrase of feedback.phrases) {
    if (!parts.some((p) => p.toLowerCase().includes(phrase.toLowerCase()))) {
      parts.push(`„${phrase}”`);
    }
  }
  return parts.slice(0, 3);
}

function acknowledgmentParagraph(feedback: ClientOfferFeedback | null | undefined, variant: number): string {
  const objections = collectClientObjections(feedback);
  if (!objections.length) {
    const neutral = [
      'Dziękuję za ostatnią ocenę — każda informacja pomaga mi precyzyjniej dobierać oferty do Twoich oczekiwań.',
      'Doceniam, że poświęcasz chwilę na feedback. To pozwala mi szybciej zawęzić wyszukiwanie do właściwego kierunku.',
      'Twoja ostatnia reakcja posłużyła mi jako punkt odniesienia przy selekcji kolejnej nieruchomości.',
    ];
    return neutral[variant % neutral.length];
  }

  const joined =
    objections.length === 1
      ? objections[0]
      : `${objections.slice(0, -1).join(', ')} oraz ${objections[objections.length - 1]}`;

  const templates = [
    `Dziękuję za szczerą opinię. Zwróciłem szczególną uwagę na to, co napisałeś: ${joined}. Traktuję te uwagi priorytetowo przy dalszym doborze ofert.`,
    `Przeanalizowałem Twoją ostatnią reakcję — w szczególności ${joined}. Właśnie dlatego przygotowałem propozycję, która adresuje te zastrzeżenia.`,
    `Twoja poprzednia ocena była dla mnie bardzo cenna. Zanotowałem: ${joined}. Poniższa nieruchomość została wybrana z myślą o tym, czego wcześniej brakowało.`,
    `Wiem, że ostatnia propozycja nie trafiła w oczekiwania (${joined}). Potraktowałem to jako konkretną wskazówkę i poszukałem oferty bliższej Twojemu profilowi.`,
  ];
  return templates[variant % templates.length];
}

function improvementParagraph(ctx: RichFollowUpContext, variant: number): string {
  const bits = ctx.lessonBits.filter(Boolean);
  const next = ctx.nextOffer;
  if (bits.length) {
    const mapped = bits.map((bit) => {
      if (bit === 'Ma balkon') return 'balkon lub loggię, o które prosiłeś';
      if (bit === 'Ma parking') return 'miejsce postojowe / parking';
      if (bit === 'Ma windę') return 'windę w budynku';
      if (bit === 'Ma ogród') return 'dostęp do ogrodu lub zieleni';
      if (bit === 'Taniej') return 'niższą cenę względem poprzedniej propozycji';
      if (bit.startsWith('Inna dzielnica')) return `inną lokalizację (${bit.replace(/^Inna dzielnica \(|\)$/g, '')})`;
      if (bit.startsWith('Co najmniej')) return bit.toLowerCase();
      if (bit.startsWith('Budynek z')) return bit.toLowerCase();
      if (bit.startsWith('Większy metraż')) return bit.toLowerCase();
      if (bit.startsWith('Mniejszy metraż')) return bit.toLowerCase();
      if (bit.includes('pok.')) return bit.toLowerCase();
      if (bit.startsWith('Rok ')) return bit.toLowerCase();
      return bit.toLowerCase();
    });
    const list =
      mapped.length === 1
        ? mapped[0]
        : `${mapped.slice(0, -1).join(', ')} oraz ${mapped[mapped.length - 1]}`;

    const templates = [
      `W nowej propozycji szczególnie zwróciłem uwagę na to, czego wcześniej brakowało — m.in. ${list}.`,
      `Ta oferta różni się od poprzedniej m.in. tym, że ma ${list}.`,
      `Celowo wybrałem nieruchomość, która koryguje wcześniejsze zastrzeżenia: ${list}.`,
    ];
    return templates[variant % templates.length];
  }

  const signals = ctx.prevFeedback ? extractFeedbackSignals(ctx.prevFeedback) : [];
  if (signals.some((s) => s.kind === 'minYear') && next?.yearBuilt) {
    return `Nowa propozycja pochodzi z budynku z ${next.yearBuilt} roku — bliżej Twojego oczekiwania co do wieku nieruchomości.`;
  }
  if (signals.some((s) => s.kind === 'minRooms') && next?.rooms) {
    return `Tym razem proponuję układ ${next.rooms}-pokojowy — zgodnie z informacją o preferowanej liczbie pokoi.`;
  }

  const loc = [ctx.city ?? next?.city, ctx.district ?? next?.district].filter(Boolean).join(', ');
  if (loc) {
    return `Przeszedłem przez dostępne oferty w Twoim paśmie lokalizacji (${loc}) i wybrałem tę, która najlepiej łączy parametry z dotychczasowymi reakcjami.`;
  }
  return 'Po Twojej ostatniej ocenie ponownie przeliczyłem dopasowanie i wybrałem nieruchomość z najwyższym wynikiem zgodności z ankietą.';
}

function propertyParagraph(ctx: RichFollowUpContext, variant: number): string {
  const next = ctx.nextOffer;
  if (!next) {
    return 'Poniżej przesyłam szczegóły nieruchomości — proszę o spokojne zapoznanie się z opisem i parametrami.';
  }

  const loc = [next.city, next.district, next.street].filter(Boolean).join(', ');
  const price = next.price != null ? formatPln(Number(next.price)) : null;
  const specs: string[] = [];
  if (next.rooms) specs.push(`${next.rooms} pok.`);
  if (next.area) specs.push(`${next.area} m²`);
  if (next.yearBuilt) specs.push(`rok ${next.yearBuilt}`);
  if (next.floor != null && String(next.floor).trim()) specs.push(`piętro ${next.floor}`);
  const specLine = specs.length ? specs.join(' · ') : null;

  const templates = [
    [
      loc ? `Aktualna propozycja to nieruchomość w lokalizacji: ${loc}.` : 'Aktualna propozycja spełnia kluczowe parametry z Twojej ankiety.',
      specLine ? `Parametry: ${specLine}.` : null,
      price ? `Cena ofertowa: ${price}.` : null,
    ],
    [
      `Przesyłam mieszkanie${loc ? ` z ${loc}` : ''}, które w mojej ocenie najlepiej odpowiada na dotychczasowe wskazówki.`,
      specLine ? `W skrócie: ${specLine}.` : null,
      price ? `Kwota: ${price}.` : null,
    ],
    [
      loc ? `Lokalizacja: ${loc}.` : 'Kolejna propozycja z Twojej strefy poszukiwań.',
      specLine ? `Układ i metraż: ${specLine}.` : null,
      price ? `Budżet oferty: ${price}.` : null,
    ],
  ];

  return templates[variant % templates.length].filter(Boolean).join(' ');
}

function closingParagraph(variant: number): string {
  const closings = [
    'Proszę, zapoznaj się z materiałem i daj znać, czy idziemy w dobrym kierunku — szczególnie zależy mi na Twojej szczerzej ocenie.',
    'Będę wdzięczny za informację zwrotną: co trafia, a co nadal wymaga korekty. Na tej podstawie przygotuję kolejne propozycje.',
    'Jeśli ta oferta jest blisko oczekiwań, możemy przejść do rozmowy o oglądaniu. Jeśli nie — proszę o krótki komentarz, poprawię kryteria.',
    'Z mojej strony to propozycja wyselekcjonowana pod Twoje uwagi. Proszę o ocenę — pomaga mi to działać precyzyjniej jako Twój agent.',
  ];
  return closings[variant % closings.length];
}

/** Wielozdaniowy, oficjalny list agenta po feedbacku klienta. */
export function buildRichAgentFollowUpLetter(ctx: RichFollowUpContext): string {
  const seed = `${ctx.nextOffer?.id || 0}:${feedbackBlob(ctx.prevFeedback || { sentiment: null, liked: '', disliked: '', phrases: [], note: '' })}`;
  const v = stableVariant(seed, 12);
  const v2 = stableVariant(`${seed}:b`, 8);
  const v3 = stableVariant(`${seed}:c`, 6);

  const paragraphs = [
    greeting(ctx.agentFirstName),
    acknowledgmentParagraph(ctx.prevFeedback, v),
    improvementParagraph(ctx, v2),
    propertyParagraph(ctx, v3),
    closingParagraph(v + v2),
  ].filter(Boolean);

  return paragraphs.join('\n\n');
}

export function lessonBitsToRichFacts(bits: string, next: OfferLike): string[] {
  const out: string[] = [];
  for (const part of bits.split(' · ').filter(Boolean)) {
    if (part === 'Ma balkon') out.push('Ma balkon lub loggię — tego wcześniej brakowało.');
    else if (part === 'Ma parking') out.push('Jest parking lub miejsce postojowe.');
    else if (part === 'Ma windę') out.push('Jest winda w budynku.');
    else if (part === 'Ma ogród') out.push('Jest ogródek lub dostęp do zieleni.');
    else if (part === 'Taniej') out.push('Cena jest niższa niż przy ostatniej propozycji, którą odrzuciłeś.');
    else if (part.startsWith('Inna dzielnica (')) {
      const district = part.replace(/^Inna dzielnica \(/, '').replace(/\)$/, '');
      out.push(`Lokalizacja to ${district} — inna dzielnica niż ta odrzucona.`);
    } else if (part.startsWith('Inne piętro (')) {
      const floor = part.replace(/^Inne piętro \(/, '').replace(/\)$/, '');
      out.push(`Piętro ${floor} — inne niż w poprzedniej ofercie.`);
    } else if (part.includes('pok.') || part.startsWith('Co najmniej')) out.push(`${part.charAt(0).toUpperCase()}${part.slice(1)}.`);
    else if (part.startsWith('Budynek z') || part.startsWith('Rok ')) out.push(`${part.charAt(0).toUpperCase()}${part.slice(1)}.`);
    else if (part.startsWith('Większy metraż') || part.startsWith('Mniejszy metraż')) out.push(`${part.charAt(0).toUpperCase()}${part.slice(1)}.`);
    else out.push(part);
  }
  if (!out.length && next.district) {
    out.push(`Lokalizacja: ${[next.city, next.district].filter(Boolean).join(', ')}.`);
  }
  return out;
}
