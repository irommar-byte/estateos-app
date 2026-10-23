/**
 * Głos agenta w wiadomościach do klienta.
 *
 * Wszystko, co klient czyta „od agenta”, ma brzmieć jak napisane przez
 * konkretną osobę do konkretnej osoby: forma Pani/Pan z wołaczem imienia,
 * poprawna końcówka rodzaju (wybrałem / wybrałam, napisała Pani / napisał Pan)
 * i kilka wersji każdego zdania, żeby kolejne wiadomości się nie powtarzały.
 *
 * Moduł jest czysty (bez bazy) — loader z Prisma jest na dole pliku.
 */

export type VoiceGender = 'f' | 'm';

export type ClientVoiceInput = {
  clientId?: number | null;
  firstName?: string | null;
  /** 'PAN' | 'PANI' z karty klienta; brak → zgadujemy z imienia. */
  salutation?: string | null;
  agentName?: string | null;
  now?: Date;
};

export type ClientVoice = {
  /** Rodzaj klienta, gdy znany (z karty albo z imienia). */
  gender: VoiceGender | null;
  /** „Pani Anno” / „Panie Tomaszu” / '' gdy nie znamy imienia lub rodzaju. */
  vocative: string;
  /** Pierwsza linia maila / wiadomości: „Dzień dobry, Pani Anno,” albo „Dzień dobry,”. */
  greeting: string;
  /** Krótkie otwarcie do czatu: „Pani Anno, ” / „” . */
  chatLead: string;
  /** Imię agenta (do podpisu i trzeciej osoby). */
  agentFirstName: string;
  agentGender: VoiceGender;
  /** Forma zależna od rodzaju klienta: f / m / neutralna (gdy rodzaj nieznany). */
  c(f: string, m: string, neutral: string): string;
  /** Forma zależna od rodzaju agenta (1. osoba): m / f. */
  a(m: string, f: string): string;
  /** Deterministyczny wybór wersji — inny dla różnych klientów, dni i okazji. */
  pick<T>(key: string, variants: readonly T[], salt?: string | number | null): T;
};

const MALE_A_NAMES = new Set([
  'kuba', 'barnaba', 'kosma', 'bonawentura', 'jarema', 'zawisza', 'boryna', 'sasza', 'misza', 'grisza', 'luca', 'nicola', 'andrea',
]);

const FEMALE_NON_A_NAMES = new Set([
  'noemi', 'miriam', 'ines', 'inez', 'beatrycze', 'karmen', 'carmen', 'abigail', 'nicole', 'michelle', 'ingrid', 'ruth', 'doris',
  'iwett', 'ivett', 'rachel', 'esther', 'ester', 'judyt', 'nel', 'nell', 'mary', 'kim', 'agnes', 'elisabeth', 'sophie', 'marie',
  'chloe', 'zoe', 'joy', 'lily', 'emily', 'kelly', 'sally', 'dolores', 'mercedes', 'sharon', 'ann', 'karin', 'kristin', 'ewelin',
]);

