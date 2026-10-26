import { prisma } from '@/lib/prisma';
import { importOfferFromUrl, isSupportedImportOfferUrl, type OtodomImportDraft } from '@/lib/otodomImport';
import { createOfferFromOtodomDraft, findExistingImportedOffer, findExistingImportedOfferByPortalUrl } from '@/lib/otodomImportCreate';
import { isOtodomImportAiConfigured } from '@/lib/otodomImportRewrite';
import { peekLastImageInfo } from '@/lib/otodomImportFloorPlan';
import { enrichOtodomImportDraft } from '@/lib/portalImportEnrich';
import { activateOfferPublication } from '@/lib/offerPublication';
import type { KeiExportProgressEmitter, KeiPublishState, KeiSkipKind } from '@/lib/keiAmerExportProgress';
import {
  findWarsawPortalListings,
  findKeiListingsByIdsOrUrls,
  ensureKeiAmerSession,
  keiPropertyKindLabel,
  keiTransactionKindLabel,
  resolveKeiTransactionKind,
  type KeiListingRow,
  type KeiPropertyKind,
  type KeiTransactionKind,
} from '@/lib/keiAmerClient';
import {
  assertKeiListingAvailableForImport,
  markKeiListingFailed,
  markKeiListingImported,
} from '@/lib/keiAmerListingState';
import { importUrlLookupCandidates } from '@/lib/importDuplicateGuard';
import { buildKeiImportContext, keiContextFromSelection, type KeiImportContext } from '@/lib/keiAmerListingExtras';
import { isInsideWarsaw, pinKeiDraftToWarsaw } from '@/lib/keiAmerDistrict';
import { geocodeWarsawPlace, keiNeighborhoodFromAddress } from '@/lib/keiWarsawGeocode';

const DEFAULT_EXPORT_USER_ID = 55;
const DEFAULT_COMMISSION_PERCENT = 2;
const DEFAULT_EXPORT_COUNT = 1;
const MAX_EXPORT_COUNT = 80;
const KEI_MAX_IMPORT_IMAGES = 8;

function resolveExportUserId(raw?: unknown): number {
  const fromEnv = Number(process.env.KEI_AMER_EXPORT_USER_ID);
  const fromBody = Number(raw);
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return DEFAULT_EXPORT_USER_ID;
}

function resolveCommissionPercent(raw?: unknown): number {
  const fromEnv = Number(process.env.KEI_AMER_EXPORT_COMMISSION_PERCENT);
  const fromBody = Number(raw);
  if (Number.isFinite(fromBody) && fromBody >= 0) return fromBody;
  if (Number.isFinite(fromEnv) && fromEnv >= 0) return fromEnv;
  return DEFAULT_COMMISSION_PERCENT;
}

function resolveExportCount(raw?: unknown): number {
  const fromBody = Number(raw);
  if (Number.isFinite(fromBody) && fromBody > 0) {
    return Math.min(Math.floor(fromBody), MAX_EXPORT_COUNT);
  }
  return DEFAULT_EXPORT_COUNT;
}

function resolvePropertyKind(raw?: unknown): KeiPropertyKind {
  return raw === 'house' ? 'house' : 'apartment';
}

function resolveFloorPlanOverride(
  portalUrl: string,
  overrides?: Record<string, boolean>,
): boolean | undefined {
  if (!overrides) return undefined;
  if (Object.prototype.hasOwnProperty.call(overrides, portalUrl)) {
    return overrides[portalUrl];
  }
  return undefined;
}

export type KeiFloorPlanSelection = {
  enabled: boolean;
  imageIndex: number;
};

