import { prisma } from '@/lib/prisma';
import {
  importOfferFromUrl,
  isSupportedImportOfferUrl,
} from '@/lib/otodomImport';
import {
  createOfferFromOtodomDraft,
  findExistingImportedOffer,
  findExistingImportedOfferByPortalUrl,
} from '@/lib/otodomImportCreate';
import { enrichOtodomImportDraft } from '@/lib/portalImportEnrich';
import { activateOfferPublication } from '@/lib/offerPublication';
import { refreshAgencyClientMatches } from '@/lib/agencyClientMatching';
import { pickIntelligenceOffer, sendIntelligenceOffer } from '@/lib/crm/clientIntelligenceRun';
import {
  isNierOnlineListingUrl,
  listingMatchesClientFilters,
  normalizeNierOnlineListingUrl,
  searchNieruchomosciOnline,
  type NierOnlineSearchFilters,
  type NierOnlineSearchHit,
} from '@/lib/nieruchomosciOnlineSearch';
import { canonicalizeCity, normalizeText } from '@/lib/location/locationCatalog';
import {
  findWarsawPortalListings,
  isSupportedKeiPortalUrl,
  parseKeiNumeric,
  type KeiListingRow,
} from '@/lib/keiAmerClient';
import { normalizeKeiPortalUrl } from '@/lib/keiAmerListingState';

const MAX_IMPORT = 3;
const DEFAULT_IMPORT = 2;
const KEI_FALLBACK_MAX = 16;

export type PortalHuntHit = NierOnlineSearchHit & {
  alreadyImported: boolean;
  existingOfferId: number | null;
};

export type PortalHuntImported = {
  url: string;
  offerId: number;
  title: string;
  reused: boolean;
};

export type PortalHuntSkipped = {
  url: string;
  reason: string;
};

function districtsFromPref(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item || '').trim()).filter(Boolean);
}

function filtersFromBuyerPref(pref: {
  city: string | null;
  districts: unknown;
  propertyType: string | null;
  transactionType: string | null;
  maxPrice: number | null;
  minArea: number | null;
  minYear: number | null;
  requireBalcony: boolean;
  requireGarden: boolean;
  requireElevator: boolean;
  requireParking: boolean;
  requireFurnished: boolean;
}): NierOnlineSearchFilters {
  return {
    city: pref.city || 'Warszawa',
    districts: districtsFromPref(pref.districts),
    propertyType: pref.propertyType || 'FLAT',
    transactionType: pref.transactionType || 'SELL',
    maxPrice: pref.maxPrice,
    minArea: pref.minArea,
    minYear: pref.minYear,
    requireBalcony: pref.requireBalcony,
    requireGarden: pref.requireGarden,
    requireElevator: pref.requireElevator,
    requireParking: pref.requireParking,
    requireFurnished: pref.requireFurnished,
  };
}

function isNierOnlineHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    return host === 'nieruchomosci-online.pl' || host.endsWith('.nieruchomosci-online.pl');
  } catch {
    return false;
  }
}

function keiRowToHit(row: KeiListingRow): NierOnlineSearchHit | null {
  const portalUrl = normalizeKeiPortalUrl(String(row.www || '').trim());
  if (!portalUrl || !isNierOnlineHost(portalUrl) || !isNierOnlineListingUrl(portalUrl)) return null;
  return {
    url: normalizeNierOnlineListingUrl(portalUrl),
    title: String(row.adres || row.tekst || 'Oferta z Nieruchomości-Online').trim(),
    price: parseKeiNumeric(row.cena),
    area: parseKeiNumeric(row.pow),
    rooms: parseKeiNumeric(String(row.typ || row.typ_ || '').match(/(\d+)/)?.[1]),
    street: String(row.adres || '').trim() || null,
    city: 'Warszawa',
    districtHint: String(row.adres || '').trim() || null,
    description: String(row.tekst || row.adres || ''),
    source: 'nieruchomosci-online',
  };
}

