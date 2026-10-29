import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Dostęp do panelu klienta v2:
 *  - token właściciela panelu (AgencyClient.portalToken) albo token drugiej osoby (AgencyClientCompanion),
 *  - uprawnienia, które agent nadaje klientowi.
 */

export type PortalViewer =
  | { role: 'owner' }
  | { role: 'partner'; companionId: number; name: string };

export type PortalAccess = {
  portalToken: string;
  viewer: PortalViewer;
};

export async function resolvePortalAccess(token: string): Promise<PortalAccess | null> {
  const raw = String(token || '').trim();
  if (!raw) return null;
  const owner = await prisma.agencyClient.findFirst({
    where: { portalToken: raw, status: 'ACTIVE' },
    select: { portalToken: true },
  });
  if (owner?.portalToken) return { portalToken: owner.portalToken, viewer: { role: 'owner' } };
  const companion = await prisma.agencyClientCompanion
    .findUnique({ where: { token: raw }, select: { id: true, clientId: true, name: true, revokedAt: true } })
    .catch(() => null);
  if (!companion || companion.revokedAt) return null;
  const client = await prisma.agencyClient.findFirst({
    where: { id: companion.clientId, status: 'ACTIVE' },
    select: { portalToken: true },
  });
  if (!client?.portalToken) return null;
  void prisma.agencyClientCompanion
    .update({ where: { id: companion.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});
  return {
    portalToken: client.portalToken,
    viewer: { role: 'partner', companionId: companion.id, name: companion.name },
  };
}

/** Akcje, które może wykonać druga osoba (reszta zostaje dla właściciela panelu). */
export const PARTNER_ALLOWED_ACTIONS = new Set([
  'set_locale',
  'partner_feedback',
  'list_messages',
  'mark_messages_read',
  'typing',
  'send_message',
  'list_free_slots',
  'send_referral',
]);

export type PortalPermissions = {
  /** Klient sam wybiera wolny termin oglądania (agent zatwierdza). */
  selfBooking: boolean;
  /** Zmiana kryteriów (np. obszar na mapie) bez akceptacji agenta. */
  criteriaEdit: boolean;
  /** Oferty przed publikacją. */
  earlyAccess: boolean;
  /** Klient może zaprosić drugą osobę. */
  partnerAccess: boolean;
  /** Sprzedający: statystyki, opinie z oglądań, konkurencja, raport tygodniowy. */
  sellerStats: boolean;
  sellerFeedback: boolean;
  sellerCompetition: boolean;
  weeklyDigest: boolean;
  /** Przypomnienie dzień przed i ok. 2 h przed potwierdzonym oglądaniem / spotkaniem. */
  viewingReminders: boolean;
  /** Lista dokumentów z wrzucaniem plików. */
  documents: boolean;
};

export const DEFAULT_PORTAL_PERMISSIONS: PortalPermissions = {
  selfBooking: true,
  criteriaEdit: false,
  earlyAccess: true,
  partnerAccess: true,
  sellerStats: true,
  sellerFeedback: true,
  sellerCompetition: true,
  weeklyDigest: true,
  viewingReminders: true,
  documents: true,
};

export function parsePortalPermissions(raw: unknown): PortalPermissions {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_PORTAL_PERMISSIONS };
  for (const key of Object.keys(out) as Array<keyof PortalPermissions>) {
    if (typeof value[key] === 'boolean') out[key] = value[key] as boolean;
  }
  return out;
}

export function mergePortalPermissions(current: unknown, patch: unknown): PortalPermissions {
  const base = parsePortalPermissions(current);
  const next = patch && typeof patch === 'object' ? (patch as Record<string, unknown>) : {};
  for (const key of Object.keys(base) as Array<keyof PortalPermissions>) {
    if (typeof next[key] === 'boolean') base[key] = next[key] as boolean;
  }
  return base;
}

// ── Druga osoba ───────────────────────────────────────────────────────────────

export async function createPortalCompanion(clientId: number, name: string) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Druga osoba';
  const active = await prisma.agencyClientCompanion.count({ where: { clientId, revokedAt: null } });
  if (active >= 3) throw new Error('Można zaprosić najwyżej 3 osoby.');
  const token = `p_${crypto.randomBytes(18).toString('base64url')}`;
  return prisma.agencyClientCompanion.create({
    data: { clientId, token, name: clean },
    select: { id: true, token: true, name: true, createdAt: true },
  });
}

export async function listPortalCompanions(clientId: number) {
  return prisma.agencyClientCompanion
    .findMany({
      where: { clientId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, token: true, name: true, createdAt: true, lastSeenAt: true },
    })
    .catch(() => []);
}

export async function revokePortalCompanion(clientId: number, companionId: number) {
  await prisma.agencyClientCompanion.updateMany({
    where: { id: companionId, clientId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export type CompanionFeedbackRow = {
  companionId: number;
  name: string;
  sentiment: 'like' | 'maybe' | 'dislike';
  note: string | null;
  at: string;
};

export async function loadCompanionFeedback(clientId: number, matchIds: number[]) {
  const map = new Map<number, CompanionFeedbackRow[]>();
  if (!matchIds.length) return map;
  const companions = await listPortalCompanions(clientId);
  if (!companions.length) return map;
  const names = new Map(companions.map((c) => [c.id, c.name]));
  const rows = await prisma.agencyClientCompanionFeedback
    .findMany({ where: { matchId: { in: matchIds }, companionId: { in: companions.map((c) => c.id) } } })
    .catch(() => []);
  for (const row of rows) {
    const list = map.get(row.matchId) || [];
    list.push({
      companionId: row.companionId,
      name: names.get(row.companionId) || 'Druga osoba',
      sentiment: (['like', 'maybe', 'dislike'].includes(row.sentiment) ? row.sentiment : 'maybe') as CompanionFeedbackRow['sentiment'],
      note: row.note,
      at: row.updatedAt.toISOString(),
    });
    map.set(row.matchId, list);
  }
  return map;
}

export async function saveCompanionFeedback(params: {
  clientId: number;
  companionId: number;
  matchId: number;
  sentiment: string;
  note?: string | null;
}) {
  const sentiment = ['like', 'maybe', 'dislike'].includes(params.sentiment) ? params.sentiment : null;
  if (!sentiment) throw new Error('Wybierz ocenę.');
  const match = await prisma.agencyClientMatch.findFirst({
    where: { id: params.matchId, clientId: params.clientId },
    select: { id: true },
  });
  if (!match) throw new Error('Nie znaleziono oferty.');
  const note = String(params.note || '').trim().slice(0, 500) || null;
  await prisma.agencyClientCompanionFeedback.upsert({
    where: { companionId_matchId: { companionId: params.companionId, matchId: params.matchId } },
    create: { companionId: params.companionId, matchId: params.matchId, sentiment, note },
    update: { sentiment, note, updatedAt: new Date() },
  });
}
