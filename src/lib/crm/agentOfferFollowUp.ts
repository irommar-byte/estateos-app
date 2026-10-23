import type { ClientOfferFeedback } from '@/lib/crm/clientPortalFeedback';
import { extractFeedbackSignals, feedbackBlob } from '@/lib/crm/feedbackSignals';
import { formatPln } from '@/lib/market/format';
import { buildClientVoice, type ClientVoice } from '@/lib/crm/clientVoice';

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
  voice?: ClientVoice;
};

function joinPl(items: string[]): string {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`;
}

function voiceOf(ctx: RichFollowUpContext): ClientVoice {
  return ctx.voice || buildClientVoice({ agentName: ctx.agentFirstName });
}

function collectClientObjections(feedback: ClientOfferFeedback | null | undefined): string[] {
  if (!feedback) return [];
  const parts: string[] = [];
  if (feedback.disliked.trim()) parts.push(`„${feedback.disliked.trim()}”`);
  if (feedback.note.trim() && feedback.note.trim() !== feedback.disliked.trim()) {
    parts.push(`„${feedback.note.trim()}”`);
  }
  for (const phrase of feedback.phrases) {
    if (!parts.some((p) => p.toLowerCase().includes(phrase.toLowerCase()))) {
      parts.push(`„${phrase.toLowerCase()}”`);
    }
  }
  return parts.slice(0, 3);
}

function acknowledgmentParagraph(ctx: RichFollowUpContext, salt: string): string {
  const v = voiceOf(ctx);
  const { a, c } = v;
  const feedback = ctx.prevFeedback;
  const objections = collectClientObjections(feedback);

  if (feedback?.sentiment === 'like' && !objections.length) {
    const liked = feedback.liked.trim();
    return v.pick('ack-like', [
      `Bardzo się cieszę, że poprzednia propozycja ${c('przypadła Pani do gustu', 'przypadła Panu do gustu', 'się spodobała')}${liked ? ` — zwłaszcza ${liked.toLowerCase()}` : ''}. Szukam dalej w tym samym kierunku.`,
      `Dziękuję za ocenę poprzedniej oferty — dobrze wiedzieć, że to był trafny kierunek. ${a('Trzymałem', 'Trzymałam')} się go także tym razem.`,
      `Skoro poprzednia propozycja się spodobała, ${a('poszukałem', 'poszukałam')} czegoś w podobnym duchu.`,
    ], salt);
  }

  if (!objections.length) {
    return v.pick('ack-neutral', [
      `Dziękuję za ocenę poprzedniej propozycji — każda taka odpowiedź pomaga mi lepiej dobierać kolejne.`,
      `Dziękuję za czas poświęcony na ostatnią ocenę. ${a('Wziąłem', 'Wzięłam')} ją pod uwagę przy wyborze tej oferty.`,
      `${c('Pani ostatnia ocena', 'Pana ostatnia ocena', 'Ostatnia ocena')} była dla mnie ważną wskazówką przy dalszych poszukiwaniach.`,
    ], salt);
  }

  const joined = joinPl(objections);
  return v.pick('ack-objection', [
    `Dziękuję za szczerą ocenę poprzedniej oferty. ${a('Zapamiętałem', 'Zapamiętałam')}: ${joined} — i właśnie pod tym kątem ${a('szukałem', 'szukałam')} dalej.`,
    `Rozumiem, że poprzednia propozycja nie była trafiona (${joined}). To dla mnie konkretna wskazówka — teraz dokładniej wiem, czego unikać.`,
    `${c('Pani uwagi', 'Pana uwagi', 'Uwagi')} do ostatniej oferty — ${joined} — bardzo pomogły mi zawęzić poszukiwania.`,
    `${a('Wziąłem', 'Wzięłam')} sobie do serca to, co ${c('Pani napisała', 'Pan napisał', 'padło przy ostatniej ofercie')}: ${joined}.`,
  ], salt);
}

function bitToPhrase(bit: string): string {
  if (bit === 'Ma balkon') return 'balkon albo loggia';
  if (bit === 'Ma parking') return 'miejsce postojowe';
  if (bit === 'Ma windę') return 'winda w budynku';
  if (bit === 'Ma ogród') return 'ogródek albo dostęp do zieleni';
  if (bit === 'Taniej') return 'niższa cena niż poprzednio';
  if (bit.startsWith('Inna dzielnica')) return `inna okolica — ${bit.replace(/^Inna dzielnica \(|\)$/g, '')}`;
  if (bit.startsWith('Inne piętro')) return `inne piętro (${bit.replace(/^Inne piętro \(|\)$/g, '')})`;
  const clean = bit
    .replace(/\s*\(minimum [^)]*\)/g, '')
    .replace(/(\d+) pok\. zamiast (\d+)/, '$1 pokoje zamiast $2')
    .replace(/(\d+) pok\./, '$1 pokoje')
    .replace(/^Rok (\d+) zamiast (\d+)/, 'budynek z $1 r. zamiast $2 r.')
    .trim();
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}

function improvementParagraph(ctx: RichFollowUpContext, salt: string): string {
  const v = voiceOf(ctx);
  const { a, c } = v;
  const bits = ctx.lessonBits.filter(Boolean);
  const next = ctx.nextOffer;
  if (bits.length) {
    const list = joinPl(bits.map(bitToPhrase));
    return v.pick('improve-bits', [
      `Tym razem jest to, czego wcześniej brakowało: ${list}.`,
      `Co się zmieniło względem poprzedniej propozycji: ${list}.`,
      `${a('Szukałem', 'Szukałam')} ${c('pod kątem Pani uwag', 'pod kątem Pana uwag', 'pod kątem tych uwag')} — w tej ofercie jest ${list}.`,
    ], salt);
  }

  const signals = ctx.prevFeedback ? extractFeedbackSignals(ctx.prevFeedback) : [];
  if (signals.some((s) => s.kind === 'minYear') && next?.yearBuilt) {
    return `Budynek jest z ${next.yearBuilt} roku — bliżej tego, ${c('czego Pani oczekuje', 'czego Pan oczekuje', 'czego szukamy')}, jeśli chodzi o wiek nieruchomości.`;
  }
  if (signals.some((s) => s.kind === 'minRooms') && next?.rooms) {
    return `Tym razem to układ ${next.rooms}-pokojowy, tak jak ${c('Pani wspominała', 'Pan wspominał', 'było w uwagach')}.`;
  }

  const loc = [ctx.city ?? next?.city, ctx.district ?? next?.district].filter(Boolean).join(', ');
  return v.pick('improve-generic', [
    `${a('Przejrzałem', 'Przejrzałam')} ${loc ? `aktualne oferty (${loc})` : 'aktualne oferty'} i ta najlepiej łączy to, co ${c('Pani się podobało', 'Panu się podobało', 'się podobało')}, z tym, czego trzeba było unikać.`,
    `Spośród dostępnych ofert${loc ? ` (${loc})` : ''} ta wydała mi się najbliższa ${c('Pani oczekiwaniom', 'Pana oczekiwaniom', 'oczekiwaniom')}.`,
  ], salt);
}

function propertyParagraph(ctx: RichFollowUpContext, salt: string): string {
  const v = voiceOf(ctx);
  const next = ctx.nextOffer;
  if (!next) return '';

  const loc = [next.district, next.city].filter(Boolean).join(', ');
  const price = next.price != null ? formatPln(Number(next.price)) : null;
  const specs: string[] = [];
  if (next.rooms) specs.push(`${next.rooms} ${Number(next.rooms) === 1 ? 'pokój' : Number(next.rooms) < 5 ? 'pokoje' : 'pokoi'}`);
  if (next.area) specs.push(`${next.area} m²`);
  if (next.floor != null && String(next.floor).trim()) specs.push(`${next.floor} piętro`);
  if (next.yearBuilt) specs.push(`budynek z ${next.yearBuilt} r.`);
  const specLine = specs.join(', ');
  if (!loc && !specLine && !price) return '';

  return v.pick('property', [
    `W skrócie: ${[loc, specLine, price ? `cena ${price}` : ''].filter(Boolean).join(' · ')}`.replace(/\.?$/, '.'),
    [loc ? `${loc}.` : '', specLine ? `${specLine.charAt(0).toUpperCase()}${specLine.slice(1)}${specLine.endsWith('.') ? '' : '.'}` : '', price ? `Cena ofertowa: ${price}.` : '']
      .filter(Boolean)
      .join(' '),
  ], salt);
}

function closingParagraph(ctx: RichFollowUpContext, salt: string): string {
  const v = voiceOf(ctx);
  const { a, c } = v;
  return v.pick('closing', [
    `${c('Proszę dać znać, co Pani o niej myśli', 'Proszę dać znać, co Pan o niej myśli', 'Proszę o krótką opinię')} — nawet jedno zdanie bardzo mi pomoże.`,
    `Jeśli to jest to — umówmy oglądanie. Jeśli nie, proszę napisać, czego brakuje, a poszukam dalej.`,
    `${a('Będę wdzięczny', 'Będę wdzięczna')} za szczerą ocenę. Im więcej wiem, tym mniej będzie niepotrzebnych oglądań.`,
    `${a('Jestem ciekaw', 'Jestem ciekawa')} ${c('Pani zdania', 'Pana zdania', 'opinii')}. Jeśli coś nie pasuje, wystarczy krótka uwaga przy ofercie.`,
  ], salt);
}

/** List agenta po reakcji klienta: powitanie, co zrozumiał, co zmienił, konkret i prośba o opinię. */
export function buildRichAgentFollowUpLetter(ctx: RichFollowUpContext): string {
  const v = voiceOf(ctx);
  const salt = `${ctx.nextOffer?.id || 0}:${feedbackBlob(ctx.prevFeedback || { sentiment: null, liked: '', disliked: '', phrases: [], note: '' }).length}`;
  const paragraphs = [
    v.greeting,
    acknowledgmentParagraph(ctx, salt),
    improvementParagraph(ctx, salt),
    propertyParagraph(ctx, salt),
    closingParagraph(ctx, salt),
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
    else if (part === 'Taniej') out.push('Cena jest niższa niż przy poprzedniej propozycji.');
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
