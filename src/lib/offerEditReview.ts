import { OfferStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notifyAdminsOfferEdited } from '@/lib/adminAttentionPush';
import { extractVerificationMeta } from '@/lib/offerVerification';

export type OfferEditChange = {
  field: string;
  label: string;
  from: string;
  to: string;
};

const FIELD_LABELS: Record<string, string> = {
  title: 'Tytuł',
  description: 'Opis',
  city: 'Miasto',
  district: 'Dzielnica',
  street: 'Ulica',
  buildingNumber: 'Numer budynku',
  area: 'Powierzchnia',
  plotArea: 'Działka',
  rooms: 'Pokoje',
  floor: 'Piętro',
  totalFloors: 'Liczba pięter',
  yearBuilt: 'Rok budowy',
  propertyType: 'Rodzaj',
  transactionType: 'Transakcja',
  heating: 'Ogrzewanie',
  condition: 'Stan',
  isFurnished: 'Umeblowanie',
  hasBalcony: 'Balkon',
  hasElevator: 'Winda',
  hasStorage: 'Komórka',
  hasParking: 'Parking',
  hasGarden: 'Ogród',
  hasAirConditioning: 'Klimatyzacja',
  isDuplex: 'Dwupoziomowe',
  images: 'Zdjęcia',
  floorPlanUrl: 'Rzut',
  lat: 'Szerokość geogr.',
  lng: 'Długość geogr.',
  landRegistryNumber: 'Księga wieczysta',
  price: 'Cena',
};

const REVIEW_FIELDS = [
  'title',
  'description',
  'district',
  'city',
  'area',
  'images',
  'propertyType',
  'rooms',
  'floor',
  'totalFloors',
  'yearBuilt',
  'plotArea',
  'floorPlanUrl',
  'street',
  'buildingNumber',
  'lat',
  'lng',
  'transactionType',
  'heating',
  'isFurnished',
  'condition',
  'landRegistryNumber',
  'hasBalcony',
  'hasElevator',
  'hasStorage',
  'hasParking',
  'hasGarden',
  'hasAirConditioning',
  'isDuplex',
] as const;

function compact(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'tak' : 'nie';
  const text = String(value).trim();
  if (text.length > 140) return `${text.slice(0, 137)}…`;
  return text;
}

function imagesFingerprint(raw: unknown): string {
  const text = String(raw ?? '').replace(/\s+/g, '');
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return `${parsed.filter(Boolean).length} zdjęć`;
  } catch {
    /* ignore */
  }
  return text.length > 40 ? `${text.slice(0, 37)}…` : text;
}

function descriptionFingerprint(raw: unknown): string {
  const text = String(raw ?? '');
  try {
    return compact(extractVerificationMeta(text).cleanDescription);
  } catch {
    return compact(text);
  }
}

export function diffOfferForReview(
  existing: Record<string, unknown>,
  body: Record<string, unknown>,
): OfferEditChange[] {
  const changes: OfferEditChange[] = [];
  for (const field of REVIEW_FIELDS) {
    if (!(field in body) || body[field] === undefined) continue;
    const currentVal =
      field === 'images'
        ? imagesFingerprint(existing[field])
        : field === 'description'
          ? descriptionFingerprint(existing[field])
          : compact(existing[field]);
    const nextVal =
      field === 'images'
        ? imagesFingerprint(body[field])
        : field === 'description'
          ? descriptionFingerprint(body[field])
          : compact(body[field]);
    if (currentVal === nextVal) continue;
    changes.push({
      field,
      label: FIELD_LABELS[field] || field,
      from: currentVal || '—',
      to: nextVal || '—',
    });
  }
  return changes;
}

export function withPriceChangeIfReviewing(
  existing: Record<string, unknown>,
  body: Record<string, unknown>,
  changes: OfferEditChange[],
): OfferEditChange[] {
  if (changes.length === 0) return changes;
  const nextPrice = body.priceAmount ?? body.price;
  if (nextPrice === undefined || nextPrice === null || nextPrice === '') return changes;
  const from = compact(existing.pricePln ?? existing.price);
  const to = compact(nextPrice);
  if (!from || from === to) return changes;
  return [{ field: 'price', label: FIELD_LABELS.price, from, to }, ...changes];
}

export async function loadPendingEditChangesByOfferIds(
  offerIds: number[],
): Promise<Map<number, OfferEditChange[]>> {
  const map = new Map<number, OfferEditChange[]>();
  const ids = offerIds.filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return map;
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT id, pendingEditChanges FROM \`Offer\` WHERE id IN (${ids.join(',')})`,
    )) as Array<{ id: number; pendingEditChanges: unknown }>;
    for (const row of rows) {
      const parsed = parsePendingEditChanges(row.pendingEditChanges);
      if (parsed.length) map.set(Number(row.id), parsed);
    }
  } catch {
    /* kolumna może jeszcze nie istnieć */
  }
  return map;
}

export function parsePendingEditChanges(raw: unknown): OfferEditChange[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        field: String(item?.field || ''),
        label: String(item?.label || item?.field || ''),
        from: String(item?.from ?? '—'),
        to: String(item?.to ?? '—'),
      }))
      .filter((item) => item.field || item.label);
  } catch {
    return [];
  }
}

export async function persistPendingEditChanges(offerId: number, changes: OfferEditChange[]): Promise<void> {
  const payload = JSON.stringify(changes);
  await prisma.$executeRawUnsafe(
    `UPDATE \`Offer\` SET \`pendingEditChanges\` = ? WHERE id = ?`,
    payload,
    offerId,
  ).catch(() => undefined);
}

export async function clearPendingEditChanges(offerId: number): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE \`Offer\` SET \`pendingEditChanges\` = NULL WHERE id = ?`,
    offerId,
  ).catch(() => undefined);
}

export function applyOfferReapproval(params: {
  existingStatus: string;
  isAdmin: boolean;
  changes: OfferEditChange[];
  offerId: number;
  offerTitle?: string | null;
}): { status: OfferStatus; needsReview: boolean } {
  const wasActive = String(params.existingStatus || '').toUpperCase() === 'ACTIVE';
  const needsReview = wasActive && !params.isAdmin && params.changes.length > 0;
  if (needsReview) {
    void persistPendingEditChanges(params.offerId, params.changes);
    notifyAdminsOfferEdited(params.offerId, params.offerTitle, params.changes);
    return { status: 'PENDING', needsReview: true };
  }
  return { status: params.existingStatus as OfferStatus, needsReview: false };
}
