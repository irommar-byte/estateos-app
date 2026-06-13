import { findExistingImportedOfferByPortalUrl } from '@/lib/otodomImportCreate';
import {
  ensureKeiAmerSession,
  findWarsawPortalListings,
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
  willExport: boolean;
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

export async function previewKeiExportListings(options?: {
  propertyKind?: KeiPropertyKind;
  count?: number;
}): Promise<{
  ok: true;
  propertyKind: KeiPropertyKind;
  count: number;
  listings: KeiPreviewListing[];
  message: string;
}> {
  const session = await ensureKeiAmerSession();
  if (!session.ok) {
    throw new Error(session.message);
  }

  const propertyKind = options?.propertyKind === 'house' ? 'house' : 'apartment';
  const count = Math.max(1, Math.min(Number(options?.count) || 10, 30));

  const rows = await findWarsawPortalListings({
    propertyKind,
    maxResults: Math.max(count * 4, 20),
    maxPages: 10,
  });

  const listings: KeiPreviewListing[] = [];
  let exportSlots = count;

  for (const row of rows) {
    const portalUrl = String(row.www || '').trim();
    if (!portalUrl || !isSupportedKeiPortalUrl(portalUrl)) continue;

    const existing = await findExistingImportedOfferByPortalUrl(portalUrl);
    const alreadyImported = Boolean(existing);
    const willExport = !alreadyImported && exportSlots > 0;
    if (willExport) exportSlots -= 1;

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
      alreadyImported,
      existingOfferId: existing?.id ?? null,
      willExport,
    });

    if (listings.length >= count + 10) break;
  }

  const kindLabel = keiPropertyKindLabel(propertyKind);
  const freshCount = listings.filter((item) => !item.alreadyImported).length;
  const message =
    listings.length === 0
      ? `Brak ogłoszeń (${kindLabel}) w Warszawie z obsługiwanym linkiem portalu.`
      : `Podgląd ${listings.length} ogłoszeń (${kindLabel}). ${freshCount} nowych do eksportu.`;

  return {
    ok: true,
    propertyKind,
    count,
    listings: listings.slice(0, count + 10),
    message,
  };
}
