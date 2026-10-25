import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logEvent } from '@/lib/observability';

/**
 * Wejście klienta do panelu / aplikacji bez zakładania konta.
 *
 *  • Link w QR i w wiadomości od agenta: /app/kod/<linkKey> — długi, niezgadywalny klucz,
 *    działa do odwołania (tak samo bezpieczny jak link do panelu).
 *  • 6 cyfr do wpisania w aplikacji: ważne 48 h, potem panel / agent dostaje nowe.
 *    Każda próba liczona w bazie (wspólny limit dla wszystkich procesów): za dużo błędów
 *    z jednego adresu albo globalnie → chwilowa blokada wpisywania (link nadal działa).
 */

const CODE_RE = /^\d{6}$/;
const LINK_KEY_RE = /^[A-Za-z0-9_-]{20,40}$/;
export const INVITE_CODE_TTL_MS = 48 * 60 * 60 * 1000;

const LIMITS = {
  ipWindowMs: 15 * 60 * 1000,
  ipMaxFailures: 10,
  ipDayMaxFailures: 40,
  globalWindowMs: 60 * 60 * 1000,
  globalMaxFailures: 300,
};

export type ClientInvite = { code: string; linkKey: string; expiresAt: string };

function randomCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function randomLinkKey(): string {
  return crypto.randomBytes(18).toString('base64url');
}

function codeExpiry(row: { createdAt: Date; expiresAt: Date | null }): Date {
  return row.expiresAt ?? new Date(row.createdAt.getTime() + INVITE_CODE_TTL_MS);
}

/** Aktualne zaproszenie klienta. Gdy 6 cyfr wygasło — nowe cyfry (stary link z QR nadal działa). */
export async function ensureClientInvite(clientId: number, companionId: number | null = null): Promise<ClientInvite> {
  const now = Date.now();
  const rows = await prisma.clientInviteCode.findMany({
    where: { clientId, companionId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  const current = rows[0];
  if (current && codeExpiry(current).getTime() > now + 60 * 60 * 1000) {
    let linkKey = current.linkKey;
    if (!linkKey) {
      linkKey = randomLinkKey();
      await prisma.clientInviteCode.update({ where: { id: current.id }, data: { linkKey } });
    }
    return { code: current.code, linkKey, expiresAt: codeExpiry(current).toISOString() };
  }
  // Nowe 6 cyfr. Link z QR przechodzi na nowy wiersz, ale stary klucz zostaje ważny (wiersz nieodwołany).
  const linkKey = current?.linkKey || randomLinkKey();
  if (current?.linkKey) {
    await prisma.clientInviteCode.update({ where: { id: current.id }, data: { linkKey: null } });
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomCode();
    const expiresAt = new Date(now + INVITE_CODE_TTL_MS);
    try {
      await prisma.clientInviteCode.create({ data: { code, clientId, companionId, linkKey, expiresAt } });
      if (current) {
        // Stare cyfry są już nieważne — wiersz zostaje tylko jako historia.
        await prisma.clientInviteCode.update({ where: { id: current.id }, data: { revokedAt: new Date() } });
      }
      return { code, linkKey, expiresAt: expiresAt.toISOString() };
    } catch {
      /* kolizja 6 cyfr z innym (także wygasłym) kodem — losujemy dalej */
    }
  }
  throw new Error('Nie udało się wygenerować kodu — spróbuj ponownie.');
}

/** Zgodność wstecz: sam 6-cyfrowy kod. */
export async function ensureClientInviteCode(clientId: number, companionId: number | null = null): Promise<string> {
  return (await ensureClientInvite(clientId, companionId)).code;
}

/** Agent: „nowy kod” — odwołuje cyfry i link z QR. */
export async function regenerateClientInvite(clientId: number, companionId: number | null = null): Promise<ClientInvite> {
  await prisma.clientInviteCode.updateMany({
    where: { clientId, companionId, revokedAt: null },
    data: { revokedAt: new Date(), linkKey: null },
  });
  return ensureClientInvite(clientId, companionId);
}

export async function regenerateClientInviteCode(clientId: number, companionId: number | null = null): Promise<string> {
  return (await regenerateClientInvite(clientId, companionId)).code;
}

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://estateos.pl').replace(/\/+$/, '');
}

/**
 * Link w QR / wiadomości. Format `/app/kod/<6 cyfr>?k=<klucz>`: aplikacje sprzed tej zmiany
 * odczytają cyfry, nowe aplikacje i przeglądarka użyją klucza.
 */
export function inviteLink(invite: Pick<ClientInvite, 'code' | 'linkKey'>): string {
  return `${siteBase()}/app/kod/${invite.code}?k=${encodeURIComponent(invite.linkKey)}`;
}

/** @deprecated — link z samymi cyframi; używaj inviteLink(invite). */
export function inviteDeepLink(code: string): string {
  return `${siteBase()}/app/kod/${code}`;
}

// ── Limit prób ──

/** Adres klienta. Za nginx bierzemy OSTATNI wpis X-Forwarded-For (dopisany przez nasz proxy). */
export function requestIp(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const xff = (headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff[xff.length - 1] || 'unknown';
}

function ipBucket(ip: string): string {
  // IPv6: cała sieć /64 to jeden adres (inaczej łatwo obejść limit).
  if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':');
  return ip;
}

function hashIp(ip: string): string {
  const salt = process.env.INVITE_ATTEMPT_SALT || process.env.NEXTAUTH_SECRET || 'estateos-invite';
  return crypto.createHash('sha256').update(`${salt}:${ipBucket(ip)}`).digest('hex');
}

export type InviteRedeemResult =
  | { ok: true; portalToken: string; clientId: number }
  | { ok: false; status: number; reason: 'invalid' | 'expired' | 'revoked' | 'rate_limited' | 'busy'; error: string };

async function limitState(ipHash: string) {
  const now = Date.now();
  const [ipRecent, ipDay, global] = await Promise.all([
    prisma.clientInviteAttempt.count({ where: { ipHash, success: false, createdAt: { gte: new Date(now - LIMITS.ipWindowMs) } } }),
    prisma.clientInviteAttempt.count({ where: { ipHash, success: false, createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } } }),
    prisma.clientInviteAttempt.count({ where: { success: false, createdAt: { gte: new Date(now - LIMITS.globalWindowMs) } } }),
  ]);
  return { ipRecent, ipDay, global };
}

async function recordAttempt(ipHash: string, success: boolean) {
  await prisma.clientInviteAttempt.create({ data: { ipHash, success } }).catch(() => null);
  // Sprzątanie raz na jakiś czas — tabela trzyma tylko ostatnie 2 dni.
  if (Math.random() < 0.02) {
    await prisma.clientInviteAttempt
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } } })
      .catch(() => null);
  }
}