function resolveFloorPlanSelectionForExport(
  portalUrl: string,
  draft: OtodomImportDraft,
  options?: {
    floorPlanSelections?: Record<string, KeiFloorPlanSelection>;
    floorPlanOverrides?: Record<string, boolean>;
  },
): { enabled: boolean; imageIndex: number | null } {
  const selection = options?.floorPlanSelections?.[portalUrl];
  if (selection) {
    if (!selection.enabled) return { enabled: false, imageIndex: null };
    const idx =
      selection.imageIndex >= 0 && selection.imageIndex < draft.imageUrls.length
        ? selection.imageIndex
        : null;
    return { enabled: true, imageIndex: idx };
  }

  const legacy = resolveFloorPlanOverride(portalUrl, options?.floorPlanOverrides);
  if (legacy === false) return { enabled: false, imageIndex: null };
  if (legacy === true) {
    return {
      enabled: true,
      imageIndex: draft.imageUrls.length > 0 ? draft.imageUrls.length - 1 : null,
    };
  }

  const peek = peekLastImageInfo(draft);
  return {
    enabled: peek.suggestedFloorPlanIndex !== null,
    imageIndex: peek.suggestedFloorPlanIndex,
  };
}

/**
 * Filtr KEI uzupełnia typ tylko wtedy, gdy portal go nie podał — dane z portalu są pewniejsze
 * niż klasyfikacja KEI (unikamy domu opisanego jako mieszkanie).
 */
function alignDraftWithKeiExportFilters(
  draft: OtodomImportDraft,
  propertyKind: KeiPropertyKind,
  transactionKind: KeiTransactionKind,
): OtodomImportDraft {
  return {
    ...draft,
    transactionType: draft.transactionType || (transactionKind === 'rent' ? 'RENT' : 'SALE'),
    propertyType: draft.propertyType || (propertyKind === 'house' ? 'HOUSE' : 'FLAT'),
  };
}

/**
 * KEI = Warszawa. Miasto i dzielnica z adresu KEI; gdy pinezka z portalu wypada poza Warszawą
 * (portal bez współrzędnych + geokoder szukał ulicy w złym mieście), szukamy jej na nowo w Warszawie.
 * Bez trafienia w Warszawie zostawiamy ofertę bez pinezki — tworzenie zgłosi błąd i spróbuje później.
 */
async function anchorKeiDraftInWarsaw(draft: OtodomImportDraft, kei: KeiImportContext | null | undefined): Promise<OtodomImportDraft> {
  const pinned = pinKeiDraftToWarsaw(draft, kei);
  if (pinned.city !== 'Warszawa' || isInsideWarsaw(pinned.lat, pinned.lng)) return pinned;
  const hit = await geocodeWarsawPlace({
    street: kei?.street || null,
    neighborhood: keiNeighborhoodFromAddress(kei?.address),
    district: pinned.district,
  });
  return hit
    ? { ...pinned, lat: hit.lat, lng: hit.lng, street: kei?.street || pinned.street }
    : { ...pinned, lat: null, lng: null };
}

const DEFAULT_MIN_IMAGES_TO_PUBLISH = 3;
const ITEM_TIME_BUDGET_MS = 4 * 60_000;

