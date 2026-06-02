import type { OtodomImportDraft } from '@/lib/otodomImport';
import { resolveOtodomImportLocationFields } from '@/lib/location/resolveOfferLocationFromCoordinates';
import { splitStreetAndBuildingNumber } from '@/lib/offerStreetFields';
import { stageOtodomImportPublication, type OtodomPublicationInput } from '@/lib/otodomImportPublication';
import { processOtodomImportImageBuffer } from '@/lib/otodomImportImageProcess';
import { buildOtodomPresentationCopy } from '@/lib/otodomImportRewrite';
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

const IMPORT_MARKER_PREFIXES: Record<OtodomImportDraft['source'], string> = {
  OTODOM: 'estateos-otodom:',
  OLX: 'estateos-olx:',
  NIERUCHOMOSCI_ONLINE: 'estateos-nieruchomosci-online:',
};
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

export function buildOtodomOfferDescription(
  draft: OtodomImportDraft,
  descriptionHtml: string,
): string {
  const markerPrefix = IMPORT_MARKER_PREFIXES[draft.source] || IMPORT_MARKER_PREFIXES.OTODOM;
  const marker = `<!-- ${markerPrefix}${draft.externalId} -->`;
  return `${marker}\n${descriptionHtml.trim()}`;
}

export async function findExistingOtodomImportOffer(source: OtodomImportDraft['source'], externalId: number) {
  if (!externalId) return null;
  const marker = (IMPORT_MARKER_PREFIXES[source] || IMPORT_MARKER_PREFIXES.OTODOM) + String(externalId);
  return prisma.offer.findFirst({
    where: { description: { contains: marker } },
    select: { id: true, title: true, status: true },
    orderBy: { id: 'desc' },
  });
}

export async function draftToOfferCreateBody(
  draft: OtodomImportDraft,
  userId: number,
  presentation: { title: string; descriptionHtml: string },
) {
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

  const { city, district, street } = await resolveOtodomImportLocationFields(draft);
  const streetLine = street || String(draft.street || '').trim();
  const { streetName, buildingNumber } = splitStreetAndBuildingNumber(streetLine);
  const features = draft.features || [];

  return {
    userId,
    title: presentation.title.trim(),
    description: buildOtodomOfferDescription(draft, presentation.descriptionHtml),
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
    street: streetName || streetLine,
    buildingNumber: buildingNumber || null,
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
  source: OtodomImportDraft['source'],
): Promise<{ buffer: Buffer; mime: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9',
        Referer:
          source === 'OLX'
            ? 'https://www.olx.pl/'
            : source === 'NIERUCHOMOSCI_ONLINE'
              ? 'https://www.nieruchomosci-online.pl/'
              : 'https://www.otodom.pl/',
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
  source: OtodomImportDraft['source'];
}): Promise<{ uploaded: number; failed: number; urls: string[] }> {
  const urls: string[] = [];
  let uploaded = 0;
  let failed = 0;
  const toFetch = params.imageUrls.slice(0, MAX_IMPORT_IMAGES);

  await acquireOfferUploadLock(params.offerId);
  try {
    for (let index = 0; index < toFetch.length; index += 1) {
      const remoteUrl = toFetch[index];
      const file = await downloadRemoteImage(remoteUrl, params.source);
      if (!file) {
        failed += 1;
        continue;
      }

      let processedBuffer: Buffer;
      try {
        processedBuffer = await processOtodomImportImageBuffer(file.buffer, index);
      } catch {
        processedBuffer = file.buffer;
      }

      const saved = await saveOfferGalleryOrFloorplan({
        offerId: params.offerId,
        ownerUserId: params.ownerUserId,
        fileBuffer: processedBuffer,
        mimeTypeDeclared: 'image/jpeg',
        originalFileName: 'otodom-import.jpg',
        isFloorPlan: false,
        byteLengthInput: processedBuffer.length,
        tileWatermark: false,
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

export async function createOfferFromOtodomDraft(
  draft: OtodomImportDraft,
  ownerUserId: number,
  publication?: OtodomPublicationInput | null,
) {
  const existing = await findExistingOtodomImportOffer(draft.source, draft.externalId);
  if (existing) {
    return {
      ok: false as const,
      code: 'ALREADY_IMPORTED' as const,
      existingOfferId: existing.id,
      message: `Ta oferta źródłowa (#${draft.externalId}) jest już w bazie jako #${existing.id} (${existing.status}).`,
    };
  }

  const presentation = await buildOtodomPresentationCopy(draft);
  const body = await draftToOfferCreateBody(draft, ownerUserId, presentation);
  const offer = await createOffer(body);
  const offerId = Number((offer as { id?: number }).id);
  if (!Number.isFinite(offerId)) {
    throw new Error('Nie udało się odczytać ID nowej oferty.');
  }

  if (publication) {
    await stageOtodomImportPublication({
      userId: ownerUserId,
      offerId,
      publication,
    });
  }

  const imageResult = await importOtodomImagesForOffer({
    offerId,
    ownerUserId,
    imageUrls: draft.imageUrls,
    source: draft.source,
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
    presentation,
    editUrl: `/edytuj-oferte/${offerId}`,
    publicUrl: `/oferta/${offerId}`,
  };
}
