import { prisma } from '@/lib/prisma';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '@/lib/otodomImport';
import { createOfferFromOtodomDraft } from '@/lib/otodomImportCreate';
import { activateOfferPublication } from '@/lib/offerPublication';
import { findLatestWarsawPortalListing, ensureKeiAmerSession, type KeiListingRow } from '@/lib/keiAmerClient';

const DEFAULT_EXPORT_USER_ID = 55;
const DEFAULT_COMMISSION_PERCENT = 2;

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

export async function exportLatestKeiListingToEstateOS(options?: {
  targetUserId?: number;
  agentCommissionPercent?: number;
}): Promise<{
  ok: true;
  keiListing: KeiListingRow;
  portalUrl: string;
  offerId: number;
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

  const owner = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true },
  });
  if (!owner) {
    throw new Error(`Użytkownik docelowy #${targetUserId} nie istnieje.`);
  }

  const listing = await findLatestWarsawPortalListing();
  if (!listing) {
    throw new Error('Nie znaleziono najnowszego ogłoszenia w Warszawie z linkiem OtoDom / OLX / Nieruchomosci-Online.');
  }

  const portalUrl = String(listing.www || '').trim();
  if (!portalUrl || !isSupportedImportOfferUrl(portalUrl)) {
    throw new Error(`Link portalu jest nieobsługiwany: ${portalUrl || '(pusty)'}`);
  }

  const draft = await importOfferFromUrl(portalUrl);
  const created = await createOfferFromOtodomDraft(draft, targetUserId, undefined, {
    agentCommissionPercent,
  });

  if (!created.ok) {
    throw new Error(created.message || 'Import nie powiódł się.');
  }

  await activateOfferPublication({
    userId: targetUserId,
    offerId: created.offerId,
    kind: 'PLUS_CREDIT',
    skipEntitlementConsume: true,
  });

  return {
    ok: true,
    keiListing: listing,
    portalUrl,
    offerId: created.offerId,
    publicUrl: created.publicUrl,
    editUrl: created.editUrl,
    message: `Utworzono i aktywowano ofertę #${created.offerId} dla użytkownika #${targetUserId} (${agentCommissionPercent}% prowizji).`,
  };
}
