import { prisma } from '@/lib/prisma';
import { ensureOfferPrivateNoteTable } from '@/lib/offerPrivateNotes';
import { shapeOfferPrivateNoteView } from '@/lib/offerPrivateNoteView';
import { absolutizeMediaUrl } from '@/lib/offerShareLanding';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { importPortalBadge, importPortalLabel, type ImportPortalBadge } from '@/lib/crm/importPortalBadge';

export type ShowingKind = 'own' | 'own_import' | 'external_import' | 'other_agent';

export type ShowingListingAgent = {
  userId: number;
  name: string | null;
  companyName: string | null;
  phone: string | null;
  email: string | null;
};

export type ShowingCard = {
  kind: ShowingKind;
  kindLabel: string;
  offerId: number;
  title: string;
  city: string | null;
  street: string | null;
  imageUrl: string | null;
  badge: ImportPortalBadge | null;
  sourceUrl: string | null;
  sourcePhone: string | null;
  sourceAgencyName: string | null;
  listingAgent: ShowingListingAgent | null;
  sellerClientId: number | null;
  canEmailSeller: boolean;
  canCallSource: boolean;
  canRequestListingShowing: boolean;
};

type ImportHint = {
  source: string | null;
  url: string | null;
  phone: string | null;
  agencyName: string | null;
  badge: ImportPortalBadge | null;
};

export function classifyShowingKind(input: {
  offerUserId: number;
  agencyUserId: number;
  hasImport: boolean;
}): ShowingKind {
  const own = input.offerUserId === input.agencyUserId;
  if (own) return input.hasImport ? 'own_import' : 'own';
  return input.hasImport ? 'external_import' : 'other_agent';
}

export function showingKindLabel(kind: ShowingKind): string {
  if (kind === 'own_import' || kind === 'external_import') return 'Oferta z importu';
  if (kind === 'other_agent') return 'Oferta innego agenta';
  return 'Twoja oferta';
}

export function showingStatusLabel(input: {
  kind: ShowingKind;
  listingRequestSent?: boolean;
  presentationStatus?: 'pending' | 'confirmed' | null;
  held?: boolean;
}): string {
  if (input.held) return 'Odbyta';
  if (input.kind === 'other_agent') {
    if (input.presentationStatus === 'confirmed') return 'Termin uzgodniony';
    if (input.listingRequestSent || input.presentationStatus === 'pending') return 'Wysłano prośbę';
    return 'Do umówienia';
  }
  if (input.kind === 'own_import' || input.kind === 'external_import') {
    if (input.presentationStatus === 'confirmed') return 'Potwierdzona';
    if (input.presentationStatus === 'pending') return 'Termin u kupującego';
    if (input.listingRequestSent) return 'Kontakt ze źródłem';
    return 'Kontakt ze źródłem';
  }
  if (input.presentationStatus === 'confirmed') return 'Potwierdzona';
  if (input.presentationStatus === 'pending') return 'Termin wysłany';
  return 'Do umówienia';
}

export function parseStartsAtList(raw: unknown, fallback?: unknown): Date[] {
  const items = Array.isArray(raw) ? raw : raw != null && String(raw).trim() ? [raw] : [];
  if (!items.length && fallback != null) {
    if (Array.isArray(fallback)) items.push(...fallback);
    else items.push(fallback);
  }
  const seen = new Set<number>();
  const dates: Date[] = [];
  for (const item of items) {
    const value = typeof item === 'string' ? item.trim() : String(item || '').trim();
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.getTime();
    if (seen.has(key)) continue;
    seen.add(key);
    dates.push(date);
    if (dates.length >= 3) break;
  }
  dates.sort((a, b) => a.getTime() - b.getTime());
  return dates;
}

function hasImportHint(hint: ImportHint | null): boolean {
  if (!hint) return false;
  return Boolean(hint.source || hint.url || hint.phone || hint.badge);
}

