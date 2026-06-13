import { findExistingImportedOfferByPortalUrl } from '@/lib/otodomImportCreate';
import {
  ensureKeiAmerSession,
  findWarsawPortalListingsPaged,
  isSupportedKeiPortalUrl,
  keiPropertyKindLabel,
  type KeiPropertyKind,
} from '@/lib/keiAmerClient';

export type KeiPreviewListing = {
  keiId: string;
  date: string;
  address: string;
  price: string;
  area: string;
  portalUrl: string;
  portalHost: string;
  sourceLabel: string;
  alreadyImported: boolean;
  existingOfferId: number | null;
};

function portalHostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function sourceLabelFromHost(host: string): string {
  if (host.includes('otodom')) return 'OtoDom';
  if (host.includes('olx')) return 'OLX';
  if (host.includes('nieruchomosci-online')) return 'Nieruchomosci-Online';
  return host || 'Portal';
}

async function mapRowsToPreviewListings(
  rows: Awaited<ReturnType<typeof findWarsawPortalListingsPaged>>['rows'],
): Promise<KeiPreviewListing[]> {
  const listings: KeiPreviewListing[] = [];

  for (const row of rows) {
    const portalUrl = String(row.www || '').trim();
    if (!portalUrl || !isSupportedKeiPortalUrl(portalUrl)) continue;

    const existing = await findExistingImportedOfferByPortalUrl(portalUrl);
    const host = portalHostFromUrl(portalUrl);
    listings.push({
      keiId: row.id,
      date: row.data || '',
      address: row.adres || '',
      price: row.cena || '',
      area: row.pow || '',
      portalUrl,
      portalHost: host,
      sourceLabel: sourceLabelFromHost(host),
      alreadyImported: Boolean(existing),
      existingOfferId: existing?.id ?? null,
    });
  }

  return listings;
}

export async function previewKeiExportListings(options?: {
  propertyKind?: KeiPropertyKind;
  page?: number;
  pageSize?: number;
  /** Pula do auto-zaznaczenia (strona 1, do 25 pozycji). */
  selectionPool?: boolean;
}): Promise<{
  ok: true;
  propertyKind: KeiPropertyKind;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  listings: KeiPreviewListing[];
  message: string;
}> {
  const session = await ensureKeiAmerSession();
  if (!session.ok) {
    throw new Error(session.message);
  }

  const propertyKind = options?.propertyKind === 'house' ? 'house' : 'apartment';
  const page = options?.selectionPool ? 1 : Math.max(1, Math.floor(options?.page ?? 1));
  const pageSize = options?.selectionPool
    ? 25
    : Math.max(1, Math.min(Math.floor(options?.pageSize ?? 20), 30));

  const paged = await findWarsawPortalListingsPaged({ propertyKind, page, pageSize });
  const listings = await mapRowsToPreviewListings(paged.rows);

  const kindLabel = keiPropertyKindLabel(propertyKind);
  const freshCount = listings.filter((item) => !item.alreadyImported).length;
  const message =
    listings.length === 0
      ? `Brak ogłoszeń (${kindLabel}) na stronie ${page}.`
      : `Strona ${page}: ${listings.length} ogłoszeń (${kindLabel}), ${freshCount} nowych.`;

  return {
    ok: true,
    propertyKind,
    page: paged.page,
    pageSize: paged.pageSize,
    hasNextPage: paged.hasNextPage,
    listings,
    message,
  };
}