async function keiNierOnlineFallback(
  filters: NierOnlineSearchFilters,
  already: Set<string>,
): Promise<NierOnlineSearchHit[]> {
  const city = canonicalizeCity(filters.city) || filters.city;
  if (normalizeText(city) !== 'warszawa') return [];
  const propertyKind = String(filters.propertyType || '').toUpperCase() === 'HOUSE' ? 'house' : 'apartment';
  const transactionKind = String(filters.transactionType || '').toUpperCase() === 'RENT' ? 'rent' : 'sale';
  try {
    const rows = await findWarsawPortalListings({
      propertyKind,
      transactionKind,
      maxResults: KEI_FALLBACK_MAX,
      maxPages: 6,
      search: {
        propertyKind,
        transactionKind,
        district: filters.districts?.[0],
        maxPrice: filters.maxPrice ?? undefined,
        minArea: filters.minArea ?? undefined,
      },
    });
    const extra: NierOnlineSearchHit[] = [];
    for (const row of rows) {
      const hit = keiRowToHit(row);
      if (!hit || already.has(hit.url)) continue;
      if (!listingMatchesClientFilters(hit, filters)) continue;
      extra.push(hit);
    }
    return extra;
  } catch {
    return [];
  }
}

async function decorateHits(hits: NierOnlineSearchHit[]): Promise<PortalHuntHit[]> {
  const out: PortalHuntHit[] = [];
  for (const hit of hits) {
    const existing = await findExistingImportedOfferByPortalUrl(hit.url);
    out.push({
      ...hit,
      alreadyImported: Boolean(existing),
      existingOfferId: existing?.id ?? null,
    });
  }
  return out;
}

