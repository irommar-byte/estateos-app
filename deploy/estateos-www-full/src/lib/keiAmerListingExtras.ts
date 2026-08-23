import type { KeiListingRow } from '@/lib/keiAmerClient';
import { parseKeiNumeric } from '@/lib/keiAmerClient';

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
  const text = String(raw ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

export function parseKeiPhone(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return null;
  if (digits.length === 9) return digits;
  if (digits.length === 11 && digits.startsWith('48')) return digits.slice(2);
  return digits;
}

export function parseKeiRooms(raw: unknown): number | null {
  const text = String(raw ?? '').trim();
  const match = text.match(/(\d+)\s*p\b/i) || text.match(/^(\d+)$/);
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
  const district = cleanText(row.dzielnica || row.dzielnica_);
  const street = cleanText(row.ulica);
  const rooms = parseKeiRooms(row.typ || row.typ_);
  const pricePerSqm = parseKeiNumeric(row.cena_m);
  const listedAt = cleanText(row.data);
  const listingText = cleanText(row.tekst);
  const directOwner = truthyKeiFlag(row.bez_posrednikow);
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
