import { prisma } from '@/lib/prisma';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '@/lib/otodomImport';
import { createOfferFromOtodomDraft, findExistingOtodomImportOffer } from '@/lib/otodomImportCreate';
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
  const count = resolveExportCount(options?.count);
  const propertyKind = resolvePropertyKind(options?.propertyKind);

  const owner = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true },
  });
  if (!owner) {
    throw new Error(`Użytkownik docelowy #${targetUserId} nie istnieje.`);
  }

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

  const exported: KeiExportItemResult[] = [];
  const skipped: KeiExportSkippedItem[] = [];

  for (const listing of listings) {
    if (exported.length >= count) break;

    const portalUrl = String(listing.www || '').trim();
    if (!portalUrl || !isSupportedImportOfferUrl(portalUrl)) {
      skipped.push({
        keiListingId: listing.id,
        portalUrl: portalUrl || '(pusty)',
        reason: 'Nieobsługiwany link portalu.',
      });
      continue;
    }

    try {
      const draft = await importOfferFromUrl(portalUrl);
      const existing = await findExistingOtodomImportOffer(draft.source, draft.externalId);
      if (existing) {
        skipped.push({
          keiListingId: listing.id,
          portalUrl,
          reason: 'Już zaimportowane — pominięto.',
          existingOfferId: existing.id,
        });
        continue;
      }

      const created = await createOfferFromOtodomDraft(draft, targetUserId, undefined, {
        agentCommissionPercent,
      });

      if (!created.ok) {
        skipped.push({
          keiListingId: listing.id,
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
        keiListingId: listing.id,
        portalUrl,
        offerId: created.offerId,
        publicUrl: created.publicUrl,
        editUrl: created.editUrl,
      });
    } catch (error) {
      skipped.push({
        keiListingId: listing.id,
        portalUrl,
        reason: error instanceof Error ? error.message : 'Nieznany błąd importu.',
      });
    }
  }

  if (exported.length === 0) {
    const alreadyImported = skipped.filter((item) => item.existingOfferId).length;
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
