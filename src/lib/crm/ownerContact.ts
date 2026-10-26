/**
 * Kontakt do właściciela oferty — z migawki importu (KEI / portal), notatki agenta i treści ogłoszenia.
 * Czysta funkcja, bez bazy: ten sam kształt trafia na ekran „Dziś” w aplikacji.
 */

export type OwnerPhoneSource = 'agent' | 'kei' | 'portal' | 'description' | 'note';

export type TodayOwnerContact = {
  /** Pełny numer do wybrania (tylko cyfry i spacje, bez maskowania). */
  phone: string | null;
  /** Numer, który portal pokazał tylko częściowo („600 100 …”). */
  phoneMasked: string | null;
  phoneSource: OwnerPhoneSource | null;
  directOwner: boolean;
  /** „Właściciel prywatny”, „Biuro: Nazwa”, „Deweloper: Nazwa”. */
  advertiser: string | null;
  note: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  /** Kiedy ogłoszenie pojawiło się w KEI / na portalu (ISO lub tekst z KEI). */
  listedAt: string | null;
  /** Oferta innego agenta z bazy — dzwonimy do niego, nie do właściciela. */
  listingAgent: { name: string; phone: string | null } | null;
  /** Czy agent może dopisać numer (ma dostęp do notatki oferty). */
  canAddPhone: boolean;
};

function record(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

const str = (value: unknown) => String(value ?? '').trim();

const PHONE_RE = /(?:\+?48[\s-]?)?(?:\d{3}[\s-]?\d{3}[\s-]?\d{3}|\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})(?![\d])/;
const MASKED_RE = /(?:\+?48[\s-]*)?\d{2,3}[\s-]?\d{2,3}[\s-]*(?:\.{2,}|…|x{2,}|\*{2,})/i;

/** „+48 600-100-200” → „600 100 200”. Zwraca null, gdy to nie jest pełny polski numer. */
export function normalizePolishPhone(raw: unknown): string | null {
  const text = str(raw);
  if (!text || MASKED_RE.test(text)) return null;
  let digits = text.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('48')) digits = digits.slice(2);
  if (digits.length !== 9) return null;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function maskedPhone(raw: unknown): string | null {
  const match = str(raw).match(MASKED_RE);
  return match ? match[0].replace(/\s{2,}/g, ' ').trim() : null;
}

function phoneInText(text: unknown): string | null {
  const match = str(text).replace(/<[^>]+>/g, ' ').match(PHONE_RE);
  return match ? normalizePolishPhone(match[0]) : null;
}

const PORTAL_LABELS: Array<[RegExp, string]> = [
  [/otodom\./i, 'Otodom'],
  [/olx\./i, 'OLX'],
  [/nieruchomosci-online\./i, 'Nieruchomosci-Online'],
  [/gratka\./i, 'Gratka'],
  [/morizon\./i, 'Morizon'],
  [/domiporta\./i, 'Domiporta'],
  [/adresowo\./i, 'Adresowo'],
];

export function portalLabelFromUrl(url: string | null | undefined): string | null {
  const value = str(url);
  if (!value) return null;
  for (const [re, label] of PORTAL_LABELS) if (re.test(value)) return label;
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function advertiserLabel(type: string, name: string, directOwner: boolean): string | null {
  const t = type.toLowerCase();
  if (directOwner || /priv|prywat|owner|wlasciciel|właściciel/.test(t)) return 'Właściciel prywatny';
  if (/develop|deweloper/.test(t)) return name ? `Deweloper: ${name}` : 'Deweloper';
  if (/agen|business|biuro|firma|company/.test(t) || name) return name ? `Biuro: ${name}` : 'Biuro nieruchomości';
  return null;
}

export function extractOwnerContact(row: {
  userNote?: string | null;
  importSnapshotJson?: string | null;
  importExternalUrl?: string | null;
} | null): TodayOwnerContact | null {
  if (!row) return null;
  let snapshot: Record<string, unknown> = {};
  try {
    snapshot = record(JSON.parse(String(row.importSnapshotJson || '{}')));
  } catch {
    snapshot = {};
  }
  const contact = record(snapshot.contact);
  const hints = record(snapshot.contactHints);
  const kei = record(snapshot.kei);
  const agency = record(snapshot.agency);
  const note = str(row.userNote);

  // Kolejność: numer dopisany przez agenta → KEI → portal → treść ogłoszenia → notatka.
  const candidates: Array<[unknown, OwnerPhoneSource]> = [
    [contact.agentPhone, 'agent'],
    [contact.keiPhone, 'kei'],
    [kei.phone, 'kei'],
    [contact.portalPhone, 'portal'],
    [contact.phone, 'portal'],
    [hints.phone, 'portal'],
    [agency.phone, 'portal'],
  ];
  let phone: string | null = null;
  let phoneSource: OwnerPhoneSource | null = null;
  for (const [raw, source] of candidates) {
    const normalized = normalizePolishPhone(raw);
    if (normalized) {
      phone = normalized;
      phoneSource = source;
      break;
    }
  }
  if (!phone) {
    const fromText =
      phoneInText(snapshot.descriptionOriginalText) || phoneInText(kei.textExcerpt) || phoneInText(snapshot.descriptionOriginalHtml);
    if (fromText) {
      phone = fromText;
      phoneSource = 'description';
    }
  }
  if (!phone) {
    const fromNote = phoneInText(note);
    if (fromNote) {
      phone = fromNote;
      phoneSource = 'note';
    }
  }
  const phoneMasked = phone ? null : maskedPhone(contact.phone) || maskedPhone(hints.phone) || maskedPhone(contact.portalPhone);

  const directOwner = Boolean(contact.directOwner || kei.directOwner);
  const agencyName = str(contact.agencyName || hints.agencyName || agency.name);
  const sourceUrl = str(row.importExternalUrl) || str(record(snapshot.portal).url) || null;
  const listedAt = str(kei.listedAt) || str(snapshot.createdAt) || null;

  if (!phone && !phoneMasked && !note && !sourceUrl && !Object.keys(snapshot).length) return null;
  return {
    phone,
    phoneMasked,
    phoneSource,
    directOwner,
    advertiser: advertiserLabel(str(contact.advertiserType || snapshot.advertiserType), agencyName, directOwner),
    note: note ? note.slice(0, 280) : null,
    sourceUrl,
    sourceLabel: portalLabelFromUrl(sourceUrl),
    listedAt,
    listingAgent: null,
    canAddPhone: true,
  };
}