async function tokenForRow(row: { clientId: number; companionId: number | null }): Promise<string | null> {
  if (row.companionId) {
    const companion = await prisma.agencyClientCompanion.findUnique({ where: { id: row.companionId } });
    return companion && !companion.revokedAt ? companion.token : null;
  }
  const client = await prisma.agencyClient.findFirst({
    where: { id: row.clientId, status: 'ACTIVE' },
    select: { portalToken: true },
  });
  return client?.portalToken || null;
}

/** Wejście z linku (QR / wiadomość): klucz jest niezgadywalny, więc bez limitu cyfr. */
export async function redeemInviteLinkKey(rawKey: string, ip: string): Promise<InviteRedeemResult> {
  const key = String(rawKey || '').trim();
  const ipHash = hashIp(ip);
  if (!LINK_KEY_RE.test(key)) {
    return { ok: false, status: 400, reason: 'invalid', error: 'Ten link jest niekompletny. Otwórz go jeszcze raz z wiadomości od agenta.' };
  }
  const row = await prisma.clientInviteCode.findUnique({ where: { linkKey: key } });
  if (!row) {
    await recordAttempt(ipHash, false);
    return {
      ok: false,
      status: 404,
      reason: 'revoked',
      error: 'Ten link został wyłączony — agent wygenerował nowy. Poproś go o aktualny link albo kod.',
    };
  }
  const portalToken = await tokenForRow(row);
  if (!portalToken) {
    return { ok: false, status: 410, reason: 'revoked', error: 'Ten panel nie jest już aktywny. Skontaktuj się ze swoim agentem.' };
  }
  await recordAttempt(ipHash, true);
  if (!row.redeemedAt) await prisma.clientInviteCode.update({ where: { id: row.id }, data: { redeemedAt: new Date() } }).catch(() => {});
  return { ok: true, portalToken, clientId: row.clientId };
}

