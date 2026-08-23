import { prisma } from '@/lib/prisma';
import { importOfferFromUrl, isSupportedImportOfferUrl, type OtodomImportDraft } from '@/lib/otodomImport';
import { createOfferFromOtodomDraft, findExistingImportedOffer, findExistingImportedOfferByPortalUrl } from '@/lib/otodomImportCreate';
import { isOtodomImportAiConfigured } from '@/lib/otodomImportRewrite';
import { peekLastImageInfo } from '@/lib/otodomImportFloorPlan';
import { enrichOtodomImportDraft } from '@/lib/portalImportEnrich';
import { activateOfferPublication } from '@/lib/offerPublication';
import type { KeiExportProgressEmitter } from '@/lib/keiAmerExportProgress';
import {
  findWarsawPortalListings,
  ensureKeiAmerSession,
  keiPropertyKindLabel,
  keiTransactionKindLabel,
  resolveKeiTransactionKind,
  type KeiListingRow,
  type KeiPropertyKind,
  type KeiTransactionKind,
} from '@/lib/keiAmerClient';
import { assertKeiListingAvailableForImport, markKeiListingImported } from '@/lib/keiAmerListingState';
import { importUrlLookupCandidates } from '@/lib/importDuplicateGuard';
import { buildKeiImportContext, keiContextFromSelection, type KeiImportContext } from '@/lib/keiAmerListingExtras';

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

function alignDraftWithKeiExportFilters(
  draft: OtodomImportDraft,
  propertyKind: KeiPropertyKind,
  transactionKind: KeiTransactionKind,
): OtodomImportDraft {
  return {
    ...draft,
    transactionType: transactionKind === 'rent' ? 'RENT' : 'SALE',
    propertyType: propertyKind === 'house' ? 'HOUSE' : 'FLAT',
  };
}

export type KeiExportItemResult = {
  keiListingId: string;
  portalUrl: string;
  offerId: number;
  publicUrl: string;
  editUrl: string;
};

