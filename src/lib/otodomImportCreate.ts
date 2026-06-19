import type { OtodomImportDraft } from '@/lib/otodomImport';
import { normalizeImportPortalUrl, sanitizeImportYearBuilt } from '@/lib/otodomImport';
import { assertOtodomImportDraftReady } from '@/lib/importDraftValidate';
import { resolveOtodomImportLocationFields } from '@/lib/location/resolveOfferLocationFromCoordinates';
import { processOtodomImportImageBuffer } from '@/lib/otodomImportImageProcess';
import { buildOtodomPresentationCopy, isOtodomImportAiConfigured } from '@/lib/otodomImportRewrite';
import { inferCountryFromCoordinates } from '@/lib/offerLocalityCountry';
import { upsertImportedOfferPrivateSnapshot, ensureOfferPrivateNoteTable } from '@/lib/offerPrivateNotes';
import {
  consumeAndReserveImportPublication,
  deleteOfferAfterImportPaymentFailure,
  ImportPublicationError,
  publicationInputToRedemption,
  type OtodomPublicationInput,
} from '@/lib/otodomImportPublication';
import { createOffer } from '@/lib/services/offer.service';
import {
  acquireOfferUploadLock,
  MAX_IMAGES_PER_OFFER,
  MAX_OFFER_FILE_BYTES,
  releaseOfferUploadLock,
  saveOfferGalleryOrFloorplan,
  sniffImageMimeFromMagic,
} from '@/lib/upload/offerMediaUpload';
import { resolveLastImageIsFloorPlan } from '@/lib/otodomImportFloorPlan';
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

function portalUrlLookupCandidates(portalUrl: string): string[] {
  let normalized = portalUrl.trim();
  try {
    normalized = normalizeImportPortalUrl(portalUrl);
  } catch {
    // keep raw trimmed URL
  }
  const withoutSlash = normalized.replace(/\/$/, '');
  const withSlash = `${withoutSlash}/`;
  return Array.from(new Set([normalized, withoutSlash, withSlash, portalUrl.trim()]));
}

export async function findExistingOfferByImportUrl(portalUrl: string) {
  const candidates = portalUrlLookupCandidates(portalUrl);
  if (candidates.length === 0) return null;

  await ensureOfferPrivateNoteTable();
  const placeholders = candidates.map(() => '?').join(', ');
  const rows = await prisma.$queryRawUnsafe<Array<{ offerId: number }>>(
    `SELECT offerId FROM OfferPrivateNote WHERE importExternalUrl IN (${placeholders}) LIMIT 1`,
    ...candidates,
  );
  const offerId = Number(rows[0]?.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) return null;

  return prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, title: true, status: true },
  });
}

export async function findExistingImportedOffer(
  draft: Pick<OtodomImportDraft, 'source' | 'externalId' | 'externalUrl'>,
) {
  const byMarker = await findExistingOtodomImportOffer(draft.source, draft.externalId);
  if (byMarker) return byMarker;
  if (draft.externalUrl) {
    return findExistingOfferByImportUrl(draft.externalUrl);
  }
  return null;
}

export async function findExistingImportedOfferByPortalUrl(portalUrl: string) {
  return findExistingOfferByImportUrl(portalUrl);
}

