import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logEvent } from '@/lib/observability';
import { addExternalPortalListing, loadAgentFacebookDestinations } from '@/lib/crm/sellerMarketing';
import { isFacebookPostPermalink } from '@/lib/crm/marketingChannel';
import { resolveOfferImageUrls } from '@/lib/offers/primaryImage';
import { absolutizeMediaUrl, resolvePublicAppOrigin } from '@/lib/offerShareLanding';
import { offerSharePath } from '@/lib/publicListingPath';

/**
 * Promocja ogłoszeń na Facebooku, bez programów partnerskich:
 *  1. Strona firmy — EstateOS publikuje post (zdjęcia + opis + link) przez oficjalne API stron Meta.
 *  2. Grupy — Meta od 2024 r. nie pozwala aplikacjom publikować w grupach, więc aplikacja agenta
 *     przygotowuje tekst i link dla każdej grupy, otwiera grupę i zapisuje link do posta.
 *  3. Każda publikacja ma własny link śledzący /r/<kod>: liczymy wejścia i zapytania z każdego miejsca.
 */

const GRAPH_VERSION = process.env.FB_GRAPH_VERSION?.trim() || 'v25.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

// ── zakres: biuro albo pojedynczy agent ──

export async function marketingScopeKey(userId: number): Promise<string> {
  const owned = await prisma.agencyCompany.findFirst({ where: { ownerUserId: userId }, select: { id: true } }).catch(() => null);
  if (owned) return `company:${owned.id}`;
  const member = await prisma.agencyCompanyMember
    .findFirst({ where: { userId, status: 'ACTIVE' }, select: { companyId: true } })
    .catch(() => null);
  if (member) return `company:${member.companyId}`;
  return `user:${userId}`;
}

// ── szyfrowanie tokenu strony ──

function tokenKey(): Buffer {
  const secret = process.env.FB_TOKEN_KEY || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '';
  if (!secret) throw new Error('Brak klucza szyfrowania (FB_TOKEN_KEY / NEXTAUTH_SECRET) — nie można bezpiecznie zapisać tokenu strony.');
  return crypto.createHash('sha256').update(`fb-page:${secret}`).digest();
}

function encryptToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

function decryptToken(blob: string): string {
  const [iv, tag, enc] = blob.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(enc, 'base64')), decipher.final()]).toString('utf8');
}

// ── Graph API ──

export class FacebookError extends Error {
  code: number | null;
  constructor(message: string, code: number | null = null) {
    super(message);
    this.code = code;
  }
}

function friendlyGraphError(raw: { message?: string; code?: number; error_subcode?: number } | undefined): string {
  const code = Number(raw?.code || 0);
  if (code === 190) return 'Połączenie ze stroną firmy wygasło albo zostało cofnięte. Połącz stronę ponownie.';
  if (code === 10 || code === 200 || code === 3) {
    return 'Facebook nie pozwolił opublikować: brakuje uprawnienia do publikacji na stronie (pages_manage_posts). Połącz stronę ponownie i zaznacz publikowanie.';
  }
  if (code === 368) return 'Facebook tymczasowo wstrzymał publikacje z tej strony (zbyt wiele postów w krótkim czasie). Spróbuj za kilka godzin.';
  if (code === 4 || code === 17 || code === 32 || code === 613) return 'Facebook ogranicza teraz liczbę zapytań. Spróbuj za kilkanaście minut.';
  if (code === 100) return `Facebook odrzucił dane posta: ${raw?.message || 'nieprawidłowy parametr'}.`;
  return raw?.message ? `Facebook: ${raw.message}` : 'Facebook nie odpowiedział poprawnie. Spróbuj ponownie.';
}