async function importOneListing(params: {
  url: string;
  ownerUserId: number;
}): Promise<{ offerId: number; title: string; reused: boolean }> {
  const existingByUrl = await findExistingImportedOfferByPortalUrl(params.url);
  if (existingByUrl) {
    return { offerId: existingByUrl.id, title: existingByUrl.title || params.url, reused: true };
  }

  if (!isSupportedImportOfferUrl(params.url) || !isNierOnlineListingUrl(params.url)) {
    throw new Error('Nieobsługiwany link Nieruchomości-Online.');
  }

  const draft = await enrichOtodomImportDraft(await importOfferFromUrl(params.url));
  const existing = await findExistingImportedOffer(draft);
  if (existing) {
    return { offerId: existing.id, title: existing.title || draft.title, reused: true };
  }

  const created = await createOfferFromOtodomDraft(draft, params.ownerUserId, undefined, {
    maxImportImages: 8,
    skipAutoFloorPlanProbe: true,
    smartAddEnabled: true,
    smartAddAutoApply: true,
  });
  if (!created.ok) {
    if (created.existingOfferId) {
      return {
        offerId: created.existingOfferId,
        title: draft.title,
        reused: true,
      };
    }
    throw new Error(created.message || 'Import nie powiódł się.');
  }

  try {
    await activateOfferPublication({
      userId: params.ownerUserId,
      offerId: created.offerId,
      kind: 'PLUS_CREDIT',
      skipEntitlementConsume: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/PUBLICATION_ALREADY_ACTIVE/i.test(message)) throw error;
  }

  return { offerId: created.offerId, title: created.offer?.title || draft.title, reused: false };
}

export async function huntNieruchomosciOnlineForClient(params: {
  clientId: number;
  agencyUserId: number;
  mode: 'preview' | 'import';
  send?: boolean;
  count?: number;
  urls?: string[];
}): Promise<{
  success: true;
  mode: 'preview' | 'import';
  portal: 'nieruchomosci-online';
  searchUrl: string;
  scanned: number;
  fallbackUsed: boolean;
  criteria: NierOnlineSearchFilters;
  hits: PortalHuntHit[];
  imported: PortalHuntImported[];
  skipped: PortalHuntSkipped[];
  sent: boolean;
  emailSent?: boolean;
  pick: Awaited<ReturnType<typeof pickIntelligenceOffer>>['pick'] | null;
  message: string;
}> {
  const count = Math.max(1, Math.min(Math.floor(params.count || DEFAULT_IMPORT), MAX_IMPORT));
  const client = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, agencyUserId: params.agencyUserId },
    include: { buyerPreference: true },
  });
  if (!client) {
    throw new Error('Nie znaleziono klienta.');
  }
  if (!client.buyerPreference) {
    throw new Error('Najpierw zapisz ankietę radaru tego klienta — po niej szukam na Nieruchomości-Online.');
  }

  const filters = filtersFromBuyerPref(client.buyerPreference);
  const selectedUrls = (params.urls || [])
    .map((raw) => String(raw || '').trim())
    .filter((url) => isNierOnlineListingUrl(url))
    .map((url) => normalizeNierOnlineListingUrl(url));

  const searched = await searchNieruchomosciOnline(filters, { pages: 2, limit: 24 });
  const seen = new Set(searched.hits.map((hit) => hit.url));
  const extra =
    searched.hits.length < 8 ? await keiNierOnlineFallback(filters, seen) : [];
  const mergedHits = [...searched.hits, ...extra];
  const hits = await decorateHits(mergedHits);

  if (params.mode === 'preview') {
    const message = hits.length
      ? `Znalazłem ${hits.length} ogłoszeń na Nieruchomości-Online pasujących do ankiety (przeszukane ${searched.scanned + extra.length}).`
      : 'Brak ogłoszeń na Nieruchomości-Online dla tej ankiety. Zmień budżet, dzielnice albo metraż.';
    return {
      success: true,
      mode: 'preview',
      portal: 'nieruchomosci-online',
      searchUrl: searched.searchUrl,
      scanned: searched.scanned + extra.length,
      fallbackUsed: searched.fallbackUsed || extra.length > 0,
      criteria: filters,
      hits,
      imported: [],
      skipped: [],
      sent: false,
      pick: null,
      message,
    };
  }

  const queue = selectedUrls.length
    ? selectedUrls
    : hits.filter((hit) => !hit.alreadyImported).map((hit) => hit.url);

  const imported: PortalHuntImported[] = [];
  const skipped: PortalHuntSkipped[] = [];
  const used = new Set<string>();
  const target = selectedUrls.length ? Math.min(selectedUrls.length, MAX_IMPORT) : count;

  for (const url of queue) {
    const fresh = imported.filter((item) => !item.reused).length;
    if (fresh >= target) break;
    if (used.has(url)) continue;
    used.add(url);
    try {
      const result = await importOneListing({ url, ownerUserId: params.agencyUserId });
      imported.push({ url, offerId: result.offerId, title: result.title, reused: result.reused });
    } catch (error) {
      skipped.push({
        url,
        reason: error instanceof Error ? error.message : 'Import nie powiódł się.',
      });
    }
  }

  if (imported.length === 0 && hits.some((hit) => hit.existingOfferId)) {
    for (const hit of hits) {
      if (!hit.existingOfferId) continue;
      imported.push({
        url: hit.url,
        offerId: hit.existingOfferId,
        title: hit.title,
        reused: true,
      });
      if (imported.length >= count) break;
    }
  }

  await refreshAgencyClientMatches(params.clientId);

  let sent = false;
  let emailSent: boolean | undefined;
  let pick: Awaited<ReturnType<typeof pickIntelligenceOffer>>['pick'] | null = null;

  if (params.send !== false) {
    const result = await sendIntelligenceOffer({ clientId: params.clientId, force: true });
    sent = result.sent;
    emailSent = result.emailSent;
    pick = result.pick;
  } else {
    const preview = await pickIntelligenceOffer(params.clientId, { preview: true });
    pick = preview.pick;
  }

  await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      kind: 'PORTAL_HUNT',
      title: 'Nieruchomości-Online → mózg',
      body: [
        `Szukane: ${filters.city}${filters.districts?.length ? ` · ${filters.districts.join(', ')}` : ''}`,
        filters.maxPrice ? `Budżet do ${filters.maxPrice.toLocaleString('pl-PL')} zł` : null,
        `Import: ${imported.length} (nowe ${imported.filter((item) => !item.reused).length})`,
        sent ? 'Wysłane klientowi przez Intelligence.' : pick?.skipReason || 'Bez wysyłki.',
      ]
        .filter(Boolean)
        .join('\n'),
      offerId: imported[0]?.offerId ?? pick?.offerId ?? null,
      metadata: {
        portal: 'nieruchomosci-online',
        searchUrl: searched.searchUrl,
        imported,
        skipped,
        sent,
      },
    },
  });

  const fresh = imported.filter((item) => !item.reused).length;
  const message = sent
    ? `Zaimportowano ${fresh} ${fresh === 1 ? 'ofertę' : 'ofert'} z Nieruchomości-Online i wysłano klientowi.`
    : imported.length
      ? `Zaimportowano ${fresh} ${fresh === 1 ? 'ofertę' : 'ofert'} z Nieruchomości-Online. ${pick?.skipReason || 'Kolejka Intelligence zaktualizowana.'}`
      : skipped[0]?.reason || 'Nie udało się zaimportować ogłoszeń z Nieruchomości-Online.';

  return {
    success: true,
    mode: 'import',
    portal: 'nieruchomosci-online',
    searchUrl: searched.searchUrl,
    scanned: searched.scanned + extra.length,
    fallbackUsed: searched.fallbackUsed || extra.length > 0,
    criteria: filters,
    hits,
    imported,
    skipped,
    sent,
    emailSent,
    pick,
    message,
  };
}
