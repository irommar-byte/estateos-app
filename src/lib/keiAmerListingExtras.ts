import type { KeiListingRow } from '@/lib/keiAmerClient';
import { parseKeiNumeric } from '@/lib/keiAmerClient';
import { extractWarsawDistrictFromKeiAddress, resolveWarsawDistrict } from '@/lib/keiAmerDistrict';
import { stripReplacementChars } from '@/lib/http/decodeResponseText';

export type KeiImportContext = {
  keiId: string;
  phone: string | null;
  address: string | null;
  district: string | null;
  street: string | null;
  rooms: number | null;
  pricePerSqm: number | null;
  listedAt: string | null;
  directOwner: boolean;
  listingText: string | null;
};

function cleanText(raw: unknown): string | null {
  const text = stripReplacementChars(
    String(raw ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  );
  return text || null;
}

export function parseKeiPhone(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return null;
  if (digits.length === 9) return digits;
  if (digits.length === 11 && digits.startsWith('48')) return digits.slice(2);
  return digits;
}

/** Pokoje z KEI („3P”, „3 pok.”). Gołej cyfry nie czytamy — w polu `typ` to bywa kod rodzaju. */
export function parseKeiRooms(raw: unknown, allowBareNumber = false): number | null {
  const text = String(raw ?? '').trim();
  const match = text.match(/(\d+)\s*(?:p\b|pok)/i) || (allowBareNumber ? text.match(/^(\d+)$/) : null);
  if (!match) return null;
  const rooms = Number(match[1]);
  return Number.isFinite(rooms) && rooms >= 1 && rooms <= 12 ? rooms : null;
}

function truthyKeiFlag(raw: unknown): boolean {
  const text = String(raw ?? '').trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'tak' || text === 'yes';
}

export function buildKeiImportContext(row: Partial<KeiListingRow> | null | undefined): KeiImportContext | null {
  if (!row) return null;
  const keiId = String(row.id || '').trim();
  const phone = parseKeiPhone(row.telefon);
  const address = cleanText(row.adres);
  // KEI w polu „dzielnica” trzyma czasem numer (np. „13”) — bierzemy tylko prawdziwe nazwy dzielnic Warszawy.
  let district =
    resolveWarsawDistrict(extractWarsawDistrictFromKeiAddress(String(row.adres || '')), row.dzielnica_, row.dzielnica) || null;
  const street = cleanText(row.ulica);
  const rooms = parseKeiRooms(row.typ) ?? parseKeiRooms(row.typ_, true);
  const pricePerSqm = parseKeiNumeric(row.cena_m);
  const listedAt = cleanText(row.data);
  const listingText = cleanText(row.tekst);
  const directOwner = truthyKeiFlag(row.bez_posrednikow);
  if (!district && address) {
    const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      // "warszawa, białołęka, żerań" → dzielnica = białołęka
      district = parts[1] && !/^\d+$/.test(parts[1]) ? parts[1] : null;
    }
  }
  if (!keiId && !phone && !address && !district && !rooms && !listingText) return null;
  return {
    keiId,
    phone,
    address,
    district,
    street,
    rooms,
    pricePerSqm,
    listedAt,
    directOwner,
    listingText,
  };
}

export function keiContextFromSelection(row: {
  keiId?: string;
  address?: string;
  phone?: string;
  district?: string;
  street?: string;
  rooms?: number | null;
  listedAt?: string;
  directOwner?: boolean;
}): KeiImportContext | null {
  return buildKeiImportContext({
    id: row.keiId,
    adres: row.address,
    telefon: row.phone,
    dzielnica: row.district,
    ulica: row.street,
    typ: row.rooms != null ? `${row.rooms}P` : '',
    data: row.listedAt,
    bez_posrednikow: row.directOwner ? '1' : '',
  });
}