async function graph<T = Record<string, unknown>>(
  path: string,
  opts: { method?: 'GET' | 'POST' | 'DELETE'; token: string; params?: Record<string, unknown> },
): Promise<T> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, '')}`);
  const method = opts.method || 'GET';
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.params || {})) {
    if (v === undefined || v === null) continue;
    const value = typeof v === 'string' ? v : JSON.stringify(v);
    if (method === 'GET') url.searchParams.set(k, value);
    else body.set(k, value);
  }
  if (method === 'GET') url.searchParams.set('access_token', opts.token);
  else body.set('access_token', opts.token);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url.toString(), {
      method,
      body: method === 'GET' ? undefined : body,
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.error) {
      const err = json.error as { message?: string; code?: number } | undefined;
      throw new FacebookError(friendlyGraphError(err), Number(err?.code || 0) || null);
    }
    return json as T;
  } catch (e) {
    if (e instanceof FacebookError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new FacebookError('Facebook nie odpowiedział w 25 sekund. Spróbuj ponownie.');
    throw new FacebookError('Brak połączenia z Facebookiem. Spróbuj ponownie za chwilę.');
  } finally {
    clearTimeout(timer);
  }
}

// ── połączenie strony firmy ──

type PageCandidate = { id: string; name: string; access_token?: string; link?: string };

/**
 * Przyjmuje token z Facebooka (token użytkownika z uprawnieniami do stron albo od razu token strony).
 * Gdy serwer zna FB_APP_ID i FB_APP_SECRET, zamienia token na długoterminowy — tokeny stron z niego nie wygasają.
 */
export async function connectFacebookPage(params: { userId: number; token: string; pageId?: string | null }) {
  const scopeKey = await marketingScopeKey(params.userId);
  let userToken = String(params.token || '').trim();
  if (!userToken) throw new FacebookError('Wklej token z Facebooka.');

  const appId = process.env.FB_APP_ID?.trim();
  const appSecret = process.env.FB_APP_SECRET?.trim();
  if (appId && appSecret) {
    try {
      const exchanged = await graph<{ access_token?: string }>('oauth/access_token', {
        token: userToken,
        params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: userToken },
      });
      if (exchanged.access_token) userToken = exchanged.access_token;
    } catch {
      /* token strony albo już długoterminowy — używamy jak jest */
    }
  }

  let pages: PageCandidate[] = [];
  try {
    const list = await graph<{ data?: PageCandidate[] }>('me/accounts', { token: userToken, params: { fields: 'id,name,access_token,link', limit: '50' } });
    pages = (list.data || []).filter((p) => p.access_token);
  } catch {
    pages = [];
  }

  let chosen: PageCandidate | null = null;
  if (pages.length) {
    chosen = params.pageId ? pages.find((p) => p.id === params.pageId) || null : pages.length === 1 ? pages[0] : null;
    if (!chosen) {
      return { ok: false as const, needsChoice: true as const, pages: pages.map((p) => ({ id: p.id, name: p.name })) };
    }
  } else {
    // Token strony: /me zwraca samą stronę.
    const me = await graph<{ id: string; name: string; link?: string }>('me', { token: userToken, params: { fields: 'id,name,link' } });
    chosen = { id: me.id, name: me.name, link: me.link, access_token: userToken };
  }

  const pageToken = String(chosen.access_token || '');
  const info = await graph<{ id: string; name: string; link?: string; followers_count?: number; fan_count?: number }>(chosen.id, {
    token: pageToken,
    params: { fields: 'id,name,link,followers_count,fan_count' },
  });
  const data = {
    pageId: info.id,
    pageName: info.name.slice(0, 191),
    pageUrl: (info.link || `https://www.facebook.com/${info.id}`).slice(0, 255),
    followers: Number(info.followers_count ?? info.fan_count ?? 0) || null,
    tokenEnc: encryptToken(pageToken),
    connectedById: params.userId,
    connectedAt: new Date(),
    lastError: null,
    lastErrorAt: null,
  };
  await prisma.marketingFacebookPage.upsert({ where: { scopeKey }, create: { scopeKey, ...data }, update: data });
  return { ok: true as const, page: { id: data.pageId, name: data.pageName, url: data.pageUrl, followers: data.followers } };
}

export async function disconnectFacebookPage(userId: number) {
  const scopeKey = await marketingScopeKey(userId);
  await prisma.marketingFacebookPage.deleteMany({ where: { scopeKey } });
}

async function loadPage(scopeKey: string) {
  const row = await prisma.marketingFacebookPage.findUnique({ where: { scopeKey } });
  if (!row) return null;
  return { ...row, token: decryptToken(row.tokenEnc) };
}

async function markPageError(scopeKey: string, message: string) {
  await prisma.marketingFacebookPage
    .update({ where: { scopeKey }, data: { lastError: message.slice(0, 500), lastErrorAt: new Date() } })
    .catch(() => null);
}

// ── grupy biura ──

export type FacebookGroupView = {
  id: number;
  name: string;
  url: string;
  city: string | null;
  members: number | null;
  note: string | null;
  lastPostedAt: string | null;
};

