import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/core/notification.core';
import { crmAgentPushData } from '@/lib/crm/agentPush';
import { withMysqlNamedLock } from '@/lib/crm/mysqlNamedLock';
import type { IntelligencePick } from '@/lib/crm/clientIntelligenceRun';
import { nextOwnerCallAttempt } from '@/lib/crm/intelligenceSchedule';

/**
 * Propozycje asystenta czekające na decyzję agenta (tryb „z akceptacją”
 * albo oferta, której ogłoszenie wygasło na portalu).
 * Jedna aktywność INTELLIGENCE_APPROVAL na ofertę; status w metadata.
 */
export const INTELLIGENCE_APPROVAL_KIND = 'INTELLIGENCE_APPROVAL';

export type ApprovalStatus = 'pending' | 'approved' | 'skipped';

export type PendingIntelligenceApproval = {
  activityId: number;
  offerId: number;
  title: string;
  score: number | null;
  clientWhy: string | null;
  sourceExpired: boolean;
  createdAt: string;
};

function meta(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Pola propozycji potrzebne do późniejszej wysyłki — bez ciężkich list (lessons). */
function snapshotPick(pick: IntelligencePick): Record<string, unknown> {
  return {
    offerId: pick.offerId,
    title: pick.title,
    city: pick.city,
    district: pick.district,
    price: pick.price,
    area: pick.area,
    score: pick.score,
    radarScore: pick.radarScore,
    reasons: pick.reasons,
    analysis: pick.analysis,
    tasteSummary: pick.tasteSummary,
    learnCount: pick.learnCount,
    calibrating: pick.calibrating,
    clientWhy: pick.clientWhy,
    sourceExpired: Boolean(pick.sourceExpired),
  };
}

function pickFromSnapshot(raw: unknown): IntelligencePick | null {
  const m = meta(raw);
  const offerId = Number(m.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) return null;
  const strings = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  const num = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    ready: true,
    skipReason: null,
    tasteSummary: String(m.tasteSummary || ''),
    learnCount: Number(m.learnCount || 0),
    calibrating: Boolean(m.calibrating),
    offerId,
    title: m.title != null ? String(m.title) : null,
    city: m.city != null ? String(m.city) : null,
    district: m.district != null ? String(m.district) : null,
    price: num(m.price),
    area: num(m.area),
    score: num(m.score),
    radarScore: num(m.radarScore),
    reasons: strings(m.reasons),
    analysis: strings(m.analysis),
    considered: 0,
    nextSendAt: null,
    correctedBalconyIds: [],
    clientWhy: m.clientWhy != null ? String(m.clientWhy) : null,
    lessons: [],
    sourceExpired: Boolean(m.sourceExpired),
  };
}

export async function getPendingIntelligenceApproval(clientId: number): Promise<PendingIntelligenceApproval | null> {
  const rows = await prisma.agencyClientActivity.findMany({
    where: { clientId, kind: INTELLIGENCE_APPROVAL_KIND },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, metadata: true, createdAt: true, offerId: true },
  });
  for (const row of rows) {
    const m = meta(row.metadata);
    if (m.status !== 'pending') continue;
    const pick = meta(m.pick);
    return {
      activityId: row.id,
      offerId: Number(row.offerId || pick.offerId),
      title: String(pick.title || ''),
      score: pick.score == null ? null : Number(pick.score),
      clientWhy: pick.clientWhy != null ? String(pick.clientWhy) : null,
      sourceExpired: Boolean(pick.sourceExpired),
      createdAt: row.createdAt.toISOString(),
    };
  }
  return null;
}

