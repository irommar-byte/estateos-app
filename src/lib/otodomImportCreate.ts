import type { OtodomImportDraft } from '@/lib/otodomImport';
import { sanitizeImportHeating, sanitizeImportYearBuilt } from '@/lib/otodomImport';
import { assertOtodomImportDraftReady } from '@/lib/importDraftValidate';
import { resolveOtodomImportLocationFields } from '@/lib/location/resolveOfferLocationFromCoordinates';
import { processOtodomImportImageBuffer } from '@/lib/otodomImportImageProcess';
import { buildOtodomPresentationCopy, isOtodomImportAiConfigured } from '@/lib/otodomImportRewrite';
import { inferCountryFromCoordinates } from '@/lib/offerLocalityCountry';
import { upsertImportedOfferPrivateSnapshot, ensureOfferPrivateNoteTable } from '@/lib/offerPrivateNotes';
import type { KeiImportContext } from '@/lib/keiAmerListingExtras';
import {
  consumeAndReserveImportPublication,
  deleteOfferAfterImportPaymentFailure,
  ImportPublicationError,
  publicationInputToRedemption,
  tryRecoverImportOfferPendingPublication,
  type OtodomPublicationInput,
} from '@/lib/otodomImportPublication';
import { readPendingPublication } from '@/lib/offerPendingPublication';
import { createOffer } from '@/lib/services/offer.service';
import {
  acquireOfferUploadLock,
  MAX_IMAGES_PER_OFFER,
  MAX_OFFER_FILE_BYTES,
  releaseOfferUploadLock,
  saveOfferGalleryOrFloorplan,
  sniffImageMimeFromMagic,
} from '@/lib/upload/offerMediaUpload';
import { upgradeListingImageUrl } from '@/lib/listingImageUrlUpgrade';
import { resolveLastImageIsFloorPlan } from '@/lib/otodomImportFloorPlan';
import { prisma } from '@/lib/prisma';
import {
  bindImportExternalKey,
  claimImportExternalKey,
  findOfferByImportExternalId,
  findOfferByImportFingerprint,
  importUrlLookupCandidates,
  releaseImportExternalClaim,
} from '@/lib/importDuplicateGuard';
import {
  buildAppliedPatch,
  descriptionImpliesAmenity,
  importDescriptionBlob,
  inferAmenitySuggestions,
  parseSmartAddDecisions,
  portalFeaturesIncludeAmenity,
  previewImportSmartAdd,
  type IntelligenceAmenityField,
  type IntelligenceAmenityPatchMap,
  type IntelligenceAmenitySuggestion,
  INTELLIGENCE_AMENITY_FIELDS,
} from '@/lib/intelligenceAmenityBrain';
import { writeOfferAmenityPatches } from '@/lib/intelligenceAmenityPatches';

const IMPORT_MARKER_PREFIXES: Record<OtodomImportDraft['source'], string> = {
  OTODOM: 'estateos-otodom:',
  OLX: 'estateos-olx:',
  NIERUCHOMOSCI_ONLINE: 'estateos-nieruchomosci-online:',
};
const IMAGE_FETCH_TIMEOUT_MS = 25_000;
const MAX_IMPORT_IMAGES = MAX_IMAGES_PER_OFFER;
const IMAGE_UPLOAD_CONCURRENCY = 2;

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

export async function findExistingOfferByImportUrl(portalUrl: string) {
  const candidates = importUrlLookupCandidates(portalUrl);
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
  draft: Pick<OtodomImportDraft, 'source' | 'externalId' | 'externalUrl' | 'city' | 'district' | 'street' | 'price' | 'area' | 'transactionType'>,
) {
  const byExternalId = await findOfferByImportExternalId(draft.source, draft.externalId);
  if (byExternalId) return byExternalId;
  const byMarker = await findExistingOtodomImportOffer(draft.source, draft.externalId);
  if (byMarker) return byMarker;
  if (draft.externalUrl) {
    const byUrl = await findExistingOfferByImportUrl(draft.externalUrl);
    if (byUrl) return byUrl;
  }
  return findOfferByImportFingerprint({
    city: draft.city,
    district: draft.district,
    street: draft.street,
    price: draft.price,
    area: draft.area,
    transactionType: draft.transactionType,
  });
}

export async function findExistingImportedOfferByPortalUrl(portalUrl: string) {
  return findExistingOfferByImportUrl(portalUrl);
}

