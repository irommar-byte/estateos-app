import { validateCityDistrict } from '@/lib/location/locationCatalog';
import type { OtodomImportDraft } from '@/lib/otodomImport';
import { createOffer } from '@/lib/services/offer.service';
import {
  acquireOfferUploadLock,
  MAX_IMAGES_PER_OFFER,
  MAX_OFFER_FILE_BYTES,
  releaseOfferUploadLock,
  saveOfferGalleryOrFloorplan,
  sniffImageMimeFromMagic,
} from '@/lib/upload/offerMediaUpload';
import { prisma } from '@/lib/prisma';

const OTODOM_MARKER_PREFIX = 'estateos-otodom:';
const IMAGE_FETCH_TIMEOUT_MS = 25_000;
const MAX_IMPORT_IMAGES = MAX_IMAGES_PER_OFFER;

function mapConditionCode(code: string | null): string {
  const value = String(code ?? '').trim().toLowerCase();
  if (value === 'to_renovation' || value === 'needs_renovation') return 'NEEDS_RENOVATION';
  if (value === 'to_completion' || value === 'developer_state') return 'DEVELOPER_STATE';
  if (value === 'not_applicable') return 'NOT_APPLICABLE';
  return 'READY';
}

function featureIncludes(features: string[], needles: string[]): boolean {
  const hay = features.map((f) => f.toLowerCase());
  return needles.some((needle) => hay.some((f) => f.includes(needle)));
}

function resolveLocationFields(draft: OtodomImportDraft): { city: string; district: string } {
  const candidates = [draft.district, draft.neighborhood, 'Inny obszar'].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const validation = validateCityDistrict(draft.city, candidate);
    if (validation.valid) {
      return { city: validation.city, district: validation.district };
    }
  }
  const fallback = validateCityDistrict(draft.city, draft.district || 'Inny obszar');
  if (!fallback.valid) {
    throw new Error(fallback.message || 'Nie udało się dopasować miasta i dzielnicy.');
  }
  return { city: fallback.city, district: fallback.district };
}

export function buildOtodomOfferDescription(draft: OtodomImportDraft): string {
  const marker = `<!-- ${OTODOM_MARKER_PREFIX}${draft.externalId} -->`;
  const body = draft.descriptionHtml?.trim()
    ? draft.descriptionHtml
    : `<p>${draft.descriptionText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
  const source = draft.externalUrl
    ? `<p><small>Import OtoDom · <a href="${draft.externalUrl}" rel="nofollow noopener noreferrer" target="_blank">ogłoszenie źródłowe</a></small></p>`
    : `<p><small>Import OtoDom #${draft.externalId}</small></p>`;
  return `${marker}\n${body}\n${source}`;
}

export async function findExistingOtodomImportOffer(externalId: number) {
  if (!externalId) return null;
  const marker = OTODOM_MARKER_PREFIX + String(externalId);
  return prisma.offer.findFirst({
    where: { description: { contains: marker } },
    select: { id: true, title: true, status: true },
    orderBy: { id: 'desc' },
  });
}