const groupView = (g: {
  id: number;
  name: string;
  url: string;
  city: string | null;
  members: number | null;
  note: string | null;
  lastPostedAt: Date | null;
}): FacebookGroupView => ({
  id: g.id,
  name: g.name,
  url: g.url,
  city: g.city,
  members: g.members,
  note: g.note,
  lastPostedAt: g.lastPostedAt?.toISOString() ?? null,
});

function normalizeGroupUrl(raw: string): string | null {
  const text = String(raw || '').trim();
  const m = text.match(/facebook\.com\/groups\/([^/?#\s]+)/i);
  return m ? `https://www.facebook.com/groups/${m[1]}` : null;
}

export async function saveFacebookGroup(params: {
  userId: number;
  id?: number | null;
  name: string;
  url: string;
  city?: string | null;
  members?: number | null;
  note?: string | null;
}) {
  const scopeKey = await marketingScopeKey(params.userId);
  const url = normalizeGroupUrl(params.url);
  if (!url) throw new Error('Wklej link do grupy, np. https://www.facebook.com/groups/mieszkania-warszawa');
  const name = String(params.name || '').trim().slice(0, 191);
  if (!name) throw new Error('Podaj nazwę grupy.');
  const members = params.members == null || params.members === ('' as unknown) ? null : Math.max(0, Math.round(Number(params.members)));
  const data = {
    name,
    url,
    city: String(params.city || '').trim().slice(0, 96) || null,
    members: Number.isFinite(members as number) ? members : null,
    note: String(params.note || '').trim().slice(0, 300) || null,
    updatedAt: new Date(),
    active: true,
  };
  if (params.id) {
    const found = await prisma.marketingFacebookGroup.findFirst({ where: { id: params.id, scopeKey } });
    if (!found) throw new Error('Nie znaleziono grupy.');
    return groupView(await prisma.marketingFacebookGroup.update({ where: { id: found.id }, data }));
  }
  const dup = await prisma.marketingFacebookGroup.findFirst({ where: { scopeKey, url, active: true } });
  if (dup) return groupView(await prisma.marketingFacebookGroup.update({ where: { id: dup.id }, data }));
  return groupView(await prisma.marketingFacebookGroup.create({ data: { ...data, scopeKey, createdById: params.userId } }));
}

export async function removeFacebookGroup(userId: number, id: number) {
  const scopeKey = await marketingScopeKey(userId);
  await prisma.marketingFacebookGroup.updateMany({ where: { id, scopeKey }, data: { active: false, updatedAt: new Date() } });
}

/**
 * Grupy dla danego ogłoszenia: najpierw z miasta ogłoszenia, potem od największych.
 * Grupy z historii (stary sposób zapisu) przenosimy raz do listy biura.
 */
async function importHistoryGroups(scopeKey: string, userId: number) {
  const any = await prisma.marketingFacebookGroup.count({ where: { scopeKey } });
  if (any) return;
  const history = await loadAgentFacebookDestinations(userId).catch(() => []);
  for (const dest of history.slice(0, 60)) {
    const url = normalizeGroupUrl(dest.groupUrl || '');
    if (!url) continue;
    await prisma.marketingFacebookGroup
      .create({
        data: {
          scopeKey,
          name: dest.groupName.slice(0, 191),
          url,
          createdById: userId,
          lastPostedAt: dest.lastPostedAt ? new Date(dest.lastPostedAt) : null,
        },
      })
      .catch(() => null);
  }
}

async function listGroupsForOffer(scopeKey: string, city: string | null) {
  const rows = await prisma.marketingFacebookGroup.findMany({ where: { scopeKey, active: true }, take: 200 });
  const c = String(city || '').toLowerCase();
  return rows
    .map(groupView)
    .sort((a, b) => {
      const ac = c && a.city?.toLowerCase() === c ? 1 : 0;
      const bc = c && b.city?.toLowerCase() === c ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return (b.members || 0) - (a.members || 0);
    });
}

// ── treść posta ──

const fmtPrice = (n: number | null | undefined) =>
  n && Number.isFinite(n) ? `${Math.round(n).toLocaleString('pl-PL').replace(/ /g, ' ')} zł` : null;

async function loadOfferForPost(offerId: number, agencyUserId: number) {
  const offer = await prisma.offer.findFirst({
    where: { id: offerId, userId: agencyUserId },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      pricePln: true,
      area: true,
      rooms: true,
      floor: true,
      city: true,
      district: true,
      images: true,
      transactionType: true,
    },
  });
  if (!offer) throw new Error('Nie znaleziono ogłoszenia (albo nie jest Twoje).');
  const agent = await prisma.user.findUnique({ where: { id: agencyUserId }, select: { name: true, phone: true, companyName: true } });
  const scopeKey = await marketingScopeKey(agencyUserId);
  const companyId = scopeKey.startsWith('company:') ? Number(scopeKey.slice(8)) : null;
  const company = companyId ? await prisma.agencyCompany.findUnique({ where: { id: companyId }, select: { name: true } }) : null;
  return { offer, agent, agencyName: company?.name || agent?.companyName || null };
}

export function composeOfferPost(input: {
  title: string;
  description?: string | null;
  price?: number | null;
  area?: number | null;
  rooms?: number | null;
  floor?: number | null;
  city?: string | null;
  district?: string | null;
  rent?: boolean;
  link: string;
  agentName?: string | null;
  agentPhone?: string | null;
  agencyName?: string | null;
}) {
  const place = [input.district && input.district !== 'OTHER' ? input.district : null, input.city].filter(Boolean).join(', ');
  const facts = [
    fmtPrice(input.price) ? `${fmtPrice(input.price)}${input.rent ? ' / mies.' : ''}` : null,
    input.area ? `${String(Math.round(input.area * 10) / 10).replace('.', ',')} m²` : null,
    input.rooms ? `${input.rooms} ${input.rooms === 1 ? 'pokój' : input.rooms < 5 ? 'pokoje' : 'pokoi'}` : null,
    input.floor != null ? (input.floor === 0 ? 'parter' : `${input.floor}. piętro`) : null,
  ].filter(Boolean);
  const desc = String(input.description || '')
    .replace(/\s+/g, ' ')
    .trim();
  const short = desc.length > 320 ? `${desc.slice(0, 317).replace(/\s+\S*$/, '')}…` : desc;
  const signature = [input.agentName, input.agencyName].filter(Boolean).join(' · ');
  return [
    input.title.trim(),
    place ? `📍 ${place}` : null,
    facts.length ? facts.join(' · ') : null,
    '',
    short || null,
    short ? '' : null,
    `Zdjęcia, rzut i termin oglądania: ${input.link}`,
    signature ? `${signature}${input.agentPhone ? `, tel. ${input.agentPhone}` : ''}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function newCode(): string {
  return crypto.randomBytes(9).toString('base64url');
}

export function trackingLink(code: string): string {
  return `${resolvePublicAppOrigin()}/r/${code}`;
}

async function linkedSellerClientId(agencyUserId: number, offerId: number, hintClientId?: number | null) {
  const linked = await prisma.agencyClient.findFirst({
    where: { agencyUserId, status: 'ACTIVE', type: 'SELLER', linkedOfferId: offerId },
    select: { id: true },
  });
  if (linked) return linked.id;
  if (hintClientId) {
    const c = await prisma.agencyClient.findFirst({ where: { id: hintClientId, agencyUserId, linkedOfferId: offerId }, select: { id: true } });
    if (c) return c.id;
  }
  return null;
}

// ── publikacja na stronie firmy ──

export async function publishOfferToPage(params: {
  userId: number;
  offerId: number;
  clientId?: number | null;
  message?: string | null;
  visibleToClient?: boolean;
  withPhotos?: boolean;
}) {
  const scopeKey = await marketingScopeKey(params.userId);
  const page = await loadPage(scopeKey);
  if (!page) throw new FacebookError('Najpierw połącz stronę firmy na Facebooku (Ustawienia promocji → Połącz stronę).');
  const { offer, agent, agencyName } = await loadOfferForPost(params.offerId, params.userId);
  const code = newCode();
  const link = trackingLink(code);
  const message =
    String(params.message || '').trim().replace('{link}', link) ||
    composeOfferPost({
      title: offer.title,
      description: offer.description,
      price: offer.pricePln ?? offer.price,
      area: offer.area,
      rooms: offer.rooms,
      floor: offer.floor,
      city: offer.city,
      district: offer.district,
      rent: String(offer.transactionType) === 'RENT',
      link,
      agentName: agent?.name,
      agentPhone: agent?.phone,
      agencyName: agencyName || page.pageName,
    });
  const finalMessage = message.includes(link) ? message : `${message}\n\n${link}`;
  const clientId = await linkedSellerClientId(params.userId, offer.id, params.clientId);
  const pub = await prisma.marketingPublication.create({
    data: { scopeKey, offerId: offer.id, clientId, agencyUserId: params.userId, channel: 'fb_page', code, status: 'pending' },
  });

  const images = resolveOfferImageUrls(offer).map(absolutizeMediaUrl).filter(Boolean).slice(0, 10) as string[];
  let postId: string | null = null;
  try {
    if (params.withPhotos !== false && images.length >= 2) {
      const media: Array<{ media_fbid: string }> = [];
      for (const url of images) {
        try {
          const photo = await graph<{ id: string }>(`${page.pageId}/photos`, {
            method: 'POST',
            token: page.token,
            params: { url, published: 'false' },
          });
          if (photo.id) media.push({ media_fbid: photo.id });
        } catch (e) {
          if (e instanceof FacebookError && (e.code === 190 || e.code === 10 || e.code === 200)) throw e;
          // pojedyncze zdjęcie nie przeszło — publikujemy resztę
        }
      }
      if (media.length >= 1) {
        const post = await graph<{ id: string }>(`${page.pageId}/feed`, {
          method: 'POST',
          token: page.token,
          params: { message: finalMessage, attached_media: media },
        });
        postId = post.id;
      }
    }
    if (!postId) {
      const post = await graph<{ id: string }>(`${page.pageId}/feed`, {
        method: 'POST',
        token: page.token,
        params: { message: finalMessage, link },
      });
      postId = post.id;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Nie udało się opublikować.';
    await prisma.marketingPublication.update({ where: { id: pub.id }, data: { status: 'failed', error: msg.slice(0, 500) } });
    await markPageError(scopeKey, msg);
    logEvent('warn', 'fb_page_publish_failed', 'facebookPromotion.publishOfferToPage', { offerId: offer.id, code: (e as FacebookError)?.code ?? null });
    throw e;
  }

  let postUrl = `https://www.facebook.com/${postId}`;
  try {
    const info = await graph<{ permalink_url?: string }>(postId, { token: page.token, params: { fields: 'permalink_url' } });
    if (info.permalink_url) postUrl = info.permalink_url;
  } catch {
    /* zostaje adres z id */
  }

  let activityId: number | null = null;
  if (clientId) {
    const recorded = await addExternalPortalListing({
      clientId,
      agencyUserId: params.userId,
      preview: {
        url: postUrl,
        host: 'facebook.com',
        siteName: 'Facebook',
        title: page.pageName,
        description: `Post na stronie ${page.pageName}`,
        image: images[0] || null,
      },
      portal: 'Facebook',
      status: 'active',
      note: `Ogłoszenie opublikowane na stronie ${page.pageName}${page.followers ? ` (${page.followers.toLocaleString('pl-PL')} obserwujących)` : ''}.`,
      visibleToClient: params.visibleToClient !== false,
    }).catch(() => null);
    activityId = recorded && 'activityId' in recorded ? Number((recorded as { activityId?: number }).activityId) || null : null;
  }

  const live = await prisma.marketingPublication.update({
    where: { id: pub.id },
    data: { status: 'live', externalId: postId, postUrl: postUrl.slice(0, 500), publishedAt: new Date(), activityId },
  });
  await prisma.marketingFacebookPage.update({ where: { scopeKey }, data: { lastError: null, lastErrorAt: null } }).catch(() => null);
  return { publicationId: live.id, postUrl, link, pageName: page.pageName };
}

// ── udostępnienia w grupach ──

export async function prepareGroupShares(params: { userId: number; offerId: number; clientId?: number | null; groupIds: number[] }) {
  const scopeKey = await marketingScopeKey(params.userId);
  const { offer, agent, agencyName } = await loadOfferForPost(params.offerId, params.userId);
  const groups = await prisma.marketingFacebookGroup.findMany({
    where: { scopeKey, active: true, id: { in: params.groupIds.slice(0, 30) } },
  });
  if (!groups.length) throw new Error('Zaznacz co najmniej jedną grupę.');
  const clientId = await linkedSellerClientId(params.userId, offer.id, params.clientId);
  const pagePost = await prisma.marketingPublication.findFirst({
    where: { scopeKey, offerId: offer.id, channel: 'fb_page', status: 'live' },
    orderBy: { publishedAt: 'desc' },
    select: { postUrl: true },
  });
  const images = resolveOfferImageUrls(offer).map(absolutizeMediaUrl).filter(Boolean).slice(0, 10) as string[];
  const order = new Map(params.groupIds.map((id, i) => [id, i]));
  const out = [];
  for (const g of groups.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))) {
    const code = newCode();
    const link = trackingLink(code);
    const pub = await prisma.marketingPublication.create({
      data: { scopeKey, offerId: offer.id, clientId, agencyUserId: params.userId, channel: 'fb_group', groupId: g.id, code, status: 'pending' },
    });
    out.push({
      publicationId: pub.id,
      groupId: g.id,
      groupName: g.name,
      groupUrl: g.url,
      members: g.members,
      link,
      text: composeOfferPost({
        title: offer.title,
        description: offer.description,
        price: offer.pricePln ?? offer.price,
        area: offer.area,
        rooms: offer.rooms,
        floor: offer.floor,
        city: offer.city,
        district: offer.district,
        rent: String(offer.transactionType) === 'RENT',
        link,
        agentName: agent?.name,
        agentPhone: agent?.phone,
        agencyName,
      }),
    });
  }
  return { shares: out, images, pagePostUrl: pagePost?.postUrl || null };
}

export async function recordGroupShare(params: {
  userId: number;
  publicationId: number;
  postUrl?: string | null;
  skipped?: boolean;
  visibleToClient?: boolean;
}) {
  const scopeKey = await marketingScopeKey(params.userId);
  const pub = await prisma.marketingPublication.findFirst({ where: { id: params.publicationId, scopeKey, channel: 'fb_group' } });
  if (!pub) throw new Error('Nie znaleziono tej publikacji.');
  if (params.skipped) {
    await prisma.marketingPublication.update({ where: { id: pub.id }, data: { status: 'removed' } });
    return { ok: true as const, skipped: true };
  }
  const postUrl = String(params.postUrl || '').trim();
  if (postUrl && !isFacebookPostPermalink(postUrl)) {
    throw new Error('To link do grupy, a nie do posta. Pod wrzuconym postem: ⋯ → Kopiuj link.');
  }
  const group = pub.groupId ? await prisma.marketingFacebookGroup.findUnique({ where: { id: pub.groupId } }) : null;
  let activityId: number | null = null;
  if (pub.clientId) {
    const recorded = await addExternalPortalListing({
      clientId: pub.clientId,
      agencyUserId: pub.agencyUserId,
      preview: {
        url: postUrl || group?.url || '',
        host: 'facebook.com',
        siteName: 'Facebook',
        title: group?.name || 'Grupa na Facebooku',
        description: `Grupa Facebook: ${group?.name || ''}`,
        image: null,
        groupName: group?.name || null,
        groupUrl: group?.url || null,
      },
      portal: 'Facebook',
      status: 'active',
      groupName: group?.name || null,
      note: `Ogłoszenie udostępnione w grupie „${group?.name || 'Facebook'}”${group?.members ? ` (${group.members.toLocaleString('pl-PL')} członków)` : ''}.`,
      visibleToClient: params.visibleToClient !== false,
    }).catch(() => null);
    activityId = recorded && 'activityId' in recorded ? Number((recorded as { activityId?: number }).activityId) || null : null;
  }
  await prisma.marketingPublication.update({
    where: { id: pub.id },
    data: { status: 'live', postUrl: postUrl ? postUrl.slice(0, 500) : null, publishedAt: new Date(), activityId },
  });
  if (group) await prisma.marketingFacebookGroup.update({ where: { id: group.id }, data: { lastPostedAt: new Date() } });
  return { ok: true as const };
}

// ── link śledzący ──

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export async function trackPublicationVisit(code: string, visitorKey: string) {
  const pub = await prisma.marketingPublication.findUnique({
    where: { code },
    select: { id: true, offerId: true, agencyUserId: true, status: true },
  });
  if (!pub) return null;
  const visitorHash = crypto.createHash('sha256').update(`${pub.id}:${visitorKey}`).digest('hex');
  try {
    await prisma.marketingVisit.create({ data: { publicationId: pub.id, visitorHash, day: dayKey() } });
    await prisma.marketingPublication.update({
      where: { id: pub.id },
      data: { visits: { increment: 1 }, lastVisitAt: new Date(), ...(pub.status === 'pending' ? { status: 'live', publishedAt: new Date() } : {}) },
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    // ta sama osoba tego samego dnia — nie liczymy drugi raz
  }
  return pub;
}

export async function trackPublicationInquiry(code: string, offerId: number) {
  await prisma.marketingPublication
    .updateMany({ where: { code, offerId }, data: { inquiries: { increment: 1 } } })
    .catch(() => null);
}

export function offerLandingPath(offerId: number, agencyUserId: number) {
  return offerSharePath(offerId, { presentingAgentId: agencyUserId });
}

// ── statystyki postów na stronie ──

export type PostStats = { views: number | null; reactions: number; comments: number; shares: number };

async function fetchPostStats(postId: string, token: string): Promise<PostStats> {
  const base = await graph<{
    reactions?: { summary?: { total_count?: number } };
    comments?: { summary?: { total_count?: number } };
    shares?: { count?: number };
  }>(postId, { token, params: { fields: 'reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares' } });
  let views: number | null = null;
  // Od czerwca 2026 Meta liczy „wyświetlenia unikalne” zamiast zasięgu; starsze nazwy jako zapas.
  for (const metric of ['post_total_media_view_unique', 'post_impressions_unique']) {
    try {
      const ins = await graph<{ data?: Array<{ values?: Array<{ value?: number }> }> }>(`${postId}/insights`, {
        token,
        params: { metric },
      });
      const v = ins.data?.[0]?.values?.[0]?.value;
      if (typeof v === 'number') {
        views = v;
        break;
      }
    } catch {
      /* następna nazwa */
    }
  }
  return {
    views,
    reactions: Number(base.reactions?.summary?.total_count || 0),
    comments: Number(base.comments?.summary?.total_count || 0),
    shares: Number(base.shares?.count || 0),
  };
}

export async function refreshPageStats(opts: { scopeKey?: string; offerId?: number; limit?: number; maxAgeMs?: number } = {}) {
  const staleBefore = new Date(Date.now() - (opts.maxAgeMs ?? 3 * 60 * 60 * 1000));
  const rows = await prisma.marketingPublication.findMany({
    where: {
      channel: 'fb_page',
      status: 'live',
      externalId: { not: null },
      publishedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      OR: [{ statsAt: null }, { statsAt: { lt: staleBefore } }],
      ...(opts.scopeKey ? { scopeKey: opts.scopeKey } : {}),
      ...(opts.offerId ? { offerId: opts.offerId } : {}),
    },
    orderBy: { statsAt: 'asc' },
    take: opts.limit ?? 40,
  });
  const pages = new Map<string, Awaited<ReturnType<typeof loadPage>>>();
  let updated = 0;
  for (const row of rows) {
    if (!pages.has(row.scopeKey)) pages.set(row.scopeKey, await loadPage(row.scopeKey).catch(() => null));
    const page = pages.get(row.scopeKey);
    if (!page || !row.externalId) continue;
    try {
      const stats = await fetchPostStats(row.externalId, page.token);
      await prisma.marketingPublication.update({ where: { id: row.id }, data: { stats, statsAt: new Date() } });
      updated += 1;
    } catch (e) {
      const code = e instanceof FacebookError ? e.code : null;
      if (code === 100) {
        // post usunięty na Facebooku
        await prisma.marketingPublication.update({ where: { id: row.id }, data: { status: 'removed', statsAt: new Date() } });
      } else {
        await prisma.marketingPublication.update({ where: { id: row.id }, data: { statsAt: new Date() } });
        if (code === 190) await markPageError(row.scopeKey, (e as Error).message);
      }
    }
  }
  return { checked: rows.length, updated };
}

// ── widoki ──

type PubRow = Awaited<ReturnType<typeof prisma.marketingPublication.findMany>>[number];

function statsOf(row: PubRow): PostStats | null {
  const s = row.stats as Record<string, unknown> | null;
  if (!s) return null;
  return {
    views: typeof s.views === 'number' ? s.views : null,
    reactions: Number(s.reactions || 0),
    comments: Number(s.comments || 0),
    shares: Number(s.shares || 0),
  };
}

async function publicationsForOffer(offerId: number, scopeKey?: string) {
  const rows = await prisma.marketingPublication.findMany({
    where: { offerId, status: 'live', ...(scopeKey ? { scopeKey } : {}) },
    orderBy: { publishedAt: 'desc' },
    take: 120,
  });
  const groupIds = [...new Set(rows.map((r) => r.groupId).filter(Boolean))] as number[];
  const groups = groupIds.length ? await prisma.marketingFacebookGroup.findMany({ where: { id: { in: groupIds } } }) : [];
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const pageScopes = [...new Set(rows.filter((r) => r.channel === 'fb_page').map((r) => r.scopeKey))];
  const pageRows = pageScopes.length ? await prisma.marketingFacebookPage.findMany({ where: { scopeKey: { in: pageScopes } } }) : [];
  const pageByScope = new Map(pageRows.map((p) => [p.scopeKey, p]));
  return rows.map((r) => {
    const g = r.groupId ? groupById.get(r.groupId) : null;
    const p = r.channel === 'fb_page' ? pageByScope.get(r.scopeKey) : null;
    return {
      id: r.id,
      channel: r.channel as 'fb_page' | 'fb_group',
      name: r.channel === 'fb_page' ? p?.pageName || 'Strona firmy' : g?.name || 'Grupa na Facebooku',
      members: r.channel === 'fb_page' ? p?.followers ?? null : g?.members ?? null,
      postUrl: r.postUrl,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      visits: r.visits,
      inquiries: r.inquiries,
      stats: statsOf(r),
      statsAt: r.statsAt?.toISOString() ?? null,
    };
  });
}

export type OfferReach = Awaited<ReturnType<typeof offerReach>>;

/** Zasięg ogłoszenia — tylko liczby z publikacji i linków śledzących. */
export async function offerReach(offerId: number, scopeKey?: string) {
  const items = await publicationsForOffer(offerId, scopeKey);
  const pagePosts = items.filter((i) => i.channel === 'fb_page');
  const groups = items.filter((i) => i.channel === 'fb_group');
  const uniqueGroupMembers = new Map<string, number>();
  for (const g of groups) if (g.members) uniqueGroupMembers.set(g.name, g.members);
  const views = pagePosts.reduce((s, p) => s + (p.stats?.views || 0), 0);
  return {
    items,
    totals: {
      publications: items.length,
      pagePosts: pagePosts.length,
      groups: new Set(groups.map((g) => g.name)).size,
      groupMembers: [...uniqueGroupMembers.values()].reduce((s, n) => s + n, 0),
      pageViews: pagePosts.some((p) => p.stats?.views != null) ? views : null,
      engagements: pagePosts.reduce((s, p) => s + (p.stats ? p.stats.reactions + p.stats.comments + p.stats.shares : 0), 0),
      visits: items.reduce((s, i) => s + i.visits, 0),
      inquiries: items.reduce((s, i) => s + i.inquiries, 0),
    },
  };
}

/** Wszystko, czego aplikacja agenta potrzebuje w panelu promocji jednego ogłoszenia. */
export async function promotionOverview(userId: number, offerId: number | null) {
  const scopeKey = await marketingScopeKey(userId);
  const pageRow = await prisma.marketingFacebookPage.findUnique({ where: { scopeKey } });
  const offer = offerId
    ? await prisma.offer.findFirst({ where: { id: offerId, userId }, select: { id: true, city: true, title: true } })
    : null;
  if (offer) await refreshPageStats({ scopeKey, offerId: offer.id, limit: 5 }).catch(() => null);
  await importHistoryGroups(scopeKey, userId).catch(() => null);
  const groups = await listGroupsForOffer(scopeKey, offer?.city || null);
  const reach = offer ? await offerReach(offer.id, scopeKey) : null;
  const postedGroupNames = new Set((reach?.items || []).filter((i) => i.channel === 'fb_group').map((i) => i.name));
  return {
    scopeKey,
    page: pageRow
      ? {
          name: pageRow.pageName,
          url: pageRow.pageUrl,
          followers: pageRow.followers,
          lastError: pageRow.lastError,
          lastErrorAt: pageRow.lastErrorAt?.toISOString() ?? null,
        }
      : null,
    canExchangeToken: Boolean(process.env.FB_APP_ID && process.env.FB_APP_SECRET),
    offer: offer ? { id: offer.id, city: offer.city, title: offer.title } : null,
    groups: groups.map((g) => ({ ...g, postedThisOffer: postedGroupNames.has(g.name) })),
    reach,
  };
}
