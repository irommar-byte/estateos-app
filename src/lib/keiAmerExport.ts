import { prisma } from '@/lib/prisma';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '@/lib/otodomImport';
import { createOfferFromOtodomDraft, findExistingImportedOffer, findExistingImportedOfferByPortalUrl } from '@/lib/otodomImportCreate';
import { activateOfferPublication } from '@/lib/offerPublication';
import {
  findWarsawPortalListings,
  ensureKeiAmerSession,
  keiPropertyKindLabel,
  type KeiListingRow,
  type KeiPropertyKind,
} from '@/lib/keiAmerClient';

const DEFAULT_EXPORT_USER_ID = 55;
const DEFAULT_COMMISSION_PERCENT = 2;
const DEFAULT_EXPORT_COUNT = 1;
const MAX_EXPORT_COUNT = 25;
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

export async function exportKeiListingsToEstateOS(options?: {
  targetUserId?: number;
  agentCommissionPercent?: number;
  count?: number;
  propertyKind?: KeiPropertyKind;
  selections?: Array<{ keiId?: string; portalUrl: string }>;
}): Promise<{
  ok: true;
  exported: KeiExportItemResult[];
  skipped: KeiExportSkippedItem[];
  targetUserId: number;
  agentCommissionPercent: number;
  propertyKind: KeiPropertyKind;
  offerId: number | null;
  portalUrl: string;
  publicUrl: string;
  editUrl: string;
  message: string;
}> {
  const session = await ensureKeiAmerSession(true);
  if (!session.ok) {
    throw new Error(session.message);
  }

  const targetUserId = resolveExportUserId(options?.targetUserId);
  const agentCommissionPercent = resolveCommissionPercent(options?.agentCommissionPercent);
  const propertyKind = resolvePropertyKind(options?.propertyKind);

  const rawSelections = Array.isArray(options?.selections) ? options.selections : [];
  const selections = rawSelections
    .map((row) => ({
      keiId: String(row?.keiId || '').trim(),
      portalUrl: String(row?.portalUrl || '').trim(),
    }))
    .filter((row) => row.portalUrl);

  const count = selections.length > 0 ? selections.length : resolveExportCount(options?.count);

  const owner = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true },
  });
  if (!owner) {
    throw new Error(`Użytkownik docelowy #${targetUserId} nie istnieje.`);
  }

  type ExportTarget = { keiListingId: string; portalUrl: string };

  let exportTargets: ExportTarget[] = [];

  if (selections.length > 0) {
    exportTargets = selections.map((row) => ({
      keiListingId: row.keiId || row.portalUrl,
      portalUrl: row.portalUrl,
    }));
  } else {
    const listings = await findWarsawPortalListings({
      propertyKind,
      maxResults: Math.max(count * 5, 30),
      maxPages: 12,
    });

    if (listings.length === 0) {
      throw new Error(
        `Nie znaleziono ogłoszeń (${keiPropertyKindLabel(propertyKind)}) w Warszawie z linkiem OtoDom / OLX / Nieruchomosci-Online.`,
      );
    }

    exportTargets = listings
      .map((listing) => ({
        keiListingId: listing.id,
        portalUrl: String(listing.www || '').trim(),
      }))
      .filter((row) => row.portalUrl);
  }

  if (exportTargets.length === 0) {
    throw new Error('Brak ogłoszeń do eksportu.');
  }

  const exported: KeiExportItemResult[] = [];
  const skipped: KeiExportSkippedItem[] = [];

  for (const target of exportTargets) {
    if (selections.length === 0 && exported.length >= count) break;

    const portalUrl = target.portalUrl;
    const keiListingId = target.keiListingId;
    if (!portalUrl || !isSupportedImportOfferUrl(portalUrl)) {
      skipped.push({
        keiListingId,
        portalUrl: portalUrl || '(pusty)',
        reason: 'Nieobsługiwany link portalu.',
      });
      continue;
    }

    try {
      const existingByUrl = await findExistingImportedOfferByPortalUrl(portalUrl);
      if (existingByUrl) {
        skipped.push({
          keiListingId,
          portalUrl,
          reason: 'Już zaimportowane (URL) — pominięto.',
          existingOfferId: existingByUrl.id,
        });
        continue;
      }

      const draft = await importOfferFromUrl(portalUrl);
      const existing = await findExistingImportedOffer(draft);
      if (existing) {
        skipped.push({
          keiListingId,
          portalUrl,
          reason: 'Już zaimportowane — pominięto.',
          existingOfferId: existing.id,
        });
        continue;
      }

      const created = await createOfferFromOtodomDraft(draft, targetUserId, undefined, {
        agentCommissionPercent,
        maxImportImages: KEI_MAX_IMPORT_IMAGES,
      });

      if (!created.ok) {
        skipped.push({
          keiListingId,
          portalUrl,
          reason: created.message || 'Import nie powiódł się.',
          existingOfferId: created.existingOfferId,
        });
        continue;
      }

      await activateOfferPublication({
        userId: targetUserId,
        offerId: created.offerId,
        kind: 'PLUS_CREDIT',
        skipEntitlementConsume: true,
      });

      exported.push({
        keiListingId,
        portalUrl,
        offerId: created.offerId,
        publicUrl: created.publicUrl,
        editUrl: created.editUrl,
      });
    } catch (error) {
      skipped.push({
        keiListingId,
        portalUrl,
        reason: error instanceof Error ? error.message : 'Nieznany błąd importu.',
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
  const skippedNote =
    skipped.length > 0 ? ` Pominięto ${skipped.length} (w tym już zaimportowane).` : '';
  const message =
    exported.length === 1
      ? `Utworzono i aktywowano ofertę #${exported[0].offerId} (${kindLabel}) dla użytkownika #${targetUserId} (${agentCommissionPercent}% prowizji).${skippedNote}`
      : `Utworzono i aktywowano ${exported.length} ofert (${kindLabel}) dla użytkownika #${targetUserId} (${agentCommissionPercent}% prowizji).${skippedNote}`;

  const first = exported[0];

  return {
    ok: true,
    exported,
    skipped,
    targetUserId,
    agentCommissionPercent,
    propertyKind,
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