export async function draftToOfferCreateBody(
  draft: OtodomImportDraft,
  userId: number,
  presentation: { title: string; descriptionHtml: string },
  options?: { agentCommissionPercent?: number | null },
) {
  assertOtodomImportDraftReady(draft);

  const { city, district, street } = await resolveOtodomImportLocationFields(draft);
  const country = await inferCountryFromCoordinates(draft.lat, draft.lng);
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
    plotArea: draft.plotArea != null && draft.plotArea > 0 ? draft.plotArea : null,
    rooms: draft.rooms,
    floor: draft.floor,
    totalFloors: draft.totalFloors,
    yearBuilt: sanitizeImportYearBuilt(draft.yearBuilt),
    city,
    district,
    street: street || draft.street,
    lat: draft.lat,
    lng: draft.lng,
    localityCountryCode: country.localityCountryCode,
    localityCountry: country.localityCountry,
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
    ...(options?.agentCommissionPercent != null
      ? { agentCommissionPercent: options.agentCommissionPercent }
      : {}),
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

export type ImportImageProgress = {
  phase: 'download' | 'upload_gallery' | 'upload_floorplan';
  index: number;
  total: number;
  label: string;
  asFloorPlan?: boolean;
};

function resolveFloorPlanIndexForImport(
  imageUrls: string[],
  options?: { lastImageAsFloorPlan?: boolean; floorPlanImageIndex?: number | null },
): number | null {
  if (options?.floorPlanImageIndex === null) return null;
  if (
    options?.floorPlanImageIndex != null &&
    options.floorPlanImageIndex >= 0 &&
    options.floorPlanImageIndex < imageUrls.length
  ) {
    return options.floorPlanImageIndex;
  }
  if (options?.lastImageAsFloorPlan === true && imageUrls.length > 0) {
    return imageUrls.length - 1;
  }
  return null;
}

export async function importOtodomImagesForOffer(params: {
  offerId: number;
  ownerUserId: number;
  imageUrls: string[];
  source: OtodomImportDraft['source'];
  maxImages?: number;
  lastImageAsFloorPlan?: boolean;
  floorPlanImageIndex?: number | null;
  onProgress?: (progress: ImportImageProgress) => void;
}): Promise<{ uploaded: number; failed: number; urls: string[]; floorPlanUrl: string | null }> {
  const urls: string[] = [];
  let uploaded = 0;
  let failed = 0;
  let floorPlanUrl: string | null = null;
  const cap = Math.min(params.maxImages ?? MAX_IMPORT_IMAGES, MAX_IMPORT_IMAGES);
  const allUrls = params.imageUrls.slice(0, cap);
  const floorPlanIdx = resolveFloorPlanIndexForImport(allUrls, {
    lastImageAsFloorPlan: params.lastImageAsFloorPlan,
    floorPlanImageIndex: params.floorPlanImageIndex,
  });
  const galleryUrls =
    floorPlanIdx != null ? allUrls.filter((_, index) => index !== floorPlanIdx) : allUrls;
  const floorPlanRemoteUrl = floorPlanIdx != null ? allUrls[floorPlanIdx] : null;
  const totalSteps = galleryUrls.length + (floorPlanRemoteUrl ? 1 : 0);

  await acquireOfferUploadLock(params.offerId);
  try {
    let step = 0;
    for (let index = 0; index < galleryUrls.length; index += 1) {
      step += 1;
      const remoteUrl = galleryUrls[index];
      params.onProgress?.({
        phase: 'download',
        index: step,
        total: totalSteps,
        label: `Pobieranie zdjęcia ${step}/${totalSteps}`,
        asFloorPlan: false,
      });

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

      params.onProgress?.({
        phase: 'upload_gallery',
        index: step,
        total: totalSteps,
        label: `Zapisywanie zdjęcia ${step}/${totalSteps}`,
        asFloorPlan: false,
      });

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

    if (floorPlanRemoteUrl) {
      step += 1;
      params.onProgress?.({
        phase: 'download',
        index: step,
        total: totalSteps,
        label: `Pobieranie rzutu (${step}/${totalSteps})`,
        asFloorPlan: true,
      });

      const file = await downloadRemoteImage(floorPlanRemoteUrl, params.source);
      if (!file) {
        failed += 1;
      } else {
        let processedBuffer: Buffer;
        try {
          processedBuffer = await processOtodomImportImageBuffer(file.buffer, galleryUrls.length, {
            isFloorPlan: true,
          });
        } catch {
          processedBuffer = file.buffer;
        }

        params.onProgress?.({
          phase: 'upload_floorplan',
          index: step,
          total: totalSteps,
          label: 'Zapisywanie rzutu lokalu',
          asFloorPlan: true,
        });

        const saved = await saveOfferGalleryOrFloorplan({
          offerId: params.offerId,
          ownerUserId: params.ownerUserId,
          fileBuffer: processedBuffer,
          mimeTypeDeclared: 'image/jpeg',
          originalFileName: 'otodom-import-floorplan.jpg',
          isFloorPlan: true,
          byteLengthInput: processedBuffer.length,
          tileWatermark: false,
        });

        if (saved.ok) {
          uploaded += 1;
          floorPlanUrl = saved.url;
        } else {
          failed += 1;
        }
      }
    }
  } finally {
    releaseOfferUploadLock(params.offerId);
  }

  return { uploaded, failed, urls, floorPlanUrl };
}

export async function createOfferFromOtodomDraft(
  draft: OtodomImportDraft,
  ownerUserId: number,
  publication?: OtodomPublicationInput | unknown,
  options?: {
    agentCommissionPercent?: number | null;
    maxImportImages?: number;
    lastImageFloorPlan?: boolean;
    floorPlanImageIndex?: number | null;
    onImageProgress?: (progress: ImportImageProgress) => void;
    onCopyProgress?: (label: string, detail?: string, meta?: { rewrittenByAi?: boolean }) => void;
  },
) {
  const existing = await findExistingImportedOffer(draft);
  if (existing) {
    return {
      ok: false as const,
      code: 'ALREADY_IMPORTED' as const,
      existingOfferId: existing.id,
      message: `Ta oferta OtoDom (#${draft.externalId}) jest już w bazie jako #${existing.id} (${existing.status}).`,
    };
  }

  options?.onCopyProgress?.(
    'Przeróbka opisu (sztuczna inteligencja)…',
    isOtodomImportAiConfigured() ? 'GPT' : 'reguły',
  );
  const presentation = await buildOtodomPresentationCopy(draft, { agentVoice: true });
  const detail = presentation.rewrittenByAi
    ? 'AI ✓'
    : 'automatycznie';
  if (!presentation.rewrittenByAi && presentation.aiSkipReason) {
    console.warn('[otodom-import] copy fallback:', presentation.aiSkipReason);
  }
  options?.onCopyProgress?.(
    presentation.rewrittenByAi ? 'Opis przepisany przez AI' : 'Opis uzupełniony automatycznie',
    detail,
    { rewrittenByAi: presentation.rewrittenByAi },
  );
  const body = await draftToOfferCreateBody(draft, ownerUserId, presentation, options);
  const offer = await createOffer(body);
  const offerId = Number((offer as { id?: number }).id);
  if (!Number.isFinite(offerId)) {
    throw new Error('Nie udało się odczytać ID nowej oferty.');
  }

  await upsertImportedOfferPrivateSnapshot({
    offerId,
    userId: ownerUserId,
    draft,
  });

  let floorPlanImageIndex: number | null = null;
  if (options?.floorPlanImageIndex !== undefined) {
    floorPlanImageIndex = options.floorPlanImageIndex;
  } else if (options?.lastImageFloorPlan === false) {
    floorPlanImageIndex = null;
  } else if (options?.lastImageFloorPlan === true && draft.imageUrls.length > 0) {
    floorPlanImageIndex = draft.imageUrls.length - 1;
  } else if (options?.lastImageFloorPlan === undefined && draft.imageUrls.length > 0) {
    let lastImageBuffer: Buffer | null = null;
    const lastUrl = draft.imageUrls[draft.imageUrls.length - 1];
    const lastFile = await downloadRemoteImage(lastUrl, draft.source);
    lastImageBuffer = lastFile?.buffer ?? null;
    const autoLast = await resolveLastImageIsFloorPlan(draft, undefined, lastImageBuffer);
    floorPlanImageIndex = autoLast ? draft.imageUrls.length - 1 : null;
  }

  const imageResult = await importOtodomImagesForOffer({
    offerId,
    ownerUserId: ownerUserId,
    imageUrls: draft.imageUrls,
    source: draft.source,
    maxImages: options?.maxImportImages,
    floorPlanImageIndex,
    onProgress: options?.onImageProgress,
  });

  const refreshed = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, title: true, status: true, city: true, district: true, images: true },
  });

  if (publication && typeof publication === 'object') {
    const redemption = publicationInputToRedemption(publication as OtodomPublicationInput);
    if (redemption) {
      try {
        await consumeAndReserveImportPublication({
          offerId,
          userId: ownerUserId,
          redemption,
        });
      } catch (error) {
        await deleteOfferAfterImportPaymentFailure(offerId);
        if (error instanceof ImportPublicationError) {
          if (error.code === 'PUBLICATION_REQUIRES_PLUS') {
            throw new Error('NO_PLUS_CREDIT_AVAILABLE');
          }
          throw new Error(error.message);
        }
        throw error;
      }
    }
  }

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
