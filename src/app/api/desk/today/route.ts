import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { fetchUpcomingScheduleEvents } from '@/lib/crm/upcomingScheduleEvents';
import { isSameWarsawDay } from '@/lib/crm/scheduleIdentity';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';
import { backfillDeskCasesForAgency } from '@/lib/desk/prospects';
import { runDeskSlaSweep } from '@/lib/desk/workflowEngine';

export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  await ensureDeskSchema();
  await backfillDeskCasesForAgency(agencyUserId);
  await runDeskSlaSweep(agencyUserId);

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  const [
    schedule,
    openTasks,
    attentionCases,
    ohEvents,
    auctionEvents,
    photoSessions,
    noContact,
    expiringContracts,
    expiringOffers,
    pendingLeads,
  ] = await Promise.all([
    fetchUpcomingScheduleEvents(agencyUserId),
    prisma.deskTask.findMany({
      where: {
        agencyUserId,
        status: 'OPEN',
        OR: [{ dueAt: null }, { dueAt: { lte: end } }],
      },
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
      take: 40,
      include: {
        case: {
          select: {
            id: true,
            title: true,
            pipelineStage: true,
            health: true,
            temperature: true,
          },
        },
      },
    }),
    prisma.deskCase.findMany({
      where: {
        agencyUserId,
        OR: [
          { health: { in: ['AT_RISK', 'ATTENTION'] } },
          { temperature: 'HOT' },
          { nextActionAt: { lte: now } },
        ],
        pipelineStage: { notIn: ['LOST'] },
      },
      orderBy: [{ health: 'asc' }, { nextActionAt: 'asc' }],
      take: 12,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        tasks: { where: { status: 'OPEN' }, take: 1, orderBy: { dueAt: 'asc' } },
      },
    }),
    prisma.openHouseEvent.findMany({
      where: {
        hostUserId: agencyUserId,
        slots: { some: { startsAt: { gte: start, lte: end } } },
      },
      take: 10,
      select: {
        id: true,
        offerId: true,
        status: true,
        offer: { select: { title: true, street: true, city: true } },
        slots: {
          where: { startsAt: { gte: start, lte: end } },
          orderBy: { startsAt: 'asc' },
          take: 1,
          select: { startsAt: true },
        },
      },
    }).catch(() => []),
    prisma.auctionEvent.findMany({
      where: {
        hostUserId: agencyUserId,
        OR: [
          { startsAt: { gte: start, lte: end } },
          { endsAt: { gte: start, lte: end } },
        ],
      },
      take: 10,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        offerId: true,
        status: true,
        offer: { select: { title: true } },
      },
    }).catch(() => []),
    prisma.photoSessionRequest.findMany({
      where: {
        userId: agencyUserId,
        proposedAt: { gte: start, lte: end },
      },
      take: 10,
      select: { id: true, proposedAt: true, propertyLabel: true, status: true },
    }).catch(() => []),
    prisma.deskCase.count({
      where: {
        agencyUserId,
        pipelineStage: { notIn: ['LOST', 'AFTERCARE', 'ACT'] },
        OR: [{ lastContactedAt: { lt: sevenDaysAgo } }, { lastContactedAt: null, createdAt: { lt: sevenDaysAgo } }],
      },
    }),
    prisma.deskCase.count({
      where: {
        agencyUserId,
        contractEndsAt: { gte: now, lte: in14Days },
      },
    }),
    prisma.offer.count({
      where: {
        userId: agencyUserId,
        status: 'ACTIVE',
        expiresAt: { gte: now, lte: in5Days },
      },
    }),
    prisma.leadTransfer.count({
      where: {
        agencyId: agencyUserId,
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }).catch(() => 0),
  ]);

  const todaySchedule = schedule
    .filter((ev) => isSameWarsawDay(ev.startsAt, now))
    .map((ev) => ({
      id: `sch-${ev.id}`,
      kind: ev.kind || 'schedule',
      title: ev.title,
      subtitle: ev.subtitle || ev.location || null,
      startsAt: ev.startsAt,
      href: '/crm/calendar',
      caseId: null as number | null,
    }));

  const scheduledFamilies = new Set(
    todaySchedule.map((ev) => {
      const minute = ev.startsAt ? Math.floor(new Date(ev.startsAt).getTime() / 60_000) : 0;
      const family = String(ev.kind).includes('open_house')
        ? 'open_house'
        : String(ev.kind).includes('presentation')
          ? 'presentation'
          : ev.kind;
      return `${family}:${minute}`;
    }),
  );

  const ohToday = (ohEvents as any[]).map((ev) => ({
    id: `oh-${ev.id}`,
    kind: 'open_house',
    title: `Open House · ${ev.offer?.title || `#${ev.offerId}`}`,
    subtitle: [ev.offer?.street, ev.offer?.city].filter(Boolean).join(', '),
    startsAt: ev.slots?.[0]?.startsAt?.toISOString?.() || ev.slots?.[0]?.startsAt || null,
    href: '/crm/calendar',
    caseId: null as number | null,
  }));

  const auctionToday = (auctionEvents as any[]).map((ev) => ({
    id: `auc-${ev.id}`,
    kind: 'auction',
    title: `Aukcja · ${ev.offer?.title || `#${ev.offerId}`}`,
    subtitle: ev.status,
    startsAt: ev.startsAt?.toISOString?.() || ev.startsAt,
    href: '/crm/calendar',
    caseId: null as number | null,
  }));

  const photoToday = (photoSessions as any[]).map((s) => ({
    id: `photo-${s.id}`,
    kind: 'photo_session',
    title: `Sesja · ${s.propertyLabel || 'Nieruchomość'}`,
    subtitle: s.status,
    startsAt: s.proposedAt?.toISOString?.() || s.proposedAt,
    href: '/crm/calendar',
    caseId: null as number | null,
  }));

  const taskCalls = openTasks
    .filter((t) => /zadzwoń|oddzwoń|call|telefon/i.test(t.title))
    .map((t) => ({
      id: `task-${t.id}`,
      kind: 'call',
      title: t.title,
      subtitle: t.case?.title || null,
      startsAt: t.dueAt?.toISOString?.() || null,
      href: '/crm',
      caseId: t.caseId,
    }));

  const extras = [...ohToday, ...auctionToday, ...photoToday, ...taskCalls].filter((item) => {
    if (!item.startsAt) return true;
    const minute = Math.floor(new Date(item.startsAt).getTime() / 60_000);
    const family = String(item.kind).includes('open_house')
      ? 'open_house'
      : String(item.kind).includes('presentation')
        ? 'presentation'
        : item.kind;
    return !scheduledFamilies.has(`${family}:${minute}`);
  });

  const timeline = [
    ...todaySchedule,
    ...extras,
  ].sort((a, b) => {
    const ta = a.startsAt ? new Date(a.startsAt).getTime() : 0;
    const tb = b.startsAt ? new Date(b.startsAt).getTime() : 0;
    return ta - tb;
  });

  const nextBestAction = openTasks[0]
    ? {
        id: openTasks[0].id,
        title: openTasks[0].title,
        dueAt: openTasks[0].dueAt,
        priority: openTasks[0].priority,
        caseId: openTasks[0].caseId,
        caseTitle: openTasks[0].case?.title || null,
      }
    : attentionCases[0]
      ? {
          id: 0,
          title: attentionCases[0].nextAction || `Otwórz sprawę · ${attentionCases[0].pipelineStage}`,
          dueAt: attentionCases[0].nextActionAt,
          priority: 'HIGH',
          caseId: attentionCases[0].id,
          caseTitle: attentionCases[0].title,
        }
      : null;

  const alerts = [
    attentionCases.filter((c) => c.health === 'AT_RISK').length
      ? {
          level: 'danger',
          text: `${attentionCases.filter((c) => c.health === 'AT_RISK').length} spraw w strefie ryzyka`,
        }
      : null,
    noContact
      ? { level: 'warn', text: `${noContact} spraw bez kontaktu ≥7 dni` }
      : null,
    pendingLeads
      ? { level: 'warn', text: `${pendingLeads} leadów concierge bez odpowiedzi (24h)` }
      : null,
    expiringContracts
      ? { level: 'warn', text: `${expiringContracts} umów kończy się ≤14 dni` }
      : null,
    expiringOffers
      ? { level: 'warn', text: `${expiringOffers} ofert wygasa ≤5 dni` }
      : null,
    openTasks.filter((t) => t.dueAt && t.dueAt < now).length
      ? {
          level: 'warn',
          text: `${openTasks.filter((t) => t.dueAt && t.dueAt < now).length} przeterminowanych zadań`,
        }
      : null,
  ].filter(Boolean);

  return NextResponse.json({
    success: true,
    today: {
      timeline,
      whatMattersMost: attentionCases,
      openTasks,
      nextBestAction,
      alerts,
    },
  });
}
