import { plPlural, type ClientVoice } from '@/lib/crm/clientVoice';

/**
 * Teksty wiadomości o ofertach i przypomnień — w głosie agenta.
 * Każdy tekst ma kilka wersji; wybór zależy od klienta, okazji i dnia,
 * więc dwie kolejne wiadomości do tej samej osoby nie brzmią identycznie.
 */

const GREETING_RE = /^(dzień dobry|dobry wieczór|witam|witaj|cześć|hej|szanown|pani\s|panie\s|drog[ia]\s)/i;

/** Dodaje powitanie, jeśli treść (np. wpisana ręcznie przez agenta) go nie ma. */
export function ensureGreeting(text: string, voice: ClientVoice): string {
  const body = String(text || '').trim();
  if (!body) return voice.greeting;
  if (GREETING_RE.test(body)) return body;
  return `${voice.greeting}\n\n${body}`;
}

/** „2 propozycje czekają” / „5 propozycji czeka”. */
export function waitingPhrase(n: number): string {
  return `${n} ${plPlural(n, 'propozycja czeka', 'propozycje czekają', 'propozycji czeka')}`;
}

export function offersWord(n: number): string {
  return plPlural(n, 'ofertę', 'oferty', 'ofert');
}

export function emailSignoff(voice: ClientVoice, salt?: string | number | null): string {
  return voice.pick('signoff', ['Pozdrawiam serdecznie,', 'Serdecznie pozdrawiam,', 'Pozdrawiam,', 'Do usłyszenia,'], salt);
}

export type OfferEmailCopy = {
  subject: string;
  eyebrow: string;
  headline: string;
  intro: string;
};

export function offerEmailCopy(voice: ClientVoice, params: { count: number; firstTitle?: string | null; salt?: string | number | null }): OfferEmailCopy {
  const { c, a } = voice;
  const n = Math.max(1, params.count);
  const title = String(params.firstTitle || '').trim() || 'nowa oferta';
  const salt = params.salt ?? null;

  if (n === 1) {
    const intro = voice.pick(
      'offer-intro-1',
      [
        `${a('Znalazłem', 'Znalazłam')} ofertę, która moim zdaniem dobrze odpowiada temu, czego ${c('Pani szuka', 'Pan szuka', 'szukamy')}. Proszę spokojnie obejrzeć zdjęcia i dać znać, jakie robi wrażenie.`,
        `Ta oferta od razu zwróciła moją uwagę, kiedy ${a('przeglądałem', 'przeglądałam')} rynek pod ${c('Pani kryteria', 'Pana kryteria', 'ustalone kryteria')}. ${a('Jestem ciekaw', 'Jestem ciekawa')} ${c('Pani zdania', 'Pana zdania', 'opinii')}.`,
        `Przesyłam propozycję, która w mojej ocenie jest warta uwagi. Jeśli się spodoba, chętnie umówię oglądanie w dogodnym terminie.`,
        `Mam coś, co może ${c('Pani', 'Panu', '')} przypaść do gustu.`.replace('  ', ' ') + ` Poniżej zdjęcia i najważniejsze informacje — wystarczy jedno kliknięcie, żeby dać mi znać, czy warto ją zobaczyć.`,
      ],
      salt,
    );
    const subject = voice.pick(
      'offer-subject-1',
      [
        c(`Propozycja dla Pani: ${title}`, `Propozycja dla Pana: ${title}`, `Nowa propozycja: ${title}`),
        `${a('Znalazłem', 'Znalazłam')} coś wartego uwagi — ${title}`,
        `${title} — ${c('co Pani na to?', 'co Pan na to?', 'warto zobaczyć?')}`,
      ],
      salt,
    );
    const headline = voice.pick('offer-headline-1', ['Ta oferta jest warta uwagi', 'Coś, co może się spodobać', 'Myślę, że warto ją zobaczyć'], salt);
    return { subject, eyebrow: 'Nowa propozycja', headline, intro };
  }

  const props = plPlural(n, 'propozycję', 'propozycje', 'propozycji');
  const intro = voice.pick(
    'offer-intro-n',
    [
      `${a('Wybrałem', 'Wybrałam')} ${n} ${offersWord(n)}, które moim zdaniem są warte uwagi. Każda jest trochę inna, więc ocena przy każdej z nich pomoże mi lepiej zrozumieć, co jest ${c('dla Pani', 'dla Pana', '')} najważniejsze.`.replace('  ', ' '),
      `Przesyłam ${n} ${props} z ostatnich dni. Proszę przy każdej kliknąć, czy warto ją obejrzeć — resztą zajmę się ja.`,
      `Na rynku pojawiło się kilka ciekawych ofert — ${a('wybrałem', 'wybrałam')} ${n}, które najlepiej pasują do ${c('Pani oczekiwań', 'Pana oczekiwań', 'ustalonych oczekiwań')}. Jestem ${a('ciekaw', 'ciekawa')}, która zrobi największe wrażenie.`,
    ],
    salt,
  );
  const subject = voice.pick(
    'offer-subject-n',
    [
      `${n} ${props} ${c('dla Pani', 'dla Pana', 'do obejrzenia')}`,
      `${a('Wybrałem', 'Wybrałam')} ${n} ${offersWord(n)} warte uwagi`,
      `Nowe propozycje — ${n} ${offersWord(n)} do przejrzenia`,
    ],
    salt,
  );
  const headline = `${n} ${plPlural(n, 'propozycja', 'propozycje', 'propozycji')} ${c('dla Pani', 'dla Pana', 'do obejrzenia')}`;
  return { subject, eyebrow: 'Nowe propozycje', headline, intro };
}

