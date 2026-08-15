import { findExistingImportedOfferByPortalUrl } from '@/lib/otodomImportCreate';
import {
  ensureKeiAmerSession,
  findWarsawPortalListingsPaged,
  isSupportedKeiPortalUrl,
  keiPropertyKindFromRow,
  keiPropertyKindLabel,
  keiTransactionKindFromRow,
  keiTransactionKindLabel,
  rowMatchesKeiFilters,
  rowMatchesKeiSearchFilters,
  type KeiListingSearchFilters,
  type KeiPropertyKind,
  type KeiTransactionKind,
} from '@/lib/keiAmerClient';
import { getKeiListingDispositions, normalizeKeiPortalUrl } from '@/lib/keiAmerListingState';
import { verifyPortalListingsActive } from '@/lib/keiAmerPortalVerify';

export type KeiPreviewListing = {
  keiId: string;
  date: string;
  address: string;
  price: string;
  area: string;
  portalUrl: string;
  portalHost: string;
  sourceLabel: string;
  transactionKind: KeiTransactionKind;
  transactionLabel: string;
  alreadyImported: boolean;
  existingOfferId: number | null;
  outreachSent: boolean;
  outreachSentAt: string | null;
  blockedReason: 'imported' | 'outreach' | 'inactive' | null;
  /** null = not verified yet; true/false after portal check */
  portalActive: boolean | null;
  portalCheckReason: string | null;
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

function parseOptionalNumber(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function parseKeiPreviewSearchParams(source: {
  get(name: string): string | null;
}): KeiListingSearchFilters {
  const district = String(source.get('district') || '').trim();
  const dateFrom = String(source.get('dateFrom') || '').trim();
  const dateTo = String(source.get('dateTo') || '').trim();
  return {
    propertyKind: source.get('propertyKind') === 'house' ? 'house' : 'apartment',
    transactionKind: source.get('transactionKind') === 'rent' ? 'rent' : 'sale',
    district: district || undefined,
    minPrice: parseOptionalNumber(source.get('minPrice')),
    maxPrice: parseOptionalNumber(source.get('maxPrice')),
    minArea: parseOptionalNumber(source.get('minArea')),
    maxArea: parseOptionalNumber(source.get('maxArea')),
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    okres: source.get('mode') === 'search' ? '0' : undefined,
  };
}

async function mapRowsToPreviewListings(
  rows: Awaited<ReturnType<typeof findWarsawPortalListingsPaged>>['rows'],
  filters: KeiListingSearchFilters,
  options?: { verifyPortal?: boolean },
): Promise<KeiPreviewListing[]> {
  const listings: KeiPreviewListing[] = [];
  const portalUrls: string[] = [];
  const propertyKind = filters.propertyKind ?? 'apartment';
  const transactionKind = filters.transactionKind ?? 'sale';

  for (const row of rows) {
    if (!rowMatchesKeiSearchFilters(row, { ...filters, propertyKind, transactionKind })) continue;
    const portalUrl = normalizeKeiPortalUrl(String(row.www || '').trim());
    if (!portalUrl || !isSupportedKeiPortalUrl(portalUrl)) continue;
    portalUrls.push(portalUrl);
  }

  const dispositions = await getKeiListingDispositions(portalUrls);
  const verifications = options?.verifyPortal
    ? await verifyPortalListingsActive(portalUrls, 3)
    : null;

  for (const row of rows) {
    if (!rowMatchesKeiSearchFilters(row, { ...filters, propertyKind, transactionKind })) continue;

    const portalUrl = normalizeKeiPortalUrl(String(row.www || '').trim());
    if (!portalUrl || !isSupportedKeiPortalUrl(portalUrl)) continue;

    const existing = await findExistingImportedOfferByPortalUrl(portalUrl);
    const disposition = dispositions.get(portalUrl);
    const alreadyImported = Boolean(existing) || Boolean(disposition?.importedOfferId);
    const outreachSent = Boolean(disposition?.outreachSent);
    const existingOfferId = existing?.id ?? disposition?.importedOfferId ?? null;
    const host = portalHostFromUrl(portalUrl);
    const rowTx = keiTransactionKindFromRow(row);
    const verify = verifications?.get(portalUrl) ?? null;
    const portalActive = verify ? verify.active : null;
    const portalCheckReason = verify?.reason ?? null;

    let blockedReason: KeiPreviewListing['blockedReason'] = null;
    if (alreadyImported) blockedReason = 'imported';
    else if (outreachSent) blockedReason = 'outreach';
    else if (portalActive === false) blockedReason = 'inactive';

    listings.push({
      keiId: row.id,
      date: row.data || '',
      address: row.adres || '',
      price: row.cena || '',
      area: row.pow || '',
      portalUrl,
      portalHost: host,
      sourceLabel: sourceLabelFromHost(host),
      transactionKind: rowTx,
      transactionLabel: keiTransactionKindLabel(rowTx),
      alreadyImported,
      existingOfferId,
      outreachSent,
      outreachSentAt: disposition?.outreachSentAt ?? null,
      blockedReason,
      portalActive,
      portalCheckReason,
    });
  }

  return listings;
}

export async function previewKeiExportListings(options?: {
  propertyKind?: KeiPropertyKind;
  transactionKind?: KeiTransactionKind;
  page?: number;
  pageSize?: number;
  /** Pula do auto-zaznaczenia (strona 1, do 25 pozycji). */
  selectionPool?: boolean;
  /** Tryb wyszukiwania z filtrami (także starsze oferty). */
  search?: KeiListingSearchFilters;
  /** Po filtrach — sprawdź czy link na portalu źródłowym jest jeszcze aktywny. */
  verifyPortal?: boolean;
  mode?: 'feed' | 'search';
}): Promise<{
  ok: true;
  mode: 'feed' | 'search';
  propertyKind: KeiPropertyKind;
  transactionKind: KeiTransactionKind;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  listings: KeiPreviewListing[];
  message: string;
  search: KeiListingSearchFilters;
  verified: boolean;
}> {
  const session = await ensureKeiAmerSession();
  if (!session.ok) {
    throw new Error(session.message);
  }

  const propertyKind = options?.propertyKind === 'house' ? 'house' : 'apartment';
  const transactionKind = options?.transactionKind === 'rent' ? 'rent' : 'sale';
  const mode = options?.mode === 'search' || options?.search ? 'search' : 'feed';
  const page = options?.selectionPool ? 1 : Math.max(1, Math.floor(options?.page ?? 1));
  const pageSize = options?.selectionPool
    ? 25
    : Math.max(1, Math.min(Math.floor(options?.pageSize ?? 20), 30));

  const search: KeiListingSearchFilters = {
    propertyKind,
    transactionKind,
    district: options?.search?.district,
    minPrice: options?.search?.minPrice,
    maxPrice: options?.search?.maxPrice,
    minArea: options?.search?.minArea,
    maxArea: options?.search?.maxArea,
    dateFrom: options?.search?.dateFrom,
    dateTo: options?.search?.dateTo,
    okres: mode === 'search' ? '0' : '1',
  };

  const paged = await findWarsawPortalListingsPaged({
    propertyKind,
    transactionKind,
    page,
    pageSize,
    search: mode === 'search' ? search : { propertyKind, transactionKind },
  });

  const verifyPortal = Boolean(options?.verifyPortal ?? mode === 'search');
  const listings = await mapRowsToPreviewListings(paged.rows, search, { verifyPortal });

  const kindLabel = keiPropertyKindLabel(propertyKind);
  const txLabel = keiTransactionKindLabel(transactionKind);
  const freshCount = listings.filter((item) => !item.blockedReason).length;
  const inactiveCount = listings.filter((item) => item.blockedReason === 'inactive').length;
  const message =
    listings.length === 0
      ? mode === 'search'
        ? `Brak ogłoszeń spełniających kryteria (${kindLabel}, ${txLabel}).`
        : `Brak ogłoszeń (${kindLabel}, ${txLabel}) na stronie ${page}.`
      : mode === 'search'
        ? `Wyszukiwanie: ${listings.length} trafień, ${freshCount} gotowych do importu` +
          (inactiveCount ? `, ${inactiveCount} nieaktualnych na portalu` : '') +
          '.'
        : `Strona ${page}: ${listings.length} ogłoszeń (${kindLabel}, ${txLabel}), ${freshCount} nowych.`;

  return {
    ok: true,
    mode,
    propertyKind,
    transactionKind,
    page: paged.page,
    pageSize: paged.pageSize,
    hasNextPage: paged.hasNextPage,
    listings,
    message,
    search,
    verified: verifyPortal,
  };
}

// Keep filter helper available for callers that still use the strict pair.
export { rowMatchesKeiFilters, keiPropertyKindFromRow };