/** Oferty, o których agent już zdecydował albo które czekają na decyzję — asystent ich nie proponuje ponownie. */
export async function listDecidedApprovalOfferIds(clientId: number): Promise<number[]> {
  const rows = await prisma.agencyClientActivity.findMany({
    where: { clientId, kind: INTELLIGENCE_APPROVAL_KIND },
    select: { offerId: true, metadata: true },
  });
  const ids = new Set<number>();
  for (const row of rows) {
    const id = Number(row.offerId || meta(meta(row.metadata).pick).offerId);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return [...ids];
}

export async function createIntelligenceApproval(params: {
  clientId: number;
  agencyUserId: number;
  pick: IntelligencePick;
}): Promise<{ id: number; created: boolean } | null> {
  const offerId = params.pick.offerId;
  if (!offerId) return null;
  const existing = await prisma.agencyClientActivity.findFirst({
    where: { clientId: params.clientId, kind: INTELLIGENCE_APPROVAL_KIND, offerId },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const expired = Boolean(params.pick.sourceExpired);
  const title = params.pick.title || `Oferta #${offerId}`;
  const body = [
    params.pick.score != null ? `Dopasowanie ${params.pick.score}%.` : null,
    params.pick.clientWhy ? `Klient przeczyta: „${params.pick.clientWhy}”` : null,
    expired
      ? 'Ogłoszenie zniknęło z portalu. Zanim wyślesz, zadzwoń do właściciela (kontakt w notatce prywatnej oferty) i potwierdź, że nieruchomość jest dostępna.'
      : 'Zaakceptuj, a asystent wyśle propozycję klientowi. Możesz też pominąć — nie wróci.',
  ]
    .filter(Boolean)
    .join('\n');

  const row = await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      offerId,
      kind: INTELLIGENCE_APPROVAL_KIND,
      title: expired ? `Zadzwoń do właściciela: ${title}` : `Do akceptacji: ${title}`,
      body,
      metadata: {
        status: 'pending' satisfies ApprovalStatus,
        agentStatus: 'pending',
        sourceExpired: expired,
        pick: snapshotPick(params.pick),
      } as object,
    },
    select: { id: true },
  });

  const client = await prisma.agencyClient.findUnique({
    where: { id: params.clientId },
    select: { firstName: true, lastName: true },
  });
  const who = client ? `${client.firstName} ${client.lastName}`.trim() : `klient #${params.clientId}`;
  await sendNotification({
    userId: params.agencyUserId,
    type: 'CRM_EVENT',
    title: expired ? 'Oferta spoza internetu — zadzwoń do właściciela' : 'Asystent ma propozycję do akceptacji',
    body: `${who} · ${title}`,
    // Otwiera w aplikacji ekran „Dziś”, gdzie agent decyduje jednym dotykiem.
    data: crmAgentPushData(params.clientId, {
      kind: INTELLIGENCE_APPROVAL_KIND,
      activityId: row.id,
      offerId,
      screen: 'AgencyToday',
      route: 'AgencyToday',
    }),
    idempotencyKey: `intelligence-approval-${row.id}`,
  }).catch(() => {});

  return { id: row.id, created: true };
}

async function loadApproval(clientId: number, activityId: number) {
  const row = await prisma.agencyClientActivity.findFirst({
    where: { id: activityId, clientId, kind: INTELLIGENCE_APPROVAL_KIND },
    select: { id: true, agencyUserId: true, metadata: true },
  });
  return row;
}

/** Agent akceptuje: propozycja idzie do klienta dokładnie w przygotowanej formie. */
export async function approveIntelligenceApproval(params: {
  clientId: number;
  agencyUserId: number;
  activityId: number;
}): Promise<{ ok: boolean; error?: string; sent?: boolean; emailSent?: boolean }> {
  const locked = await withMysqlNamedLock(`eos-intel-${params.clientId}`, async () => {
    const row = await loadApproval(params.clientId, params.activityId);
    if (!row) return { ok: false, error: 'Nie znaleziono propozycji.' };
    const m = meta(row.metadata);
    if (m.status !== 'pending') return { ok: false, error: 'Ta propozycja została już rozpatrzona.' };
    const pick = pickFromSnapshot(m.pick);
    if (!pick?.offerId) return { ok: false, error: 'Propozycja jest niekompletna.' };

    const { deliverIntelligencePick } = await import('@/lib/crm/clientIntelligenceRun');
    const delivered = await deliverIntelligencePick({
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      pick,
      channel: 'email',
    });
    await prisma.agencyClientActivity.update({
      where: { id: row.id },
      data: {
        metadata: {
          ...m,
          status: delivered.alreadyNotified ? 'skipped' : 'approved',
          agentStatus: 'done',
          decidedAt: new Date().toISOString(),
          decidedBy: params.agencyUserId,
          ...(delivered.alreadyNotified ? { note: 'Oferta była już wcześniej wysłana temu klientowi.' } : {}),
        } as object,
      },
    });
    if (delivered.alreadyNotified) {
      return { ok: false, error: 'Ta oferta była już wcześniej wysłana temu klientowi.' };
    }
    return { ok: true, sent: true, emailSent: delivered.emailSent };
  });
  if (!locked.ok) return { ok: false, error: 'Asystent właśnie pracuje nad tym klientem — spróbuj za chwilę.' };
  return locked.value;
}