export function offerPushCopy(voice: ClientVoice, params: { count: number; firstTitle?: string | null; agentName?: string | null }): { title: string; body: string } {
  const { c, a } = voice;
  const n = Math.max(1, params.count);
  const title = String(params.agentName || voice.agentFirstName || 'Twój agent').trim();
  if (n === 1) {
    const offer = String(params.firstTitle || 'nowa oferta').trim();
    return {
      title,
      body: voice.pick('offer-push-1', [
        `${a('Znalazłem', 'Znalazłam')} coś ${c('dla Pani', 'dla Pana', 'wartego uwagi')}: ${offer}`,
        `Nowa propozycja: ${offer}. Zdjęcia czekają w panelu.`,
        `${offer} — ${c('co Pani na to?', 'co Pan na to?', 'warto zobaczyć?')}`,
      ]),
    };
  }
  return {
    title,
    body: voice.pick('offer-push-n', [
      `${a('Wybrałem', 'Wybrałam')} ${n} nowe ${plPlural(n, 'propozycję', 'propozycje', 'propozycji')} — czekają w panelu.`,
      `${waitingPhrase(n)} na ocenę w panelu.`.replace(/^./, (s) => s.toUpperCase()),
    ]),
  };
}

export type ReminderCopy = {
  subject: string;
  eyebrow: string;
  headline: string;
  intro: string;
  pushTitle: string;
  pushBody: string;
};