export type KeiExportSkippedItem = {
  keiListingId: string;
  portalUrl: string;
  reason: string;
  existingOfferId?: number;
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

  type ExportTarget = { keiListingId: string; portalUrl: string; kei: KeiImportContext | null };

  let exportTargets: ExportTarget[] = [];

  if (selections.length > 0) {
    exportTargets = selections.map((row) => ({
      keiListingId: row.keiId || row.portalUrl,
      portalUrl: row.portalUrl,
      kei: keiContextFromSelection(row),
    }));

    // Selekcje z apki/auto czasem mają tylko id+url+adres — dograj telefon i resztę z KEI.
    const needsEnrich = exportTargets.some((row) => !row.kei?.phone || !row.kei?.listedAt || !row.kei?.rooms);
    if (needsEnrich) {
      const listings = await findWarsawPortalListings({
        propertyKind,
        transactionKind,
        maxResults: Math.max(exportTargets.length * 8, 40),
        maxPages: 10,
        search: { propertyKind, transactionKind, okres: '0' },
      });
      const byId = new Map(listings.map((row) => [String(row.id), row]));
      const byUrl = new Map(
        listings
          .map((row) => [String(row.www || '').trim().replace(/\/+$/, ''), row] as const)
          .filter(([url]) => Boolean(url)),
      );
      exportTargets = exportTargets.map((target) => {
        if (target.kei?.phone && target.kei.listedAt && target.kei.rooms) return target;
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
            // Prefer explicit selection values when the client already sent them.
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
        `Nie znaleziono ogłoszeń (${keiPropertyKindLabel(propertyKind)}, ${keiTransactionKindLabel(transactionKind)}) w Warszawie z linkiem OtoDom / OLX / Nieruchomosci-Online.`,
      );
    }

    exportTargets = listings
      .map((listing) => ({
        keiListingId: listing.id,
        portalUrl: String(listing.www || '').trim(),
        kei: buildKeiImportContext(listing),
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
  let itemIndex = 0;

  for (const target of exportTargets) {
    if (fillUntilPublished && exported.length >= count) break;
    if (await checkCancel()) {
      throw new Error('Import anulowany.');
    }

    const portalUrl = target.portalUrl;
    const keiListingId = target.keiListingId;
    const currentIndex = itemIndex;
    itemIndex += 1;

    emit?.({
      type: 'item_start',
      index: currentIndex,
      total: plannedTotal,
      keiListingId,
      portalUrl,
    });

    if (!portalUrl || !isSupportedImportOfferUrl(portalUrl)) {
      skipped.push({
        keiListingId,
        portalUrl: portalUrl || '(pusty)',
        reason: 'Nieobsługiwany link portalu.',
      });
      emit?.({
        type: 'item_skip',
        index: currentIndex,
        keiListingId,
        portalUrl: portalUrl || '(pusty)',
        reason: 'Nieobsługiwany link portalu.',
      });
      continue;
    }

    try {
      emit?.({
        type: 'step',
        index: currentIndex,
        step: 'check_duplicate',
        label: 'Sprawdzanie duplikatu',
      });

      try {
        await assertKeiListingAvailableForImport(portalUrl);
      } catch (outreachBlock) {
        const reason =
          outreachBlock instanceof Error
            ? outreachBlock.message
            : 'Wysłano zaproszenie właściciela — import zablokowany.';
        skipped.push({ keiListingId, portalUrl, reason });
        emit?.({
          type: 'item_skip',
          index: currentIndex,
          keiListingId,
          portalUrl,
          reason,
        });
        continue;
      }

      const existingByUrl = await findExistingImportedOfferByPortalUrl(portalUrl);
      if (existingByUrl) {
        skipped.push({
          keiListingId,
          portalUrl,
          reason: 'Już zaimportowane (URL) — pominięto.',
          existingOfferId: existingByUrl.id,
        });
        emit?.({
          type: 'item_skip',
          index: currentIndex,
          keiListingId,
          portalUrl,
          reason: 'Już zaimportowane — pominięto.',
          existingOfferId: existingByUrl.id,
        });
        continue;
      }

      emit?.({
        type: 'step',
        index: currentIndex,
        step: 'fetch_portal',
        label: 'Pobieranie danych z portalu',
      });

      const draft = alignDraftWithKeiExportFilters(
        await enrichOtodomImportDraft(await importOfferFromUrl(portalUrl)),
        propertyKind,
        transactionKind,
      );
      const existing = await findExistingImportedOffer(draft);
      if (existing) {
        skipped.push({
          keiListingId,
          portalUrl,
          reason: 'Już zaimportowane — pominięto.',
          existingOfferId: existing.id,
        });
        emit?.({
          type: 'item_skip',
          index: currentIndex,
          keiListingId,
          portalUrl,
          reason: 'Już zaimportowane — pominięto.',
          existingOfferId: existing.id,
        });
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
        label: isOtodomImportAiConfigured()
          ? 'Przeróbka opisu (AI) i tworzenie oferty'
          : 'Tworzenie oferty w EstateOS',
        detail: draft.title,
      });

      if (await checkCancel()) {
        throw new Error('Import anulowany.');
      }

      const created = await createOfferFromOtodomDraft(draft, targetUserId, undefined, {
        kei: target.kei,
        agentCommissionPercent,
        maxImportImages: KEI_MAX_IMPORT_IMAGES,
        floorPlanImageIndex: floorPlanChoice.enabled ? floorPlanChoice.imageIndex : null,
        shouldCancel: checkCancel,
        smartAddEnabled: options?.smartAddEnabled,
        smartAddAutoApply: options?.smartAddEnabled === true && !options?.smartAddDecisionsByUrl?.[portalUrl],
        smartAddDecisions: options?.smartAddDecisionsByUrl?.[portalUrl],
        onCopyProgress: (label, detail, meta) => {
          emit?.({
            type: 'step',
            index: currentIndex,
            step: 'create_offer',
            label,
            detail: meta?.rewrittenByAi
              ? 'AI ✓'
              : detail || 'reguły',
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
        skipped.push({
          keiListingId,
          portalUrl,
          reason: created.message || 'Import nie powiódł się.',
          existingOfferId: created.existingOfferId,
        });
        emit?.({
          type: 'item_skip',
          index: currentIndex,
          keiListingId,
          portalUrl,
          reason: created.message || 'Import nie powiódł się.',
          existingOfferId: created.existingOfferId,
        });
        continue;
      }

      emit?.({
        type: 'step',
        index: currentIndex,
        step: 'activate',
        label: 'Aktywacja publikacji',
        detail: `#${created.offerId}`,
      });

      await activateOfferPublication({
        userId: targetUserId,
        offerId: created.offerId,
        kind: 'PLUS_CREDIT',
        skipEntitlementConsume: true,
      });

      const resultItem = {
        keiListingId,
        portalUrl,
        offerId: created.offerId,
        publicUrl: created.publicUrl,
        editUrl: created.editUrl,
      };

      exported.push(resultItem);
      await markKeiListingImported({
        portalUrl,
        keiListingId,
        offerId: created.offerId,
      });
      emit?.({
        type: 'item_done',
        index: currentIndex,
        keiListingId,
        offerId: created.offerId,
        portalUrl,
        publicUrl: created.publicUrl,
        editUrl: created.editUrl,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Nieznany błąd importu.';
      skipped.push({
        keiListingId,
        portalUrl,
        reason,
      });
      emit?.({
        type: 'item_skip',
        index: currentIndex,
        keiListingId,
        portalUrl,
        reason,
      });
    }
  }

  if (exported.length === 0) {
    const alreadyImported = skipped.filter((item) => item.existingOfferId).length;
    if (selections.length > 0 && alreadyImported > 0) {
      throw new Error(
        `Wybrane ogłoszenia są już w bazie (${alreadyImported} pominiętych). Odznacz je lub wybierz inne.`,
      );
    }
    if (alreadyImported > 0) {
      throw new Error(
        `Wszystkie sprawdzone ogłoszenia są już w bazie (${alreadyImported} pominiętych). Brak nowych do eksportu.`,
      );
    }
    throw new Error('Nie udało się wyeksportować żadnego ogłoszenia.');
  }

  const kindLabel = keiPropertyKindLabel(propertyKind);
  const txLabel = keiTransactionKindLabel(transactionKind);
  const skippedNote =
    skipped.length > 0 ? ` Pominięto ${skipped.length} (w tym już zaimportowane).` : '';
  const message =
    exported.length === 1
      ? `Utworzono i aktywowano ofertę #${exported[0].offerId} (${kindLabel}, ${txLabel}) dla użytkownika #${targetUserId} (${agentCommissionPercent}% prowizji).${skippedNote}`
      : `Utworzono i aktywowano ${exported.length} ofert (${kindLabel}, ${txLabel}) dla użytkownika #${targetUserId} (${agentCommissionPercent}% prowizji).${skippedNote}`;

  emit?.({
    type: 'batch_done',
    message,
    exportedCount: exported.length,
    skippedCount: skipped.length,
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