/** Agent pomija: oferta nie wróci do tego klienta. */
export async function skipIntelligenceApproval(params: {
  clientId: number;
  agencyUserId: number;
  activityId: number;
  reason?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const locked = await withMysqlNamedLock(`eos-intel-${params.clientId}`, () => skipUnlocked(params));
  if (!locked.ok) return { ok: false, error: 'Asystent właśnie pracuje nad tym klientem — spróbuj za chwilę.' };
  return locked.value;
}

async function skipUnlocked(params: {
  clientId: number;
  agencyUserId: number;
  activityId: number;
  reason?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const row = await loadApproval(params.clientId, params.activityId);
  if (!row) return { ok: false, error: 'Nie znaleziono propozycji.' };
  const m = meta(row.metadata);
  if (m.status !== 'pending') return { ok: false, error: 'Ta propozycja została już rozpatrzona.' };
  await prisma.agencyClientActivity.update({
    where: { id: row.id },
    data: {
      metadata: {
        ...m,
        status: 'skipped',
        agentStatus: 'done',
        decidedAt: new Date().toISOString(),
        decidedBy: params.agencyUserId,
        skipReason: params.reason ? String(params.reason).slice(0, 300) : null,
      } as object,
    },
  });
  return { ok: true };
}

export type OwnerCallOutcome = 'available' | 'sold' | 'no_answer';

/**
 * Wynik rozmowy z właścicielem oferty, której ogłoszenie zniknęło z portali:
 * - available → propozycja od razu idzie do klienta,
 * - sold → propozycja odpada u wszystkich klientów, oferta wypada z bazy,
 * - no_answer → przypomnienie o kolejnej próbie.
 */
export async function recordOwnerCallOutcome(params: {
  agencyUserId: number;
  activityId: number;
  outcome: OwnerCallOutcome;
  note?: string | null;
}): Promise<{ ok: boolean; error?: string; sent?: boolean; snoozedUntil?: string; skippedOthers?: number }> {
  const row = await prisma.agencyClientActivity.findFirst({
    where: { id: params.activityId, agencyUserId: params.agencyUserId, kind: INTELLIGENCE_APPROVAL_KIND },
    select: { id: true, clientId: true, offerId: true, metadata: true },
  });
  if (!row) return { ok: false, error: 'Nie znaleziono propozycji.' };
  const m = meta(row.metadata);
  if (m.status !== 'pending') return { ok: false, error: 'Ta propozycja została już rozpatrzona.' };

  const calls = Array.isArray(m.ownerCalls) ? [...(m.ownerCalls as unknown[])] : [];
  calls.push({
    at: new Date().toISOString(),
    outcome: params.outcome,
    by: params.agencyUserId,
    note: params.note ? String(params.note).slice(0, 300) : null,
  });

  if (params.outcome === 'no_answer') {
    const snoozedUntil = nextOwnerCallAttempt();
    await prisma.agencyClientActivity.update({
      where: { id: row.id },
      data: { metadata: { ...m, ownerCalls: calls, snoozedUntil: snoozedUntil.toISOString() } as object },
    });
    return { ok: true, snoozedUntil: snoozedUntil.toISOString() };
  }

  if (params.outcome === 'available') {
    await prisma.agencyClientActivity.update({
      where: { id: row.id },
      data: { metadata: { ...m, ownerCalls: calls, ownerConfirmedAt: new Date().toISOString() } as object },
    });
    const approved = await approveIntelligenceApproval({
      clientId: row.clientId,
      agencyUserId: params.agencyUserId,
      activityId: row.id,
    });
    return approved.ok ? { ok: true, sent: true } : { ok: false, error: approved.error };
  }

  // sold — ta oferta nie wróci do żadnego klienta.
  await prisma.agencyClientActivity.update({
    where: { id: row.id },
    data: {
      metadata: {
        ...m,
        ownerCalls: calls,
        status: 'skipped' satisfies ApprovalStatus,
        agentStatus: 'done',
        decidedAt: new Date().toISOString(),
        decidedBy: params.agencyUserId,
        skipReason: 'Właściciel: nieruchomość sprzedana.',
      } as object,
    },
  });
  let skippedOthers = 0;
  if (row.offerId) {
    const others = await prisma.agencyClientActivity.findMany({
      where: { kind: INTELLIGENCE_APPROVAL_KIND, offerId: row.offerId, id: { not: row.id } },
      select: { id: true, metadata: true },
    });
    for (const other of others) {
      const om = meta(other.metadata);
      if (om.status !== 'pending') continue;
      await prisma.agencyClientActivity.update({
        where: { id: other.id },
        data: {
          metadata: {
            ...om,
            status: 'skipped' satisfies ApprovalStatus,
            agentStatus: 'done',
            decidedAt: new Date().toISOString(),
            skipReason: 'Właściciel: nieruchomość sprzedana.',
          } as object,
        },
      });
      skippedOthers += 1;
    }
    const [offer, actor] = await Promise.all([
      prisma.offer.findUnique({ where: { id: row.offerId }, select: { userId: true, status: true } }),
      prisma.user.findUnique({ where: { id: params.agencyUserId }, select: { role: true } }),
    ]);
    const canArchive =
      offer && (String(actor?.role || '').toUpperCase() === 'ADMIN' || offer.userId === params.agencyUserId);
    if (canArchive && offer.status === 'ACTIVE') {
      await prisma.offer.update({ where: { id: row.offerId }, data: { status: 'ARCHIVED' } });
    }
  }
  return { ok: true, skippedOthers };
}
