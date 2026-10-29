import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveOfferImageUrls } from '@/lib/offers/primaryImage';

/**
 * Ulubione oferty klienta i alerty o ich zmianach (spadek ceny, rezerwacja, nowe zdjęcia).
 * Migawka z chwili dodania do ulubionych (albo ostatniego alertu) jest punktem odniesienia.
 */

export type FavoriteSnapshot = {
  price: number | null;
  status: string;
  imageCount: number;
  at: string;
  lastChange?: { label: string; at: string } | null;
};

export type FavoriteChange = {
  priceDiff: number | null;
  reserved: boolean;
  newPhotos: number;
  /** Krótki opis dla klienta, np. „Cena spadła o 20 000 zł”. */
  label: string | null;
};

type OfferForSnapshot = {
  price?: unknown;
  status?: string | null;
  images?: unknown;
};

export function favoriteSnapshotOf(offer: OfferForSnapshot): FavoriteSnapshot {
  const price = Number(offer.price);
  return {
    price: Number.isFinite(price) && price > 0 ? Math.round(price) : null,
    status: String(offer.status || 'ACTIVE').toUpperCase(),
    imageCount: resolveOfferImageUrls(offer as Parameters<typeof resolveOfferImageUrls>[0]).length,
    at: new Date().toISOString(),
  };
}

export function parseFavoriteSnapshot(raw: unknown): FavoriteSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  return {
    price: v.price == null ? null : Number(v.price),
    status: String(v.status || 'ACTIVE'),
    imageCount: Number(v.imageCount || 0),
    at: String(v.at || ''),
    lastChange:
      v.lastChange && typeof v.lastChange === 'object'
        ? { label: String((v.lastChange as Record<string, unknown>).label || ''), at: String((v.lastChange as Record<string, unknown>).at || '') }
        : null,
  };
}

/** Etykieta do pokazania w panelu: bieżąca zmiana albo ostatni alert z 7 dni. */
export function favoriteBadge(snapshot: FavoriteSnapshot | null, offer: OfferForSnapshot): string | null {
  const live = computeFavoriteChange(snapshot, offer).label;
  if (live) return live;
  const last = snapshot?.lastChange;
  if (last?.label && Date.now() - new Date(last.at).getTime() < 7 * 24 * 60 * 60 * 1000) return last.label;
  return null;
}

const RESERVED = new Set(['RESERVED', 'SOLD', 'ARCHIVED', 'INACTIVE', 'EXPIRED']);

function formatPln(n: number) {
  return `${Math.round(n).toLocaleString('pl-PL')} zł`;
}

export function computeFavoriteChange(snapshot: FavoriteSnapshot | null, offer: OfferForSnapshot): FavoriteChange {
  if (!snapshot) return { priceDiff: null, reserved: false, newPhotos: 0, label: null };
  const now = favoriteSnapshotOf(offer);
  const priceDiff =
    snapshot.price != null && now.price != null && Math.abs(now.price - snapshot.price) >= 1000
      ? now.price - snapshot.price
      : null;
  const reserved = !RESERVED.has(snapshot.status) && RESERVED.has(now.status);
  const newPhotos = Math.max(0, now.imageCount - snapshot.imageCount);
  let label: string | null = null;
  if (reserved) label = now.status === 'SOLD' ? 'Oferta została sprzedana' : 'Oferta jest zarezerwowana';
  else if (priceDiff != null && priceDiff < 0) label = `Cena spadła o ${formatPln(-priceDiff)}`;
  else if (priceDiff != null && priceDiff > 0) label = `Cena wzrosła o ${formatPln(priceDiff)}`;
  else if (newPhotos > 0) label = `${newPhotos} ${newPhotos === 1 ? 'nowe zdjęcie' : newPhotos < 5 ? 'nowe zdjęcia' : 'nowych zdjęć'}`;
  return { priceDiff, reserved, newPhotos, label };
}

export async function setMatchFavorite(params: { clientId: number; matchId: number; favorite: boolean }) {
  const match = await prisma.agencyClientMatch.findFirst({
    where: { id: params.matchId, clientId: params.clientId },
    include: { offer: { select: { price: true, status: true, images: true } } },
  });
  if (!match) throw new Error('Nie znaleziono oferty.');
  await prisma.agencyClientMatch.update({
    where: { id: match.id },
    data: params.favorite
      ? { clientFavorite: true, favoriteAt: new Date(), favoriteSnapshot: favoriteSnapshotOf(match.offer) }
      : { clientFavorite: false, favoriteAt: null, favoriteSnapshot: Prisma.JsonNull },
  });
}