export function reminderCopy(voice: ClientVoice, params: { waiting: number; firstTitle?: string | null; agentName?: string | null; salt?: string | number | null }): ReminderCopy {
  const { c, a } = voice;
  const n = Math.max(1, params.waiting);
  const salt = params.salt ?? null;
  const pushTitle = String(params.agentName || voice.agentFirstName || 'Twój agent').trim();
  const title = String(params.firstTitle || '').trim();

  if (n === 1) {
    const intro = voice.pick(
      'reminder-intro-1',
      [
        `Wracam jeszcze do propozycji, którą ${a('wysłałem', 'wysłałam')} kilka dni temu. ${c('Jestem ciekaw', 'Jestem ciekaw', 'Jestem ciekaw')}`.replace(/Jestem ciekaw$/, a('Jestem ciekaw', 'Jestem ciekawa')) +
          `, ${c('jak Pani ją ocenia', 'jak Pan ją ocenia', 'jak wypada w ocenie')} — wystarczy kliknąć „Chcę obejrzeć” albo „Nie dla mnie”, a jeśli coś przeszkadza, dopisać jedno zdanie.`,
        `Nie chcę wysyłać kolejnych ofert, dopóki nie wiem, czy ta trafiła w ${c('Pani oczekiwania', 'Pana oczekiwania', 'oczekiwania')}. Jedno kliknięcie pod zdjęciami w zupełności wystarczy.`,
        `Czy udało się ${c('Pani ', 'Panu ', '')}zerknąć na propozycję, którą ${a('przesłałem', 'przesłałam')}? Nawet krótka odpowiedź — „tak, chcę zobaczyć” albo „to nie to” — bardzo pomoże mi w dalszych poszukiwaniach.`,
      ],
      salt,
    );
    const subject = voice.pick(
      'reminder-subject-1',
      ['Czy udało się zerknąć?', 'Jak wrażenia po tej propozycji?', title ? `Wracam do: ${title}` : 'Wracam do ostatniej propozycji'],
      salt,
    );
    const pushBody = voice.pick(
      'reminder-push-1',
      [
        `Czy udało się zerknąć na propozycję? Jedno kliknięcie wystarczy.`,
        `${c('Jestem ciekaw', 'Jestem ciekaw', 'Jestem ciekaw')}`.replace(/Jestem ciekaw$/, a('Jestem ciekaw', 'Jestem ciekawa')) + ` ${c('Pani zdania', 'Pana zdania', 'opinii')} o ostatniej propozycji.`,
      ],
      salt,
    );
    return { subject, eyebrow: 'Krótkie pytanie', headline: 'Czy udało się zerknąć?', intro, pushTitle, pushBody };
  }

  const intro = voice.pick(
    'reminder-intro-n',
    [
      `Od ostatniego razu ${waitingPhrase(n)} bez odpowiedzi. Nie chcę wysyłać kolejnych na ślepo — ${c('Pani ocena', 'Pana ocena', 'ocena')} przy każdej z nich pomoże mi wybierać trafniej.`,
      `Czy udało się ${c('Pani ', 'Panu ', '')}przejrzeć propozycje, które ${a('wysłałem', 'wysłałam')}? Przy każdej wystarczy jedno kliknięcie — to dla mnie najlepsza wskazówka, w którą stronę szukać dalej.`,
      `Zanim zacznę szukać kolejnych ofert, ${a('chciałbym', 'chciałabym')} wiedzieć, ${c('co Pani myśli', 'co Pan myśli', 'jak wypadły te')} o tych, które już są w panelu.`.replace('jak wypadły te o tych, które', 'jak wypadły te, które'),
    ],
    salt,
  );
  const subject = voice.pick(
    'reminder-subject-n',
    [
      'Czy udało się przejrzeć propozycje?',
      `${waitingPhrase(n)} na ${c('Pani ocenę', 'Pana ocenę', 'ocenę')}`.replace(/^./, (s) => s.toUpperCase()),
      `Czekam na ${c('Pani', 'Pana', '')} opinię o ${n} ${plPlural(n, 'propozycji', 'propozycjach', 'propozycjach')}`.replace('  ', ' '),
    ],
    salt,
  );
  const pushBody = `${waitingPhrase(n)} na ocenę. Jedno kliknięcie przy każdej wystarczy.`.replace(/^./, (s) => s.toUpperCase());
  return { subject, eyebrow: 'Krótkie pytanie', headline: `Czekam na ${c('Pani', 'Pana', '')} opinię`.replace('  ', ' '), intro, pushTitle, pushBody };
}

/** Etykiety szybkich odpowiedzi pod ofertą w mailu. */
export const EMAIL_REACTION_COPY = {
  likeHeader: 'Podoba się?',
  likeMain: 'Chcę obejrzeć',
  dislikeHeader: 'Coś nie pasuje?',
  dislikeMain: 'Nie dla mnie',
  note: 'Kliknięcie otwiera panel z zaznaczoną odpowiedzią — można tam dopisać, co dokładnie.',
} as const;

export function portalBlockCopy(voice: ClientVoice): { title: string; body: string; cta: string } {
  return {
    title: 'Wszystko w jednym miejscu',
    body: `W panelu są wszystkie propozycje, które ${voice.a('wysłałem', 'wysłałam')}, terminy oglądań i nasza rozmowa. Link otwiera się też w aplikacji EstateOS na iPhonie.`,
    cta: 'Otwórz panel',
  };
}