export function suggestionsFromOtodomDraft(draft: OtodomImportDraft): IntelligenceAmenitySuggestion[] {
  return inferAmenitySuggestions({
    features: draft.features,
    title: draft.title,
    description: [draft.descriptionText, draft.descriptionHtml].filter(Boolean).join('\n'),
  });
}

export function resolveImportSmartAdd(params: {
  draft: OtodomImportDraft;
  /** Jawne odrzucenie pojedynczego pola (np. z UI importu). */
  decisions?: unknown;
  /** Gdy false — tylko checkboxy portalu, bez inferencji z opisu. */
  enabled?: boolean;
  /** Gdy false — podpowiedzi bez auto-zapisu patchy / amenity z opisu. */
  autoApply?: boolean;
}): {
  amenities: Record<IntelligenceAmenityField, boolean>;
  hasAirConditioning: boolean;
  heating: string | null;
  patches: IntelligenceAmenityPatchMap;
  suggestions: IntelligenceAmenitySuggestion[];
} {
  const preview = previewImportSmartAdd(params.draft);
  const decisions = parseSmartAddDecisions(params.decisions);
  const features = params.draft.features || [];
  const enabled = params.enabled !== false;
  const autoApply = params.autoApply !== false;

  if (!enabled) {
    const amenities = Object.fromEntries(
      INTELLIGENCE_AMENITY_FIELDS.map((field) => [
        field,
        portalFeaturesIncludeAmenity(features, field),
      ]),
    ) as Record<IntelligenceAmenityField, boolean>;
    return {
      amenities,
      hasAirConditioning: amenities.hasAirConditioning,
      heating: preview.heating,
      patches: {},
      suggestions: preview.suggestions,
    };
  }

  const amenities = { ...preview.amenities };
  const patches: IntelligenceAmenityPatchMap = {};
  const description = importDescriptionBlob(params.draft);

  for (const field of Object.keys(amenities) as IntelligenceAmenityField[]) {
    if (decisions[field] === false) {
      amenities[field] = portalFeaturesIncludeAmenity(features, field);
      continue;
    }
    if (!autoApply) {
      amenities[field] = portalFeaturesIncludeAmenity(features, field);
      continue;
    }
    const fromPortal = portalFeaturesIncludeAmenity(features, field);
    const fromDescription = descriptionImpliesAmenity(description, field);
    if (!fromPortal && fromDescription && amenities[field]) {
      const suggestion =
        preview.suggestions.find((item) => item.field === field) ||
        ({
          field,
          label: field,
          question: '',
          quotes: [],
        } as IntelligenceAmenitySuggestion);
      patches[field] = buildAppliedPatch(suggestion, 'import');
    }
  }

  return {
    amenities,
    hasAirConditioning: amenities.hasAirConditioning,
    heating: preview.heating,
    patches,
    suggestions: preview.suggestions,
  };
}