export function draftToOfferCreateBody(draft: OtodomImportDraft, userId: number) {
  if (draft.lat == null || draft.lng == null) {
    throw new Error('Brak współrzędnych GPS — nie można utworzyć oferty.');
  }
  if (!draft.title?.trim()) {
    throw new Error('Brak tytułu ogłoszenia.');
  }
  if (draft.price == null || draft.price <= 0) {
    throw new Error('Brak poprawnej ceny.');
  }
  if (draft.area == null || draft.area <= 0) {
    throw new Error('Brak poprawnego metrażu.');
  }

  const { city, district } = resolveLocationFields(draft);
  const features = draft.features || [];

  return {
    userId,
    title: draft.title.trim(),
    description: buildOtodomOfferDescription(draft),
    transactionType: draft.transactionType,
    propertyType: draft.propertyType,
    condition: draft.propertyType === 'PLOT' ? 'NOT_APPLICABLE' : mapConditionCode(draft.conditionCode),
    price: draft.price,
    priceCurrency: draft.priceCurrency || 'PLN',
    adminFee: draft.adminFee != null && draft.adminFee > 0 ? draft.adminFee : null,
    deposit: draft.deposit != null && draft.deposit > 0 ? draft.deposit : null,
    area: draft.area,
    rooms: draft.rooms,
    floor: draft.floor,
    totalFloors: draft.totalFloors,
    yearBuilt: draft.yearBuilt,
    city,
    district,
    street: draft.street,
    lat: draft.lat,
    lng: draft.lng,
    localityCountryCode: draft.localityCountryCode || 'PL',
    localityCountry: 'Polska',
    isExactLocation: true,
    hasBalcony: featureIncludes(features, ['balkon']),
    hasElevator: featureIncludes(features, ['winda']),
    hasStorage: featureIncludes(features, ['piwnica', 'komórka']),
    hasParking: featureIncludes(features, ['garaż', 'parking', 'miejsce parking']),
    hasGarden: featureIncludes(features, ['ogród', 'ogródek']),
    isFurnished: featureIncludes(features, ['meble', 'umeblow']),
    heating: draft.heating,
    status: 'PENDING',
    images: '[]',
  };
}

async function downloadRemoteImage(
  url: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9',
        Referer: 'https://www.otodom.pl/',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_OFFER_FILE_BYTES) return null;

    let mime =
      response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '';
    const sniffed = sniffImageMimeFromMagic(buffer);
    if (sniffed) mime = sniffed;
    if (!mime.startsWith('image/')) return null;

    return { buffer, mime };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function importOtodomImagesForOffer(params: {
  offerId: number;
  ownerUserId: number;
  imageUrls: string[];
}): Promise<{ uploaded: number; failed: number; urls: string[] }> {
  const urls: string[] = [];
  let uploaded = 0;
  let failed = 0;
  const toFetch = params.imageUrls.slice(0, MAX_IMPORT_IMAGES);

  await acquireOfferUploadLock(params.offerId);
  try {
    for (const remoteUrl of toFetch) {
      const file = await downloadRemoteImage(remoteUrl);
      if (!file) {
        failed += 1;
        continue;
      }

      const saved = await saveOfferGalleryOrFloorplan({
        offerId: params.offerId,
        ownerUserId: params.ownerUserId,
        fileBuffer: file.buffer,
        mimeTypeDeclared: file.mime,
        originalFileName: 'otodom-import.jpg',
        isFloorPlan: false,
        byteLengthInput: file.buffer.length,
      });

      if (!saved.ok) {
        failed += 1;
        continue;
      }

      uploaded += 1;
      urls.push(saved.url);
    }
  } finally {
    releaseOfferUploadLock(params.offerId);
  }

  return { uploaded, failed, urls };
}

export async function createOfferFromOtodomDraft(draft: OtodomImportDraft, adminUserId: number) {
  const existing = await findExistingOtodomImportOffer(draft.externalId);
  if (existing) {
    return {
      ok: false as const,
      code: 'ALREADY_IMPORTED' as const,
      existingOfferId: existing.id,
      message: `Ta oferta OtoDom (#${draft.externalId}) jest już w bazie jako #${existing.id} (${existing.status}).`,
    };
  }

  const body = draftToOfferCreateBody(draft, adminUserId);
  const offer = await createOffer(body);
  const offerId = Number((offer as { id?: number }).id);
  if (!Number.isFinite(offerId)) {
    throw new Error('Nie udało się odczytać ID nowej oferty.');
  }

  const imageResult = await importOtodomImagesForOffer({
    offerId,
    ownerUserId: adminUserId,
    imageUrls: draft.imageUrls,
  });

  const refreshed = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, title: true, status: true, city: true, district: true, images: true },
  });

  return {
    ok: true as const,
    offer: refreshed,
    offerId,
    images: imageResult,
    editUrl: `/edytuj-oferte/${offerId}`,
    publicUrl: `/oferta/${offerId}`,
  };
}