/** Wejście z wpisanych 6 cyfr — z limitem prób i ważnością 48 h. */
export async function redeemInviteCode(rawCode: string, ip: string): Promise<InviteRedeemResult> {
  const code = String(rawCode || '').replace(/\D/g, '');
  const ipHash = hashIp(ip);
  if (!CODE_RE.test(code)) {
    return { ok: false, status: 400, reason: 'invalid', error: 'Kod ma 6 cyfr — sprawdź go w wiadomości od agenta.' };
  }
  const limits = await limitState(ipHash).catch(() => ({ ipRecent: 0, ipDay: 0, global: 0 }));
  if (limits.ipRecent >= LIMITS.ipMaxFailures || limits.ipDay >= LIMITS.ipDayMaxFailures) {
    logEvent('warn', 'invite_code_rate_limited', 'clientInviteCode.redeem', { scope: 'ip', ipRecent: limits.ipRecent, ipDay: limits.ipDay });
    return {
      ok: false,
      status: 429,
      reason: 'rate_limited',
      error:
        limits.ipDay >= LIMITS.ipDayMaxFailures
          ? 'Za dużo błędnych kodów z tego połączenia — wpisywanie jest zablokowane do jutra. Otwórz link z wiadomości od agenta albo poproś go o pomoc.'
          : 'Za dużo błędnych kodów. Odczekaj 15 minut albo otwórz link z wiadomości od agenta — działa od razu.',
    };
  }
  if (limits.global >= LIMITS.globalMaxFailures) {
    logEvent('error', 'invite_code_global_lock', 'clientInviteCode.redeem', { failuresLastHour: limits.global });
    return {
      ok: false,
      status: 503,
      reason: 'busy',
      error: 'Wpisywanie kodów jest chwilowo wstrzymane ze względów bezpieczeństwa. Otwórz link z wiadomości od agenta — działa normalnie.',
    };
  }
  const row = await prisma.clientInviteCode.findUnique({ where: { code } });
  if (!row) {
    await recordAttempt(ipHash, false);
    const left = Math.max(0, LIMITS.ipMaxFailures - limits.ipRecent - 1);
    return {
      ok: false,
      status: 404,
      reason: 'invalid',
      error: `Nie ma takiego kodu. Sprawdź cyfry w wiadomości od agenta.${left <= 3 ? ` Zostały ${left} próby, potem trzeba odczekać 15 minut.` : ''}`,
    };
  }
  if (row.revokedAt) {
    await recordAttempt(ipHash, false);
    return { ok: false, status: 410, reason: 'revoked', error: 'Ten kod został zastąpiony nowym. Nowy kod jest w panelu w przeglądarce albo u agenta.' };
  }
  if (codeExpiry(row).getTime() < Date.now()) {
    await recordAttempt(ipHash, false);
    return {
      ok: false,
      status: 410,
      reason: 'expired',
      error: 'Kod wygasł — działa 48 godzin. Poproś agenta o nowy albo otwórz link z wiadomości (link nie wygasa).',
    };
  }
  const portalToken = await tokenForRow(row);
  if (!portalToken) {
    await recordAttempt(ipHash, false);
    return { ok: false, status: 410, reason: 'revoked', error: 'Ten panel nie jest już aktywny. Skontaktuj się ze swoim agentem.' };
  }
  await recordAttempt(ipHash, true);
  if (!row.redeemedAt) await prisma.clientInviteCode.update({ where: { id: row.id }, data: { redeemedAt: new Date() } }).catch(() => {});
  return { ok: true, portalToken, clientId: row.clientId };
}

/** Link `/app/kod/...` w dowolnej postaci → klucz (pierwszeństwo) albo cyfry. */
export function parseInviteLink(raw: string): { linkKey: string | null; code: string | null } {
  const text = String(raw || '').trim();
  let linkKey: string | null = null;
  let code: string | null = null;
  try {
    const url = new URL(text.includes('://') ? text : `https://estateos.pl/${text.replace(/^\//, '')}`);
    const k = url.searchParams.get('k');
    if (k && LINK_KEY_RE.test(k)) linkKey = k;
    const seg = url.pathname.match(/\/app\/kod\/([^/?#]+)/i)?.[1] || '';
    if (!linkKey && LINK_KEY_RE.test(seg) && !CODE_RE.test(seg)) linkKey = seg;
    if (CODE_RE.test(seg)) code = seg;
  } catch {
    /* zwykły tekst */
  }
  if (!code && CODE_RE.test(text.replace(/\s/g, ''))) code = text.replace(/\s/g, '');
  return { linkKey, code };
}