function cleanName(raw: string | null | undefined): string {
  const first = String(raw || '').trim().split(/\s+/)[0] || '';
  if (!/^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźżÀ-ÿ'’-]{2,}$/.test(first)) return '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function guessGenderFromFirstName(raw: string | null | undefined): VoiceGender | null {
  const name = cleanName(raw).toLowerCase();
  if (!name) return null;
  if (MALE_A_NAMES.has(name)) return 'm';
  if (FEMALE_NON_A_NAMES.has(name)) return 'f';
  if (name.endsWith('a')) return 'f';
  return 'm';
}

const MALE_VOCATIVE_EXCEPTIONS: Record<string, string> = {
  paweł: 'Pawle',
  piotr: 'Piotrze',
  kacper: 'Kacprze',
  aleksander: 'Aleksandrze',
  ksander: 'Ksandrze',
  sander: 'Sandrze',
  oliwer: 'Oliwerze',
  piter: 'Piterze',
  karol: 'Karolu',
  daniel: 'Danielu',
  emil: 'Emilu',
  kamil: 'Kamilu',
  marcel: 'Marcelu',
  michał: 'Michale',
  rafał: 'Rafale',
  wit: 'Wicie',
  bruno: 'Bruno',
  hugo: 'Hugo',
  leo: 'Leo',
  ignacy: 'Ignacy',
  jerzy: 'Jerzy',
  antoni: 'Antoni',
  ksawery: 'Ksawery',
  dionizy: 'Dionizy',
  feliks: 'Feliksie',
  max: 'Maksie',
  alex: 'Aleksie',
  felix: 'Feliksie',
};

/** Wołacz męskiego imienia w formie grzecznościowej („Panie Tomaszu”). */
export function maleVocative(raw: string): string {
  const name = cleanName(raw);
  if (!name) return '';
  const lower = name.toLowerCase();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (MALE_VOCATIVE_EXCEPTIONS[lower]) return MALE_VOCATIVE_EXCEPTIONS[lower];
  if (lower.endsWith('a')) return cap(`${lower.slice(0, -1)}o`); // Kuba → Kubo
  if (/(i|y|o|u|e)$/.test(lower)) return name;
  if (lower.endsWith('ek') && lower.length > 3) return cap(`${lower.slice(0, -2)}ku`); // Marek → Marku
  if (/(k|g|h|j|l|sz|cz|rz|ż|c)$/.test(lower)) return `${name}u`; // Tomasz → Tomaszu
  if (lower.endsWith('ł')) return cap(`${lower.slice(0, -1)}le`);
  if (lower.endsWith('st')) return cap(`${lower.slice(0, -2)}ście`); // August → Auguście
  if (lower.endsWith('t')) return cap(`${lower.slice(0, -1)}cie`); // Robert → Robercie
  if (lower.endsWith('d')) return cap(`${lower.slice(0, -1)}dzie`); // Dawid → Dawidzie
  if (lower.endsWith('r')) return `${name}ze`; // Wiktor → Wiktorze
  if (lower.endsWith('ń')) return cap(`${lower.slice(0, -1)}niu`);
  if (/(n|m|f|p|b|w|s|z|v)$/.test(lower)) return `${name}ie`; // Adam → Adamie
  return name;
}

/** Wołacz żeńskiego imienia („Pani Anno”, „Pani Kasiu”). */
export function femaleVocative(raw: string): string {
  const name = cleanName(raw);
  if (!name) return '';
  const lower = name.toLowerCase();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  // Zdrobnienia: Kasia, Zosia, Ania, Basia, Tosia, Ola, Ela → Kasiu, Olu…
  if (/(si|zi|ci|ni|dzi)a$/.test(lower)) return cap(`${lower.slice(0, -1)}u`);
  if (/^(ola|ala|ela|iza|ula)$/.test(lower)) return cap(`${lower.slice(0, -1)}u`);
  if (lower.endsWith('a')) return cap(`${lower.slice(0, -1)}o`); // Anna → Anno, Julia → Julio
  return name;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function warsawDayKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function warsawHour(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', hour12: false }).format(now)) || 12;
}

export function buildClientVoice(input: ClientVoiceInput): ClientVoice {
  const now = input.now || new Date();
  const firstName = cleanName(input.firstName);
  const sal = String(input.salutation || '').trim().toUpperCase();
  const gender: VoiceGender | null = sal === 'PANI' ? 'f' : sal === 'PAN' ? 'm' : guessGenderFromFirstName(firstName);
  const vocativeName = firstName ? (gender === 'f' ? femaleVocative(firstName) : gender === 'm' ? maleVocative(firstName) : '') : '';
  const vocative = vocativeName && gender ? `${gender === 'f' ? 'Pani' : 'Panie'} ${vocativeName}` : '';
  const evening = warsawHour(now) >= 18;
  const hello = evening ? 'Dobry wieczór' : 'Dzień dobry';
  const agentFirstName = cleanName(input.agentName) || '';
  const agentGender: VoiceGender = guessGenderFromFirstName(agentFirstName) === 'f' ? 'f' : 'm';
  const day = warsawDayKey(now);
  const clientKey = String(input.clientId ?? firstName ?? 'x');

  return {
    gender,
    vocative,
    greeting: vocative ? `${hello}, ${vocative},` : `${hello},`,
    chatLead: vocative ? `${vocative}, ` : '',
    agentFirstName,
    agentGender,
    c(f, m, neutral) {
      if (gender === 'f') return f;
      if (gender === 'm') return m;
      return neutral;
    },
    a(m, f) {
      return agentGender === 'f' ? f : m;
    },
    pick<T>(key: string, variants: readonly T[], salt?: string | number | null): T {
      if (!variants.length) throw new Error('pick: empty variants');
      const seed = `${clientKey}:${key}:${salt ?? day}`;
      return variants[hashSeed(seed) % variants.length];
    },
  };
}

/** Zaczyna zdanie od wielkiej litery, gdy nie ma przed nim wołacza. */
export function capFirst(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** „Pani Anno, proszę…” albo „Proszę…” — wołacz na początku zdania w czacie. */
export function withChatLead(voice: ClientVoice, sentence: string): string {
  const s = String(sentence || '').trim();
  if (!voice.chatLead) return capFirst(s);
  return `${voice.chatLead}${s.charAt(0).toLowerCase()}${s.slice(1)}`;
}

/** Polska liczba mnoga: 1 propozycja, 2 propozycje, 5 propozycji. */
export function plPlural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
}

export async function loadClientVoice(clientId: number, now?: Date): Promise<ClientVoice> {
  const { prisma } = await import('@/lib/prisma');
  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    select: { id: true, firstName: true, salutation: true, agencyUser: { select: { name: true } } },
  });
  return buildClientVoice({
    clientId,
    firstName: client?.firstName,
    salutation: client?.salutation,
    agentName: client?.agencyUser?.name,
    now,
  });
}