/**
 * Cron: dla każdej ulubionej oferty, która się zmieniła, przygotowuje alert do klienta.
 * Alert idzie przez kolejkę „Do wysłania” (kategoria alert) — agent może włączyć automat.
 * Po przygotowaniu alertu migawka jest odświeżana, żeby nie powtarzać tej samej informacji.
 */
export async function scanFavoriteAlerts(): Promise<{ scanned: number; alerts: number }> {
  const rows = await prisma.agencyClientMatch.findMany({
    where: { clientFavorite: true, client: { status: 'ACTIVE' } },
    include: {
      offer: { select: { id: true, title: true, price: true, status: true, images: true } },
      client: {
        select: { id: true, agencyUserId: true, firstName: true, salutation: true, email: true, portalToken: true, agencyUser: { select: { name: true, companyName: true, email: true } } },
      },
    },
    take: 2000,
  });
  const { deliverToClient, emailStep } = await import('@/lib/crm/clientOutbox');
  const { buildClientVoice } = await import('@/lib/crm/clientVoice');
  const { buildPortalUrl } = await import('@/lib/agencyClientNotify');
  const { buildClientMessageEmailHtml } = await import('@/lib/crm/clientMessageEmail');
  let alerts = 0;
  for (const row of rows) {
    const change = computeFavoriteChange(parseFavoriteSnapshot(row.favoriteSnapshot), row.offer);
    if (!change.label) continue;
    const client = row.client;
    const voice = buildClientVoice({
      clientId: client.id,
      firstName: client.firstName,
      salutation: client.salutation,
      agentName: client.agencyUser?.name,
    });
    const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : null;
    const intro = change.reserved
      ? `Daję znać od razu: oferta „${row.offer.title}”, którą ${voice.c('Pani zapisała', 'Pan zapisał', 'zapisano')} w ulubionych, ${change.label.toLowerCase().replace('oferta ', '')}. Jeśli to była ta jedyna — proszę zadzwonić, sprawdzę, czy sprawa jest jeszcze otwarta.`
      : change.priceDiff != null && change.priceDiff < 0
        ? `Dobra wiadomość przy jednej z ${voice.c('Pani ulubionych ofert', 'Pana ulubionych ofert', 'ulubionych ofert')}: „${row.offer.title}” — ${change.label.toLowerCase()}. To może być dobry moment, żeby ją obejrzeć.`
        : `Przy ofercie „${row.offer.title}” z ulubionych pojawiła się zmiana: ${change.label.toLowerCase()}.`;
    const html = client.email
      ? await buildClientMessageEmailHtml({
          agencyUserId: client.agencyUserId,
          client,
          eyebrow: 'Twoje ulubione',
          title: change.reserved ? 'Ulubiona oferta jest zarezerwowana' : change.priceDiff != null && change.priceDiff < 0 ? 'Ulubiona oferta jest tańsza' : 'Zmiana w ulubionej ofercie',
          paragraphs: [intro],
          property: { title: row.offer.title },
          facts: [{ label: 'Co się zmieniło', value: change.label, tone: change.reserved ? 'warn' : change.priceDiff != null && change.priceDiff < 0 ? 'good' : undefined }],
          ctas: portalUrl ? [{ label: 'Zobacz w panelu', href: portalUrl }] : [],
        })
      : '';
    await deliverToClient({
      agencyUserId: client.agencyUserId,
      clientId: client.id,
      category: 'alert',
      source: 'favorite_alert',
      steps: [
        ...(client.email
          ? [emailStep({ to: client.email, subject: `${change.label} — ${row.offer.title}`.slice(0, 180), html, replyTo: client.agencyUser?.email || undefined })]
          : []),
        {
          kind: 'push' as const,
          clientId: client.id,
          payload: { title: 'Twoje ulubione', body: `${change.label}: ${row.offer.title}`.slice(0, 170), tag: `fav-${row.id}`, url: portalUrl || undefined },
        },
      ],
    }).catch(() => null);
    await prisma.agencyClientMatch.update({
      where: { id: row.id },
      data: { favoriteSnapshot: { ...favoriteSnapshotOf(row.offer), lastChange: { label: change.label, at: new Date().toISOString() } } },
    });
    alerts += 1;
  }
  return { scanned: rows.length, alerts };
}