function withTimeBudget<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} trwało zbyt długo — pominięto, spróbujemy później.`)), ms);
      timer.unref?.();
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export type KeiExportItemResult = {
  keiListingId: string;
  portalUrl: string;
  offerId: number;
  publicUrl: string;
  editUrl: string;
  publishState?: KeiPublishState;
  aiRewritten?: boolean;
};

export type KeiExportSkippedItem = {
  keiListingId: string;
  portalUrl: string;
  reason: string;
  existingOfferId?: number;
  kind?: KeiSkipKind;
};

export async function peekKeiPortalListing(portalUrl: string) {
  const draft = await importOfferFromUrl(portalUrl);
  const peek = peekLastImageInfo(draft);
  return {
    ok: true as const,
    portalUrl,
    title: draft.title,
    imageCount: peek.imageCount,
    lastImageUrl: peek.lastImageUrl,
    suggestedFloorPlan: peek.suggestedFloorPlan,
    suggestedFloorPlanIndex: peek.suggestedFloorPlanIndex,
    imageUrls: peek.imageUrls,
    previewUrls: peek.imageUrls.slice(-3),
  };
}

export async function exportKeiListingsToEstateOS(options?: {
  targetUserId?: number;
  agentCommissionPercent?: number;
  count?: number;
  propertyKind?: KeiPropertyKind;
  transactionKind?: KeiTransactionKind;
  selections?: Array<{
    keiId?: string;
    portalUrl: string;
    address?: string;
    phone?: string;
    district?: string;
    street?: string;
    rooms?: number | null;
    listedAt?: string;
    directOwner?: boolean;
  }>;
  floorPlanOverrides?: Record<string, boolean>;
  floorPlanSelections?: Record<string, KeiFloorPlanSelection>;
  /** Auto: pomijaj duplikaty i leć dalej aż wystawisz `count` ofert. */
  fillUntilPublished?: boolean;
  onProgress?: KeiExportProgressEmitter;
  /** Cooperative cancel between items (durable server jobs). */
  shouldCancel?: () => boolean | Promise<boolean>;
  smartAddEnabled?: boolean;
  smartAddDecisionsByUrl?: Record<string, Record<string, boolean>>;
  /** publish = od razu na rynek; review = szkic do przejrzenia. */
  publishMode?: 'publish' | 'review';
  minImages?: number;
}): Promise<{
  ok: true;
  exported: KeiExportItemResult[];
  skipped: KeiExportSkippedItem[];
  targetUserId: number;
  agentCommissionPercent: number;
  propertyKind: KeiPropertyKind;
  transactionKind: KeiTransactionKind;
  offerId: number | null;
  portalUrl: string;
  publicUrl: string;
  editUrl: string;
  message: string;
}> {
  const emit = options?.onProgress;
  const checkCancel = async () => {
    if (!options?.shouldCancel) return false;
    return Boolean(await options.shouldCancel());
  };

  const session = await ensureKeiAmerSession(true);
  if (!session.ok) {
    throw new Error(session.message);
  }

  const targetUserId = resolveExportUserId(options?.targetUserId);
  const agentCommissionPercent = resolveCommissionPercent(options?.agentCommissionPercent);
  const propertyKind = resolvePropertyKind(options?.propertyKind);
  const transactionKind = resolveKeiTransactionKind(options?.transactionKind);

  const rawSelections = Array.isArray(options?.selections) ? options.selections : [];
  const selections = rawSelections
    .map((row) => ({
      keiId: String(row?.keiId || '').trim(),
      portalUrl: String(row?.portalUrl || '').trim(),
      address: String(row?.address || '').trim(),
      phone: String(row?.phone || '').trim(),
      district: String(row?.district || '').trim(),
      street: String(row?.street || '').trim(),
      rooms: row?.rooms ?? null,
      listedAt: String(row?.listedAt || '').trim(),
      directOwner: Boolean(row?.directOwner),
    }))
    .filter((row) => row.portalUrl);

  const fillUntilPublished = Boolean(options?.fillUntilPublished) || selections.length === 0;
  const publishTarget = resolveExportCount(options?.count);
  const count = fillUntilPublished ? publishTarget : selections.length;

  const owner = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true },
  });
  if (!owner) {
    throw new Error(`Użytkownik docelowy #${targetUserId} nie istnieje.`);
  }

  type ExportTarget = {
    keiListingId: string;
    portalUrl: string;
    kei: KeiImportContext | null;
    /** Indeks pozycji w jobie (kolejność wyboru) — postęp trafia do właściwej karty. */
    slot: number;
  };

  let exportTargets: ExportTarget[] = [];

  if (selections.length > 0) {
    exportTargets = selections.map((row, slot) => ({
      keiListingId: row.keiId || row.portalUrl,
      portalUrl: row.portalUrl,
      kei: keiContextFromSelection(row),
      slot,
    }));

    // Thin selections (legacy auto / old app) — fetch only missing KEI rows, stop early.
    const thin = exportTargets.filter((row) => !row.kei?.phone);
    if (thin.length > 0) {
      const listings = await findKeiListingsByIdsOrUrls({
        propertyKind,
        transactionKind,
        keiIds: thin.map((row) => row.keiListingId),
        portalUrls: thin.map((row) => row.portalUrl),
        maxPages: 3,
      });
      const byId = new Map(listings.map((row) => [String(row.id), row]));
      const byUrl = new Map(
        listings
          .map((row) => [String(row.www || '').trim().replace(/\/+$/, ''), row] as const)
          .filter(([url]) => Boolean(url)),
      );
      exportTargets = exportTargets.map((target) => {
        if (target.kei?.phone) return target;
        const urlKey = String(target.portalUrl || '').trim().replace(/\/+$/, '');
        const full =
          byId.get(String(target.keiListingId || '')) ||
          byUrl.get(urlKey) ||
          null;
        if (!full) return target;
        const enriched = buildKeiImportContext(full);
        if (!enriched) return target;
        return {
          ...target,
          kei: {
            ...enriched,
            phone: target.kei?.phone || enriched.phone,
            address: target.kei?.address || enriched.address,
            district: target.kei?.district || enriched.district,
            street: target.kei?.street || enriched.street,
            rooms: target.kei?.rooms || enriched.rooms,
            listedAt: target.kei?.listedAt || enriched.listedAt,
            directOwner: Boolean(target.kei?.directOwner || enriched.directOwner),
          },
        };
      });
    }
  } else {
    const listings = await findWarsawPortalListings({
      propertyKind,
      transactionKind,
      maxResults: Math.max(count * 5, 30),
      maxPages: 12,
    });

    if (listings.length === 0) {
      throw new Error(
        `Nie znaleziono ogłoszeń (${keiPropertyKindLabel(propertyKind)}, ${keiTransactionKindLabel(transactionKind)}) z linkiem OtoDom / OLX / Nieruchomosci-Online.`,
      );
    }

    exportTargets = listings
      .map((listing, slot) => ({
        keiListingId: listing.id,
        portalUrl: String(listing.www || '').trim(),
        kei: buildKeiImportContext(listing),
        slot,
      }))
      .filter((row) => row.portalUrl);
  }

  if (exportTargets.length === 0) {
    throw new Error('Brak ogłoszeń do eksportu.');
  }

  const seenUrls = new Set<string>();
  exportTargets = exportTargets.filter((row) => {
    const keys = importUrlLookupCandidates(row.portalUrl);
    const fingerprint = keys[0] || String(row.portalUrl || '').trim();
    if (!fingerprint || seenUrls.has(fingerprint)) return false;
    if (keys.some((key) => seenUrls.has(key))) return false;
    for (const key of keys) seenUrls.add(key);
    seenUrls.add(fingerprint);
    return true;
  });

  const plannedTotal =
    fillUntilPublished
      ? Math.min(Math.max(publishTarget, 1), exportTargets.length || publishTarget)
      : exportTargets.length;

  emit?.({ type: 'batch_start', total: plannedTotal });

  const exported: KeiExportItemResult[] = [];
  const skipped: KeiExportSkippedItem[] = [];
  const publishMode = options?.publishMode === 'review' ? 'review' : 'publish';
  const minImages = Math.max(0, Math.min(20, Math.floor(Number(options?.minImages ?? DEFAULT_MIN_IMAGES_TO_PUBLISH)) || 0));
  let aiRewrittenCount = 0;
  let reviewCount = 0;

  const skip = (
    target: { keiListingId: string; portalUrl: string; slot: number },
    reason: string,
    kind: KeiSkipKind,
    existingOfferId?: number,
  ) => {
    skipped.push({ keiListingId: target.keiListingId, portalUrl: target.portalUrl, reason, existingOfferId, kind });
    emit?.({
      type: 'item_skip',
      index: target.slot,
      keiListingId: target.keiListingId,
      portalUrl: target.portalUrl,
      reason,
      existingOfferId,
      kind,
    });
  };

  for (const target of exportTargets) {
    if (fillUntilPublished && exported.length >= count) break;
    if (await checkCancel()) {
      throw new Error('Import anulowany.');
    }

    const portalUrl = target.portalUrl;
    const keiListingId = target.keiListingId;
    const currentIndex = target.slot;

    emit?.({
      type: 'item_start',
      index: currentIndex,
      total: plannedTotal,
      keiListingId,
      portalUrl,
      address: target.kei?.address ?? undefined,
    });

    if (!portalUrl || !isSupportedImportOfferUrl(portalUrl)) {
      skip({ ...target, portalUrl: portalUrl || '(pusty)' }, 'Nieobsługiwany link portalu.', 'blocked');
      continue;
    }

    try {
      emit?.({ type: 'step', index: currentIndex, step: 'check_duplicate', label: 'Sprawdzanie w bazie' });

      try {
        await assertKeiListingAvailableForImport(portalUrl);
      } catch (outreachBlock) {
        const reason =
          outreachBlock instanceof Error
            ? outreachBlock.message
            : 'Wysłano zaproszenie właściciela — import zablokowany.';
        skip(target, reason, /zaimportowane/i.test(reason) ? 'duplicate' : 'blocked');
        continue;
      }

      const existingByUrl = await findExistingImportedOfferByPortalUrl(portalUrl);
      if (existingByUrl) {
        skip(target, 'Już zaimportowane — pominięto.', 'duplicate', existingByUrl.id);
        continue;
      }

      emit?.({ type: 'step', index: currentIndex, step: 'fetch_portal', label: 'Pobieranie danych z portalu' });

      const itemStartedAt = Date.now();
      const remainingBudget = () => Math.max(15_000, ITEM_TIME_BUDGET_MS - (Date.now() - itemStartedAt));

      // KEI to wyłącznie Warszawa: gdy pinezka jest w Warszawie, miasto i dzielnica idą z KEI, nie z tekstu ogłoszenia
      // (tekst potrafi wskazać np. Białystok — a AI pisałoby wtedy opis o złym mieście).
      const draft = await anchorKeiDraftInWarsaw(
        alignDraftWithKeiExportFilters(
          await withTimeBudget(
            enrichOtodomImportDraft(await importOfferFromUrl(portalUrl)),
            remainingBudget(),
            'Pobieranie z portalu',
          ),
          propertyKind,
          transactionKind,
        ),
        target.kei,
      );

      emit?.({
        type: 'item_meta',
        index: currentIndex,
        thumbUrl: draft.imageUrls?.[0] ?? null,
        title: draft.title || null,
        price: Number.isFinite(Number(draft.price)) ? Number(draft.price) : null,
        area: Number.isFinite(Number(draft.area)) ? Number(draft.area) : null,
        district: draft.district && draft.district !== 'OTHER' ? draft.district : target.kei?.district ?? null,
      });

      const existing = await findExistingImportedOffer(draft);
      if (existing) {
        skip(target, 'Już w bazie (ten sam lokal) — pominięto.', 'duplicate', existing.id);
        continue;
      }

      if (!draft.imageUrls?.length) {
        await markKeiListingFailed({ portalUrl, keiListingId, reason: 'Brak zdjęć w ogłoszeniu.' }).catch(() => undefined);
        skip(target, 'Ogłoszenie bez zdjęć — pominięto.', 'quality');
        continue;
      }

      const floorPlanChoice = resolveFloorPlanSelectionForExport(portalUrl, draft, {
        floorPlanSelections: options?.floorPlanSelections,
        floorPlanOverrides: options?.floorPlanOverrides,
      });
      const peek = peekLastImageInfo(draft);
      const floorPlanUrl =
        floorPlanChoice.imageIndex != null ? draft.imageUrls[floorPlanChoice.imageIndex] ?? null : null;

      emit?.({
        type: 'floor_plan_decision',
        index: currentIndex,
        portalUrl,
        lastImageUrl: floorPlanUrl ?? peek.lastImageUrl,
        asFloorPlan: floorPlanChoice.enabled && floorPlanChoice.imageIndex != null,
        source:
          options?.floorPlanSelections?.[portalUrl] || options?.floorPlanOverrides?.[portalUrl] !== undefined
            ? 'override'
            : 'auto',
      });

      emit?.({
        type: 'step',
        index: currentIndex,
        step: 'create_offer',
        label: isOtodomImportAiConfigured() ? 'Opis przygotowuje AI' : 'Tworzenie oferty',
        detail: draft.title,
      });

      if (await checkCancel()) {
        throw new Error('Import anulowany.');
      }

      // Bez wyścigu z limitem czasu: tworzenie ma skutki uboczne (oferta, zdjęcia) — pilnują go timeouty pobierania.
      const created = await createOfferFromOtodomDraft(draft, targetUserId, undefined, {
          kei: target.kei,
          agentCommissionPercent,
          maxImportImages: KEI_MAX_IMPORT_IMAGES,
          floorPlanImageIndex: floorPlanChoice.enabled ? floorPlanChoice.imageIndex : null,
          shouldCancel: checkCancel,
          smartAddEnabled: options?.smartAddEnabled !== false,
          smartAddDecisions: options?.smartAddDecisionsByUrl?.[portalUrl],
          onCopyProgress: (label, detail, meta) => {
            emit?.({
              type: 'step',
              index: currentIndex,
              step: 'create_offer',
              label,
              detail: meta?.rewrittenByAi ? 'AI ✓' : detail || 'reguły',
            });
          },
          onImageProgress: (progress) => {
            emit?.({
              type: 'image_progress',
              index: currentIndex,
              imageIndex: progress.index,
              imageTotal: progress.total,
              asFloorPlan: Boolean(progress.asFloorPlan),
              label: progress.label,
            });
            emit?.({
              type: 'step',
              index: currentIndex,
              step: 'images',
              label: progress.label,
              detail: progress.asFloorPlan ? 'Rzut lokalu' : undefined,
            });
          },
        });

      if (!created.ok) {
        skip(
          target,
          created.message || 'Import nie powiódł się.',
          created.existingOfferId ? 'duplicate' : 'error',
          created.existingOfferId,
        );
        continue;
      }

      const aiRewritten = Boolean(created.presentation?.rewrittenByAi);
      if (aiRewritten) aiRewrittenCount += 1;
      const imageCount = Number(created.images?.uploaded || 0);

      // Kontrola jakości: za mało zdjęć albo tryb „do przejrzenia” → szkic zamiast publikacji.
      let publishState: KeiPublishState = 'published';
      let note: string | undefined;
      if (publishMode === 'review') {
        publishState = 'review';
        note = 'Tryb „do przejrzenia” — szkic czeka na agenta.';
      } else if (imageCount < minImages) {
        publishState = 'review';
        note = `Tylko ${imageCount} zdjęć (min. ${minImages}) — zostawiono jako szkic.`;
      }

      if (publishState === 'published') {
        emit?.({
          type: 'step',
          index: currentIndex,
          step: 'activate',
          label: 'Publikacja na rynku',
          detail: `#${created.offerId}`,
        });
        try {
          await activateOfferPublication({
            userId: targetUserId,
            offerId: created.offerId,
            kind: 'PLUS_CREDIT',
            skipEntitlementConsume: true,
          });
        } catch (activationError) {
          publishState = 'review';
          note = `Oferta utworzona, publikacja nie powiodła się: ${
            activationError instanceof Error ? activationError.message : 'nieznany błąd'
          }`;
        }
      }
      if (publishState === 'review') reviewCount += 1;

      const resultItem: KeiExportItemResult = {
        keiListingId,
        portalUrl,
        offerId: created.offerId,
        publicUrl: created.publicUrl,
        editUrl: created.editUrl,
        publishState,
        aiRewritten,
      };

      exported.push(resultItem);
      await markKeiListingImported({ portalUrl, keiListingId, offerId: created.offerId });
      emit?.({
        type: 'item_done',
        index: currentIndex,
        keiListingId,
        offerId: created.offerId,
        portalUrl,
        publicUrl: created.publicUrl,
        editUrl: created.editUrl,
        publishState,
        aiRewritten,
        imageCount,
        note,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Nieznany błąd importu.';
      if (/anulow/i.test(reason)) throw error;
      await markKeiListingFailed({ portalUrl, keiListingId, reason }).catch(() => undefined);
      skip(target, reason, /404|nieaktualn|usunięt|niedostępn/i.test(reason) ? 'inactive' : 'error');
    }
  }

  if (exported.length === 0 && !fillUntilPublished) {
    const alreadyImported = skipped.filter((item) => item.kind === 'duplicate').length;
    if (alreadyImported > 0 && alreadyImported === skipped.length) {
      throw new Error(
        `Wybrane ogłoszenia są już w bazie (${alreadyImported}). Odznacz je lub wybierz inne.`,
      );
    }
    const firstError = skipped.find((item) => item.kind === 'error')?.reason;
    throw new Error(firstError ? `Nie udało się zaimportować: ${firstError}` : 'Nie udało się zaimportować żadnego ogłoszenia.');
  }

  const kindLabel = keiPropertyKindLabel(propertyKind);
  const txLabel = keiTransactionKindLabel(transactionKind);
  const duplicateCount = skipped.filter((item) => item.kind === 'duplicate').length;
  const otherSkipped = skipped.length - duplicateCount;
  const skippedNote =
    (duplicateCount > 0 ? ` ${duplicateCount} już w bazie.` : '') +
    (otherSkipped > 0 ? ` ${otherSkipped} pominiętych.` : '') +
    (reviewCount > 0 ? ` ${reviewCount} jako szkic do przejrzenia.` : '');
  const message =
    exported.length === 0
      ? `Brak nowych ofert w tym cyklu (${kindLabel}, ${txLabel}).${skippedNote}`
      : exported.length === 1
      ? `Gotowa oferta #${exported[0].offerId} (${kindLabel}, ${txLabel}).${skippedNote}`
      : `Gotowe ${exported.length} ofert (${kindLabel}, ${txLabel}).${skippedNote}`;

  emit?.({
    type: 'batch_done',
    message,
    exportedCount: exported.length,
    skippedCount: skipped.length,
    aiRewrittenCount,
    reviewCount,
  });

  const first = exported[0];

  return {
    ok: true,
    exported,
    skipped,
    targetUserId,
    agentCommissionPercent,
    propertyKind,
    transactionKind,
    offerId: first?.offerId ?? null,
    portalUrl: first?.portalUrl ?? '',
    publicUrl: first?.publicUrl ?? '',
    editUrl: first?.editUrl ?? '',
    message,
  };
}

/** @deprecated Użyj exportKeiListingsToEstateOS */
export async function exportLatestKeiListingToEstateOS(options?: {
  targetUserId?: number;
  agentCommissionPercent?: number;
  propertyKind?: KeiPropertyKind;
}): Promise<{
  ok: true;
  keiListing: KeiListingRow;
  portalUrl: string;
  offerId: number;
  publicUrl: string;
  editUrl: string;
  message: string;
}> {
  const result = await exportKeiListingsToEstateOS({
    ...options,
    count: 1,
  });
  const first = result.exported[0];
  return {
    ok: true,
    keiListing: { id: first.keiListingId } as KeiListingRow,
    portalUrl: first.portalUrl,
    offerId: first.offerId,
    publicUrl: first.publicUrl,
    editUrl: first.editUrl,
    message: result.message,
  };
}