export async function listShowingCards(
  offerIds: Array<number | null | undefined>,
  agencyUserId: number,
): Promise<Map<number, ShowingCard>> {
  const ids = [...new Set(offerIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  const map = new Map<number, ShowingCard>();
  if (!ids.length) return map;

  await ensureOfferPrivateNoteTable();
  const placeholders = ids.map(() => '?').join(',');
  const [offers, importRows, sellers] = await Promise.all([
    prisma.offer.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        userId: true,
        title: true,
        city: true,
        street: true,
        description: true,
        images: true,
        user: {
          select: {
            id: true,
            name: true,
            companyName: true,
            phone: true,
            officePhone: true,
            email: true,
          },
        },
      },
    }),
    prisma.$queryRawUnsafe<
      Array<{
        offerId: number;
        importSource: string | null;
        importExternalUrl: string | null;
        importSnapshotJson: string | null;
      }>
    >(
      `
        SELECT offerId, importSource, importExternalUrl, importSnapshotJson
        FROM OfferPrivateNote
        WHERE offerId IN (${placeholders})
          AND (
            (importSource IS NOT NULL AND TRIM(importSource) <> '')
            OR (importExternalUrl IS NOT NULL AND TRIM(importExternalUrl) <> '')
            OR (importSnapshotJson IS NOT NULL AND TRIM(importSnapshotJson) <> '')
          )
      `,
      ...ids,
    ),
    prisma.agencyClient.findMany({
      where: {
        agencyUserId,
        type: 'SELLER',
        status: 'ACTIVE',
        linkedOfferId: { in: ids },
      },
      select: { id: true, linkedOfferId: true },
    }),
  ]);

  const importByOffer = new Map<number, ImportHint>();
  for (const row of importRows) {
    const offerId = Number(row.offerId);
    const view = shapeOfferPrivateNoteView(row.importSnapshotJson);
    const url = String(row.importExternalUrl || '').trim() || null;
    const hint: ImportHint = {
      source: String(row.importSource || '').trim() || null,
      url,
      phone: view.phone,
      agencyName: view.agencyName,
      badge: importPortalBadge(row.importSource, url, null),
    };
    const prev = importByOffer.get(offerId);
    if (!prev || (hint.phone && !prev.phone)) importByOffer.set(offerId, hint);
  }

  const sellerByOffer = new Map<number, number>();
  for (const row of sellers) {
    const offerId = Number(row.linkedOfferId);
    if (offerId > 0 && !sellerByOffer.has(offerId)) sellerByOffer.set(offerId, row.id);
  }

  for (const offer of offers) {
    const hint = importByOffer.get(offer.id) || null;
    if (hint && !hint.badge) {
      hint.badge = importPortalBadge(hint.source, hint.url, offer.description);
    }
    const kind = classifyShowingKind({
      offerUserId: offer.userId,
      agencyUserId,
      hasImport: hasImportHint(hint),
    });
    const listingPhone = String(offer.user.officePhone || offer.user.phone || '').trim() || null;
    const sourcePhone = hint?.phone || (kind === 'other_agent' ? listingPhone : null);
    const sellerClientId = sellerByOffer.get(offer.id) || null;
    const listingAgent: ShowingListingAgent | null =
      kind === 'other_agent' || (kind === 'external_import' && offer.userId !== agencyUserId)
        ? {
            userId: offer.user.id,
            name: offer.user.name || null,
            companyName: offer.user.companyName || null,
            phone: listingPhone,
            email: offer.user.email || null,
          }
        : null;
    map.set(offer.id, {
      kind,
      kindLabel: showingKindLabel(kind),
      offerId: offer.id,
      title: offer.title,
      city: offer.city || null,
      street: offer.street || null,
      imageUrl: absolutizeMediaUrl(resolveOfferPrimaryImage(offer)) || null,
      badge: hint?.badge || null,
      sourceUrl: hint?.url || null,
      sourcePhone,
      sourceAgencyName: hint?.agencyName || listingAgent?.companyName || null,
      listingAgent,
      sellerClientId,
      canEmailSeller: Boolean(sellerClientId),
      canCallSource: Boolean(sourcePhone),
      canRequestListingShowing: kind === 'other_agent' || kind === 'external_import',
    });
  }

  return map;
}

export async function resolveShowingKind(
  offerId: number,
  agencyUserId: number,
): Promise<ShowingCard | null> {
  const map = await listShowingCards([offerId], agencyUserId);
  return map.get(offerId) || null;
}

export function importSourceCaption(card: Pick<ShowingCard, 'badge' | 'sourceAgencyName'>): string | null {
  const portal = importPortalLabel(card.badge);
  if (portal && card.sourceAgencyName) return `${portal} · ${card.sourceAgencyName}`;
  return portal || card.sourceAgencyName || null;
}
