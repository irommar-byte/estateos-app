import { findImportedOfferIdsByPortalUrls } from '@/lib/importDuplicateGuard';
import { districtMatches } from '@/lib/keiAmerDistrict';
import type { KeiAutoImportSettings } from '@/lib/keiAutoImportShared';
import {
  ensureKeiAmerSession,
  fetchKeiListingsPage,
  findWarsawPortalListingsPaged,
  isWarsawListing,
  parseKeiListingDate,
  parseKeiNumeric,
  type KeiListingRow,
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
import { buildKeiImportContext } from '@/lib/keiAmerListingExtras';
import { getKeiListingDispositions, markKeiListingFailed, normalizeKeiPortalUrl } from '@/lib/keiAmerListingState';
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
  phone: string | null;
  district: string | null;
  street: string | null;
  rooms: number | null;
  listedAt: string | null;
  directOwner: boolean;
  /** Ostatnia próba importu się nie udała — kolejna dopiero po przerwie. */
  coolingDown: boolean;
  lastFailReason: string | null;
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

  const [dispositions, importedByUrl] = await Promise.all([
    getKeiListingDispositions(portalUrls),
    findImportedOfferIdsByPortalUrls(portalUrls),
  ]);
  const verifications = options?.verifyPortal
    ? await verifyPortalListingsActive(portalUrls, 4)
    : null;

  for (const row of rows) {
    if (!rowMatchesKeiSearchFilters(row, { ...filters, propertyKind, transactionKind })) continue;

    const portalUrl = normalizeKeiPortalUrl(String(row.www || '').trim());
    if (!portalUrl || !isSupportedKeiPortalUrl(portalUrl)) continue;

    const existingId = importedByUrl.get(portalUrl) ?? null;
    const disposition = dispositions.get(portalUrl);
    const alreadyImported = Boolean(existingId) || Boolean(disposition?.importedOfferId);
    const outreachSent = Boolean(disposition?.outreachSent);
    const existingOfferId = existingId ?? disposition?.importedOfferId ?? null;
    const host = portalHostFromUrl(portalUrl);
    const rowTx = keiTransactionKindFromRow(row);
    const verify = verifications?.get(portalUrl) ?? null;
    const portalActive = disposition?.ignored ? false : verify ? verify.active : null;
    const portalCheckReason = disposition?.ignored ? 'Oznaczone jako pomijane.' : verify?.reason ?? null;

    let blockedReason: KeiPreviewListing['blockedReason'] = null;
    if (alreadyImported) blockedReason = 'imported';
    else if (outreachSent) blockedReason = 'outreach';
    else if (portalActive === false) blockedReason = 'inactive';

    const kei = buildKeiImportContext(row);
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
      phone: kei?.phone || null,
      district: kei?.district || null,
      street: kei?.street || null,
      rooms: kei?.rooms || null,
      listedAt: kei?.listedAt || row.data || null,
      directOwner: Boolean(kei?.directOwner),
      coolingDown: Boolean(disposition?.coolingDown),
      lastFailReason: disposition?.lastFailReason ?? null,
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

export type KeiImportSelection = {
  keiId: string;
  portalUrl: string;
  address?: string;
  phone?: string;
  district?: string;
  street?: string;
  rooms?: number | null;
  listedAt?: string;
  directOwner?: boolean;
};

function portalIdFromUrl(url: string): 'otodom' | 'olx' | 'nieruchomosci-online' | null {
  const host = portalHostFromUrl(url);
  if (host.includes('otodom')) return 'otodom';
  if (host.includes('olx')) return 'olx';
  if (host.includes('nieruchomosci-online')) return 'nieruchomosci-online';
  return null;
}

/** Reguły harmonogramu na surowym wierszu KEI — przed jakimkolwiek zapytaniem do portalu. */
export function rowMatchesAutoSettings(row: KeiListingRow, settings: KeiAutoImportSettings, now = Date.now()): boolean {
  const portal = portalIdFromUrl(String(row.www || ''));
  if (!portal || (settings.portals.length && !settings.portals.includes(portal))) return false;
  if (settings.districts.length && !settings.districts.some((district) => districtMatches(district, row.adres))) {
    return false;
  }
  const price = parseKeiNumeric(row.cena);
  if (settings.minPrice != null && (price == null || price < settings.minPrice)) return false;
  if (settings.maxPrice != null && (price == null || price > settings.maxPrice)) return false;
  const area = parseKeiNumeric(row.pow);
  if (settings.minArea != null && (area == null || area < settings.minArea)) return false;
  if (settings.maxArea != null && (area == null || area > settings.maxArea)) return false;
  const kei = buildKeiImportContext(row);
  if (settings.minRooms != null && (kei?.rooms == null || kei.rooms < settings.minRooms)) return false;
  if (settings.maxRooms != null && (kei?.rooms == null || kei.rooms > settings.maxRooms)) return false;
  if (settings.directOwnerOnly && !kei?.directOwner) return false;
  if (settings.requirePhone && !kei?.phone) return false;
  if (settings.maxAgeHours != null) {
    const listed = parseKeiListingDate(row.data);
    // Data KEI ma dokładność do dnia — liczymy od końca tego dnia, żeby nie wyciąć dzisiejszych.
    if (!listed) return false;
    const endOfDay = new Date(listed);
    endOfDay.setHours(23, 59, 59, 999);
    if (now - endOfDay.getTime() > settings.maxAgeHours * 3_600_000) return false;
  }
  return true;
}

/**
 * Kandydaci do automatycznego cyklu: jeden liniowy przebieg po najnowszych stronach KEI,
 * filtry z ustawień, hurtowe sprawdzenie duplikatów/zaproszeń/przerw po błędach,
 * a na końcu weryfikacja, czy ogłoszenie nadal wisi na portalu.
 */
export async function pickNewestKeiListingsForImport(options: {
  propertyKind: KeiPropertyKind;
  transactionKind: KeiTransactionKind;
  count: number;
  settings?: KeiAutoImportSettings;
}): Promise<KeiImportSelection[]> {
  const session = await ensureKeiAmerSession();
  if (!session.ok) throw new Error(session.message);

  const publishCount = Math.max(1, Math.min(25, Math.floor(options.count) || 1));
  const poolSize = Math.min(40, Math.max(publishCount * 4, publishCount + 5));
  const settings = options.settings;
  const okres = settings?.maxAgeHours != null && settings.maxAgeHours <= 24 * 7 ? '1' : '0';
  const limit = 50;
  const maxPages = 12;
  const seen = new Set<string>();
  const candidates: Array<{ row: KeiListingRow; portalUrl: string }> = [];

  for (let page = 0; page < maxPages && candidates.length < poolSize * 2; page += 1) {
    const { rows } = await fetchKeiListingsPage({
      start: page * limit,
      limit,
      sort: 'data',
      dir: 'DESC',
      propertyKind: options.propertyKind,
      transactionKind: options.transactionKind,
      okres,
    });
    const pageRows: Array<{ row: KeiListingRow; portalUrl: string }> = [];
    let tooOld = 0;
    for (const row of rows) {
      const portalUrl = normalizeKeiPortalUrl(String(row.www || '').trim());
      if (!portalUrl || seen.has(portalUrl) || !isSupportedKeiPortalUrl(portalUrl)) continue;
      seen.add(portalUrl);
      if (!isWarsawListing(row)) continue;
      if (!rowMatchesKeiFilters(row, options.propertyKind, options.transactionKind)) continue;
      if (settings && !rowMatchesAutoSettings(row, settings)) {
        if (settings.maxAgeHours != null) {
          const listed = parseKeiListingDate(row.data);
          if (listed && Date.now() - listed.getTime() > (settings.maxAgeHours + 24) * 3_600_000) tooOld += 1;
        }
        continue;
      }
      pageRows.push({ row, portalUrl });
    }

    if (pageRows.length) {
      const urls = pageRows.map((item) => item.portalUrl);
      const [dispositions, importedByUrl] = await Promise.all([
        getKeiListingDispositions(urls),
        findImportedOfferIdsByPortalUrls(urls),
      ]);
      for (const item of pageRows) {
        const disposition = dispositions.get(item.portalUrl);
        if (importedByUrl.has(item.portalUrl) || disposition?.importedOfferId) continue;
        if (disposition?.outreachSent || disposition?.ignored || disposition?.coolingDown) continue;
        candidates.push(item);
      }
    }
    // Sortujemy od najnowszych — gdy cała strona jest starsza niż limit wieku, dalej będzie tylko starsze.
    if (rows.length < limit || (rows.length > 0 && tooOld >= rows.length * 0.9)) break;
  }

  if (candidates.length === 0) return [];

  const toVerify = candidates.slice(0, poolSize + Math.ceil(poolSize / 2));
  const verifications = await verifyPortalListingsActive(toVerify.map((item) => item.portalUrl), 5);
  const picked: KeiImportSelection[] = [];
  for (const item of toVerify) {
    const verify = verifications.get(item.portalUrl);
    if (verify?.active === false) {
      await markKeiListingFailed({
        portalUrl: item.portalUrl,
        keiListingId: item.row.id,
        reason: verify.reason || 'Ogłoszenie nieaktualne na portalu.',
      }).catch(() => undefined);
      continue;
    }
    const kei = buildKeiImportContext(item.row);
    picked.push({
      keiId: String(item.row.id || ''),
      portalUrl: item.portalUrl,
      address: item.row.adres || undefined,
      phone: kei?.phone || undefined,
      district: kei?.district || undefined,
      street: kei?.street || undefined,
      rooms: kei?.rooms ?? undefined,
      listedAt: kei?.listedAt || item.row.data || undefined,
      directOwner: Boolean(kei?.directOwner),
    });
    if (picked.length >= poolSize) break;
  }
  return picked;
}

// Keep filter helper available for callers that still use the strict pair.
export { rowMatchesKeiFilters, keiPropertyKindFromRow };