export async function draftToOfferCreateBody(
  draft: OtodomImportDraft,
  userId: number,
  presentation: { title: string; descriptionHtml: string },
  options?: {
    agentCommissionPercent?: number | null;
    smartAddEnabled?: boolean;
    smartAddAutoApply?: boolean;
    smartAddDecisions?: unknown;
  },
) {
  assertOtodomImportDraftReady(draft);

  const { city, district, street } = await resolveOtodomImportLocationFields(draft);
  const country = await inferCountryFromCoordinates(draft.lat, draft.lng);
  const smart = resolveImportSmartAdd({
    draft,
    decisions: options?.smartAddDecisions,
    enabled: options?.smartAddEnabled !== false,
    autoApply: options?.smartAddAutoApply !== false,
  });

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
    hasBalcony: smart.amenities.hasBalcony,
    hasElevator: smart.amenities.hasElevator,
    hasStorage: smart.amenities.hasStorage,
    hasParking: smart.amenities.hasParking,
    hasGarden: smart.amenities.hasGarden,
    isFurnished: smart.amenities.isFurnished,
    isDuplex: smart.amenities.isDuplex,
    hasAirConditioning: smart.hasAirConditioning,
    heating: smart.heating ?? sanitizeImportHeating(draft.heating, draft.heatingCode),
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
  const fetchUrl = upgradeListingImageUrl(url);
  try {
    const response = await fetch(fetchUrl, {
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
    if (!response.ok) {
      if (fetchUrl === url) return null;
      const fallback = await fetch(url, {
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
      if (!fallback.ok) return null;
      const buffer = Buffer.from(await fallback.arrayBuffer());
      if (!buffer.length || buffer.length > MAX_OFFER_FILE_BYTES) return null;
      let mime =
        fallback.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '';
      const sniffed = sniffImageMimeFromMagic(buffer);
      if (sniffed) mime = sniffed;
      if (!mime.startsWith('image/')) return null;
      return { buffer, mime };
    }

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
  shouldCancel?: () => boolean | Promise<boolean>;
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

  const throwIfCancelled = async () => {
    if (await params.shouldCancel?.()) {
      throw new Error('Import anulowany.');
    }
  };

  const uploadGalleryImage = async (remoteUrl: string, galleryIndex: number, step: number) => {
    await throwIfCancelled();
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
      return null;
    }

    let processedBuffer: Buffer;
    try {
      processedBuffer = await processOtodomImportImageBuffer(file.buffer, galleryIndex);
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
      return null;
    }

    uploaded += 1;
    return saved.url;
  };

  await acquireOfferUploadLock(params.offerId);
  try {
    let step = 0;
    for (let offset = 0; offset < galleryUrls.length; offset += IMAGE_UPLOAD_CONCURRENCY) {
      await throwIfCancelled();
      const chunk = galleryUrls.slice(offset, offset + IMAGE_UPLOAD_CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (remoteUrl, chunkIndex) => {
          const galleryIndex = offset + chunkIndex;
          step += 1;
          const currentStep = step;
          return uploadGalleryImage(remoteUrl, galleryIndex, currentStep);
        }),
      );
      for (const url of chunkResults) {
        if (url) urls.push(url);
      }
    }

    if (floorPlanRemoteUrl) {
      await throwIfCancelled();
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
    shouldCancel?: () => boolean | Promise<boolean>;
    /** false = głos właściciela (import zaproszeń), true = głos agenta (domyślnie). */
    agentVoice?: boolean;
    /** Zachowaj tytuł i opis z portalu bez AI (zaproszenia właścicieli). */
    preserveOriginalCopy?: boolean;
    /** Pomiń automatyczne wykrywanie rzutu (oszczędza ~25s przy imporcie mobilnym). */
    skipAutoFloorPlanProbe?: boolean;
    smartAddEnabled?: boolean;
    smartAddAutoApply?: boolean;
    smartAddDecisions?: unknown;
    kei?: KeiImportContext | null;
  },
) {
  const throwIfCancelled = async () => {
    if (await options?.shouldCancel?.()) {
      throw new Error('Import anulowany.');
    }
  };

  await throwIfCancelled();

  const claim = await claimImportExternalKey(draft.source, draft.externalId);
  if (!claim.claimed) {
    const existingLocked = claim.offerId
      ? await prisma.offer.findUnique({
          where: { id: claim.offerId },
          select: { id: true, title: true, status: true },
        })
      : await findExistingImportedOffer(draft);
    return {
      ok: false as const,
      code: 'ALREADY_IMPORTED' as const,
      existingOfferId: existingLocked?.id,
      message: existingLocked
        ? `Ta oferta jest już w bazie jako #${existingLocked.id} (${existingLocked.status}).`
        : 'To ogłoszenie jest właśnie importowane — pominięto duplikat.',
    };
  }

  const existing = await findExistingImportedOffer(draft);
  if (existing) {
    await bindImportExternalKey(draft.source, draft.externalId, existing.id);
    return {
      ok: false as const,
      code: 'ALREADY_IMPORTED' as const,
      existingOfferId: existing.id,
      message: `Ta oferta OtoDom (#${draft.externalId}) jest już w bazie jako #${existing.id} (${existing.status}).`,
    };
  }

  await throwIfCancelled();
  options?.onCopyProgress?.(
    options?.preserveOriginalCopy ? 'Kopiowanie opisu z portalu…' : 'Przeróbka opisu (sztuczna inteligencja)…',
    options?.preserveOriginalCopy ? 'bez zmian' : isOtodomImportAiConfigured() ? 'GPT' : 'reguły',
  );
  const presentation = options?.preserveOriginalCopy
    ? {
        title: draft.title.trim(),
        descriptionHtml: (draft.descriptionHtml || draft.descriptionText || '').trim(),
        rewrittenByAi: false,
        aiSkipReason: 'preserve_original_copy',
      }
    : await buildOtodomPresentationCopy(draft, {
        agentVoice: options?.agentVoice !== false,
      });
  const detail = presentation.rewrittenByAi
    ? 'AI ✓'
    : options?.preserveOriginalCopy
      ? 'oryginał'
      : 'automatycznie';
  if (!presentation.rewrittenByAi && presentation.aiSkipReason && !options?.preserveOriginalCopy) {
    console.warn('[otodom-import] copy fallback:', presentation.aiSkipReason);
  }
  options?.onCopyProgress?.(
    presentation.rewrittenByAi
      ? 'Opis przepisany przez AI'
      : options?.preserveOriginalCopy
        ? 'Opis skopiowany z portalu'
        : 'Opis uzupełniony automatycznie',
    detail,
    { rewrittenByAi: presentation.rewrittenByAi },
  );
  await throwIfCancelled();
  const kei = options?.kei || null;
  const patchedDraft: OtodomImportDraft = {
    ...draft,
    rooms: draft.rooms || kei?.rooms || null,
    district:
      draft.district && draft.district !== 'OTHER'
        ? draft.district
        : kei?.district || draft.district,
    street: draft.street || kei?.street || null,
  };

  const body = await draftToOfferCreateBody(patchedDraft, ownerUserId, presentation, {
    agentCommissionPercent: options?.agentCommissionPercent,
    smartAddEnabled: options?.smartAddEnabled,
    smartAddAutoApply: options?.smartAddAutoApply,
    smartAddDecisions: options?.smartAddDecisions,
  });
  let offerId: number | null = null;
  let publicationReserved = false;

  try {
    const offer = await createOffer(body);
    offerId = Number((offer as { id?: number }).id);
    if (!Number.isFinite(offerId)) {
      throw new Error('Nie udało się odczytać ID nowej oferty.');
    }
    await bindImportExternalKey(draft.source, draft.externalId, offerId);

    const smart = resolveImportSmartAdd({
      draft,
      decisions: options?.smartAddDecisions,
      enabled: options?.smartAddEnabled !== false,
      autoApply: options?.smartAddAutoApply !== false,
    });
    if (Object.keys(smart.patches).length) {
      await writeOfferAmenityPatches(offerId, smart.patches);
    }

    await upsertImportedOfferPrivateSnapshot({
      offerId,
      userId: ownerUserId,
      draft: patchedDraft,
      kei,
    });

    await throwIfCancelled();

    let floorPlanImageIndex: number | null = null;
    if (options?.floorPlanImageIndex !== undefined) {
      floorPlanImageIndex = options.floorPlanImageIndex;
    } else if (options?.lastImageFloorPlan === false) {
      floorPlanImageIndex = null;
    } else if (options?.lastImageFloorPlan === true && draft.imageUrls.length > 0) {
      floorPlanImageIndex = draft.imageUrls.length - 1;
    } else if (
      options?.lastImageFloorPlan === undefined &&
      !options?.skipAutoFloorPlanProbe &&
      draft.imageUrls.length > 0
    ) {
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
      shouldCancel: options?.shouldCancel,
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
          const pending = await readPendingPublication(offerId);
          if (!pending?.kind) {
            throw new Error('IMPORT_PUBLICATION_RESERVE_FAILED');
          }
          publicationReserved = true;
        } catch (error) {
          await deleteOfferAfterImportPaymentFailure(offerId);
          offerId = null;
          if (error instanceof ImportPublicationError) {
            if (error.code === 'PUBLICATION_REQUIRES_PLUS') {
              throw new Error('NO_PLUS_CREDIT_AVAILABLE');
            }
            throw new Error(error.message);
          }
          if (error instanceof Error && error.message === 'IMPORT_PUBLICATION_RESERVE_FAILED') {
            throw new Error('Nie udało się zarezerwować publikacji po imporcie. Spróbuj ponownie.');
          }
          throw error;
        }
      } else {
        const recovered = await tryRecoverImportOfferPendingPublication({
          offerId,
          userId: ownerUserId,
        });
        if (!recovered) {
          await deleteOfferAfterImportPaymentFailure(offerId);
          offerId = null;
          throw new Error('Wybierz metodę publikacji (kupon lub kredyt Pakiet Plus) przed importem.');
        }
        publicationReserved = true;
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
  } catch (error) {
    if (offerId && !publicationReserved) {
      await deleteOfferAfterImportPaymentFailure(offerId).catch(() => undefined);
      offerId = null;
    }
    if (!offerId) {
      await releaseImportExternalClaim(draft.source, draft.externalId);
    }
    throw error;
  }
}
