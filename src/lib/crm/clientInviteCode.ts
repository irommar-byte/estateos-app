import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Kod zaproszenia do aplikacji EstateOS: 6 cyfr (albo QR z tym samym kodem).
 * Klient wpisuje go na ekranie startowym i aplikacja otwiera jego panel — bez zakładania konta.
 */

const CODE_RE = /^\d{6}$/;

function randomCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Aktywny kod klienta (tworzy, jeśli go nie ma). */
export async function ensureClientInviteCode(clientId: number, companionId: number | null = null): Promise<string> {
  const existing = await prisma.clientInviteCode.findFirst({
    where: { clientId, companionId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { code: true },
  });
  if (existing) return existing.code;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomCode();
    try {
      await prisma.clientInviteCode.create({ data: { code, clientId, companionId } });
      return code;
    } catch {
      /* kolizja — losujemy dalej */
    }
  }
  throw new Error('Nie udało się wygenerować kodu — spróbuj ponownie.');
}

export async function regenerateClientInviteCode(clientId: number, companionId: number | null = null): Promise<string> {
  await prisma.clientInviteCode.updateMany({
    where: { clientId, companionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return ensureClientInviteCode(clientId, companionId);
}

/** Link w QR: otwiera aplikację (albo panel w przeglądarce, gdy aplikacji nie ma). */
export function inviteDeepLink(code: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://estateos.pl').replace(/\/+$/, '');
  return `${base}/app/kod/${code}`;
}

const attempts = new Map<string, { count: number; until: number }>();

export function inviteRateLimited(key: string): boolean {
  const now = Date.now();
  const row = attempts.get(key);
  if (!row || row.until < now) {
    attempts.set(key, { count: 1, until: now + 15 * 60 * 1000 });
    return false;
  }
  row.count += 1;
  return row.count > 20;
}

/** Zamienia kod na token panelu (właściciela albo drugiej osoby). */
export async function redeemClientInviteCode(rawCode: string): Promise<{ portalToken: string; clientId: number } | null> {
  const code = String(rawCode || '').replace(/\D/g, '');
  if (!CODE_RE.test(code)) return null;
  const row = await prisma.clientInviteCode.findUnique({ where: { code } });
  if (!row || row.revokedAt) return null;
  let portalToken: string | null = null;
  if (row.companionId) {
    const companion = await prisma.agencyClientCompanion.findUnique({ where: { id: row.companionId } });
    if (companion && !companion.revokedAt) portalToken = companion.token;
  } else {
    const client = await prisma.agencyClient.findFirst({
      where: { id: row.clientId, status: 'ACTIVE' },
      select: { portalToken: true },
    });
    portalToken = client?.portalToken || null;
  }
  if (!portalToken) return null;
  if (!row.redeemedAt) {
    await prisma.clientInviteCode.update({ where: { id: row.id }, data: { redeemedAt: new Date() } }).catch(() => {});
  }
  return { portalToken, clientId: row.clientId };
}
