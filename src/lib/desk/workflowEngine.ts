import { prisma } from '@/lib/prisma';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';
import { syncChecklistsForCase, markOverdueChecklistAlerts } from '@/lib/desk/checklistEngine';
import type {
  DeskDispatchInput,
  DeskHealth,
  DeskTaskPriority,
  DeskTemperature,
  DeskWorkflowTrigger,
  SellPipelineStage,
} from '@/lib/desk/types';

type CaseRow = {
  id: number;
  agencyUserId: number;
  clientId: number;
  kind: string;
  pipelineStage: string;
  nextAction: string | null;
  nextActionAt: Date | null;
  temperature: string;
  health: string;
  lastContactedAt: Date | null;
  contractEndsAt: Date | null;
  lostReason: string | null;
};

async function writeTimeline(params: {
  clientId: number;
  agencyUserId: number;
  kind: string;
  title: string;
  body?: string | null;
  offerId?: number | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      kind: params.kind,
      title: params.title,
      body: params.body || null,
      offerId: params.offerId ?? null,
      metadata: (params.metadata || undefined) as object | undefined,
    },
  });
}

async function createTask(params: {
  agencyUserId: number;
  caseId: number;
  clientId: number;
  title: string;
  trigger: DeskWorkflowTrigger | string;
  dueAt?: Date | null;
  priority?: DeskTaskPriority;
}) {
  return prisma.deskTask.create({
    data: {
      agencyUserId: params.agencyUserId,
      caseId: params.caseId,
      clientId: params.clientId,
      title: params.title,
      status: 'OPEN',
      priority: params.priority || 'NORMAL',
      dueAt: params.dueAt ?? null,
      trigger: String(params.trigger),
    },
  });
}

async function setCaseState(
  caseId: number,
  patch: {
    pipelineStage?: string;
    nextAction?: string | null;
    nextActionAt?: Date | null;
    temperature?: DeskTemperature;
    health?: DeskHealth;
    lastContactedAt?: Date | null;
    contractEndsAt?: Date | null;
    lostReason?: string | null;
  },
) {
  return prisma.deskCase.update({
    where: { id: caseId },
    data: {
      ...(patch.pipelineStage != null ? { pipelineStage: patch.pipelineStage } : {}),
      ...(patch.nextAction !== undefined ? { nextAction: patch.nextAction } : {}),
      ...(patch.nextActionAt !== undefined ? { nextActionAt: patch.nextActionAt } : {}),
      ...(patch.temperature != null ? { temperature: patch.temperature } : {}),
      ...(patch.health != null ? { health: patch.health } : {}),
      ...(patch.lastContactedAt !== undefined ? { lastContactedAt: patch.lastContactedAt } : {}),
      ...(patch.contractEndsAt !== undefined ? { contractEndsAt: patch.contractEndsAt } : {}),
      ...(patch.lostReason !== undefined ? { lostReason: patch.lostReason } : {}),
    },
  });
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Central Desk workflow: TRIGGER → CONDITION → ACTION → TIMELINE → NEXT ACTION.
 * UI must not mutate pipeline stage / tasks without dispatching here.
 */
export async function dispatchDeskWorkflow(input: DeskDispatchInput) {
  await ensureDeskSchema();

  const deskCase = (await prisma.deskCase.findFirst({
    where: { id: input.caseId, agencyUserId: input.agencyUserId },
  })) as CaseRow | null;

  if (!deskCase) {
    throw new Error('DESK_CASE_NOT_FOUND');
  }

  const now = new Date();
  const payload = input.payload || {};

  switch (input.trigger) {
    case 'PROSPECT_CREATED': {
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_PROSPECT',
        title: 'Nowy prospect',
        body: typeof payload.source === 'string' ? `Źródło: ${payload.source}` : null,
        metadata: payload,
      });
      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Zadzwoń do właściciela',
        trigger: input.trigger,
        dueAt: hoursFromNow(4),
        priority: 'HIGH',
      });
      await setCaseState(deskCase.id, {
        pipelineStage: 'FOUND',
        nextAction: 'Zadzwoń do właściciela',
        nextActionAt: hoursFromNow(4),
        health: 'HEALTHY',
        temperature: 'WARM',
      });
      break;
    }

    case 'CALL_NO_ANSWER': {
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_CALL',
        title: 'Brak odpowiedzi',
        metadata: { outcome: 'NO_ANSWER', ...payload },
      });
      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Oddzwoń do właściciela',
        trigger: input.trigger,
        dueAt: hoursFromNow(24),
        priority: 'HIGH',
      });
      await setCaseState(deskCase.id, {
        pipelineStage: 'NO_ANSWER',
        nextAction: 'Oddzwoń',
        nextActionAt: hoursFromNow(24),
        lastContactedAt: now,
        health: 'ATTENTION',
      });
      break;
    }

    case 'CALL_CALLBACK': {
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_CALL',
        title: 'Prośba o oddzwonienie',
        metadata: { outcome: 'CALLBACK', ...payload },
      });
      const when =
        typeof payload.callbackAt === 'string' && !Number.isNaN(Date.parse(payload.callbackAt))
          ? new Date(payload.callbackAt)
          : hoursFromNow(4);
      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Oddzwoń (umówione)',
        trigger: input.trigger,
        dueAt: when,
        priority: 'URGENT',
      });
      await setCaseState(deskCase.id, {
        pipelineStage: 'CALLBACK',
        nextAction: 'Oddzwoń',
        nextActionAt: when,
        lastContactedAt: now,
        health: 'ATTENTION',
      });
      break;
    }

    case 'CALL_NOT_INTERESTED': {
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_CALL',
        title: 'Brak zainteresowania',
        metadata: { outcome: 'NOT_INTERESTED', ...payload },
      });
      await setCaseState(deskCase.id, {
        pipelineStage: 'LOST',
        nextAction: null,
        nextActionAt: null,
        lastContactedAt: now,
        temperature: 'COLD',
        health: 'HEALTHY',
        lostReason: typeof payload.reason === 'string' ? payload.reason : 'NOT_INTERESTED',
      });
      break;
    }

    case 'CALL_INTERESTED': {
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_CALL',
        title: 'Zainteresowany współpracą',
        metadata: { outcome: 'INTERESTED', ...payload },
      });
      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Umów spotkanie pozyskania',
        trigger: input.trigger,
        dueAt: hoursFromNow(24),
        priority: 'HIGH',
      });
      await setCaseState(deskCase.id, {
        pipelineStage: 'INTERESTED',
        nextAction: 'Umów spotkanie',
        nextActionAt: hoursFromNow(24),
        lastContactedAt: now,
        temperature: 'HOT',
        health: 'HEALTHY',
      });
      break;
    }

    case 'MEETING_BOOKED': {
      const startsAt =
        typeof payload.startsAt === 'string' && !Number.isNaN(Date.parse(payload.startsAt))
          ? new Date(payload.startsAt)
          : hoursFromNow(48);
      const location = typeof payload.location === 'string' ? payload.location : null;

      await prisma.agencyClientActivity.create({
        data: {
          clientId: deskCase.clientId,
          agencyUserId: input.agencyUserId,
          kind: 'ACQUISITION_MEETING',
          title: 'Spotkanie pozyskania',
          body: location,
          metadata: {
            startsAt: startsAt.toISOString(),
            location,
            status: 'confirmed',
            proposedBy: 'agent',
            prepItems: [],
            deskCaseId: deskCase.id,
          },
        },
      });

      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_MEETING',
        title: 'Spotkanie umówione',
        body: startsAt.toISOString(),
        metadata: { startsAt: startsAt.toISOString(), location },
      });

      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Przygotuj meeting brief',
        trigger: input.trigger,
        dueAt: new Date(startsAt.getTime() - 2 * 60 * 60 * 1000),
        priority: 'HIGH',
      });

      await setCaseState(deskCase.id, {
        pipelineStage: 'MEETING',
        nextAction: 'Przygotuj meeting brief',
        nextActionAt: new Date(startsAt.getTime() - 2 * 60 * 60 * 1000),
        lastContactedAt: now,
        temperature: 'HOT',
        health: 'HEALTHY',
      });
      break;
    }

    case 'MEETING_COMPLETED': {
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_MEETING',
        title: 'Spotkanie zakończone',
        metadata: payload,
      });
      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Uzupełnij kartę pozyskania',
        trigger: input.trigger,
        dueAt: hoursFromNow(12),
        priority: 'HIGH',
      });
      await setCaseState(deskCase.id, {
        pipelineStage: 'ACQUISITION',
        nextAction: 'Uzupełnij pozysk / checklistę',
        nextActionAt: hoursFromNow(12),
        health: 'HEALTHY',
      });
      break;
    }

    case 'CONTRACT_SIGNED': {
      const durationMonths = Number(payload.durationMonths || 6);
      const endsAt =
        typeof payload.contractEndsAt === 'string' && !Number.isNaN(Date.parse(payload.contractEndsAt))
          ? new Date(payload.contractEndsAt)
          : daysFromNow(Math.max(1, durationMonths) * 30);

      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_CONTRACT',
        title: 'Umowa podpisana',
        metadata: { contractEndsAt: endsAt.toISOString(), ...payload },
      });
      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Przygotuj listing (dane, zdjęcia, opis)',
        trigger: input.trigger,
        dueAt: hoursFromNow(48),
        priority: 'HIGH',
      });
      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Umowa kończy się — zaplanuj odnowienie',
        trigger: input.trigger,
        dueAt: new Date(endsAt.getTime() - 14 * 24 * 60 * 60 * 1000),
        priority: 'NORMAL',
      });
      await setCaseState(deskCase.id, {
        pipelineStage: 'CONTRACT',
        nextAction: 'Przygotuj listing',
        nextActionAt: hoursFromNow(48),
        contractEndsAt: endsAt,
        temperature: 'HOT',
        health: 'HEALTHY',
      });
      break;
    }

    case 'LISTING_PUBLISHED': {
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_LISTING',
        title: 'Oferta opublikowana',
        offerId: typeof payload.offerId === 'number' ? payload.offerId : null,
        metadata: payload,
      });
      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Uruchom marketing / share',
        trigger: input.trigger,
        dueAt: hoursFromNow(6),
        priority: 'HIGH',
      });
      await setCaseState(deskCase.id, {
        pipelineStage: 'LIVE',
        nextAction: 'Promuj ofertę + matching kupujących',
        nextActionAt: hoursFromNow(6),
        health: 'HEALTHY',
      });
      break;
    }

    case 'PRICE_CHANGED': {
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_PRICE_CHANGE',
        title: 'Zmiana ceny',
        offerId: typeof payload.offerId === 'number' ? payload.offerId : null,
        metadata: payload,
      });

      if (typeof payload.offerId === 'number') {
        try {
          const { matchPublishedOfferToAgencyClients } = await import('@/lib/agencyClientMatching');
          const offer = await prisma.offer.findUnique({ where: { id: payload.offerId } });
          if (offer) {
            await matchPublishedOfferToAgencyClients(offer as unknown as Record<string, unknown>);
          }
        } catch {
          /* matching best-effort */
        }
      }

      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Wyślij ofertę dopasowanym kupującym (Radar)',
        trigger: input.trigger,
        dueAt: hoursFromNow(2),
        priority: 'URGENT',
      });
      await setCaseState(deskCase.id, {
        nextAction: 'Powiadom HOT buyers o obniżce',
        nextActionAt: hoursFromNow(2),
        temperature: 'HOT',
        health: 'ATTENTION',
      });
      break;
    }

    case 'PRESENTATION_COMPLETED': {
      const hasDebrief = Boolean(payload.debrief);
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_DEBRIEF',
        title: hasDebrief ? 'Debrief prezentacji' : 'Prezentacja bez debriefu',
        offerId: typeof payload.offerId === 'number' ? payload.offerId : null,
        metadata: payload,
      });
      if (!hasDebrief) {
        await createTask({
          agencyUserId: input.agencyUserId,
          caseId: deskCase.id,
          clientId: deskCase.clientId,
          title: 'Zrób debrief prezentacji (15 s)',
          trigger: input.trigger,
          dueAt: hoursFromNow(1),
          priority: 'URGENT',
        });
        await setCaseState(deskCase.id, {
          nextAction: 'Zrób debrief',
          nextActionAt: hoursFromNow(1),
          health: 'AT_RISK',
        });
      } else {
        const temp = (['HOT', 'WARM', 'COLD'] as const).includes(payload.temperature as DeskTemperature)
          ? (payload.temperature as DeskTemperature)
          : 'WARM';
        const next =
          typeof payload.nextAction === 'string' && payload.nextAction.trim()
            ? payload.nextAction.trim()
            : 'Follow-up po prezentacji';
        const nextAt =
          typeof payload.nextActionAt === 'string' && !Number.isNaN(Date.parse(payload.nextActionAt))
            ? new Date(payload.nextActionAt)
            : hoursFromNow(24);
        await createTask({
          agencyUserId: input.agencyUserId,
          caseId: deskCase.id,
          clientId: deskCase.clientId,
          title: next,
          trigger: input.trigger,
          dueAt: nextAt,
          priority: temp === 'HOT' ? 'HIGH' : 'NORMAL',
        });
        await setCaseState(deskCase.id, {
          nextAction: next,
          nextActionAt: nextAt,
          temperature: temp,
          health: 'HEALTHY',
        });
      }
      break;
    }

    case 'OPEN_HOUSE_COMPLETED': {
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_OPEN_HOUSE',
        title: 'Open House zakończony',
        metadata: payload,
      });
      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Follow-up gości Open House',
        trigger: input.trigger,
        dueAt: hoursFromNow(12),
        priority: 'HIGH',
      });
      await setCaseState(deskCase.id, {
        nextAction: 'Follow-up gości OH',
        nextActionAt: hoursFromNow(12),
        health: 'ATTENTION',
      });
      break;
    }

    case 'BID_RECEIVED': {
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_BID',
        title: 'Wpłynęła oferta cenowa / bid',
        metadata: payload,
      });
      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Powiadom sprzedającego o ofercie',
        trigger: input.trigger,
        dueAt: hoursFromNow(2),
        priority: 'URGENT',
      });
      await setCaseState(deskCase.id, {
        pipelineStage: deskCase.kind === 'SELL' ? 'NEGOTIATION' : deskCase.pipelineStage,
        nextAction: 'Powiadom sprzedającego',
        nextActionAt: hoursFromNow(2),
        temperature: 'HOT',
        health: 'ATTENTION',
      });
      break;
    }

    case 'BUYER_QUALIFIED': {
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_STAGE',
        title: 'Kupujący skwalifikowany',
        metadata: payload,
      });
      try {
        const { refreshAgencyClientMatches } = await import('@/lib/agencyClientMatching');
        await refreshAgencyClientMatches(deskCase.clientId);
      } catch {
        /* matching best-effort */
      }
      await createTask({
        agencyUserId: input.agencyUserId,
        caseId: deskCase.id,
        clientId: deskCase.clientId,
        title: 'Wyślij 3 dopasowane oferty',
        trigger: input.trigger,
        dueAt: hoursFromNow(24),
        priority: 'HIGH',
      });
      await setCaseState(deskCase.id, {
        pipelineStage: 'MATCHING',
        nextAction: 'Wyślij 3 dopasowane oferty',
        nextActionAt: hoursFromNow(24),
        temperature: 'HOT',
        health: 'HEALTHY',
      });
      break;
    }

    case 'DEAL_FINALIZED': {
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_DEAL',
        title: 'Deal sfinalizowany',
        metadata: payload,
      });
      const aftercare = [
        { days: 7, title: 'Aftercare day 7 — check-in' },
        { days: 30, title: 'Aftercare day 30 — poproś o opinię' },
        { days: 180, title: 'Aftercare 6 mies. — utrzymanie relacji' },
        { days: 365, title: 'Aftercare 12 mies. — polecenie / reactivate' },
      ];
      for (const item of aftercare) {
        await createTask({
          agencyUserId: input.agencyUserId,
          caseId: deskCase.id,
          clientId: deskCase.clientId,
          title: item.title,
          trigger: input.trigger,
          dueAt: daysFromNow(item.days),
          priority: item.days <= 30 ? 'HIGH' : 'NORMAL',
        });
      }
      await setCaseState(deskCase.id, {
        pipelineStage: 'AFTERCARE',
        nextAction: 'Aftercare day 7 — check-in',
        nextActionAt: daysFromNow(7),
        temperature: 'WARM',
        health: 'HEALTHY',
      });
      break;
    }

    case 'MANUAL_STAGE': {
      const stage = String(payload.stage || '');
      if (!stage) break;
      await writeTimeline({
        clientId: deskCase.clientId,
        agencyUserId: input.agencyUserId,
        kind: 'DESK_STAGE',
        title: `Etap: ${stage}`,
        metadata: payload,
      });
      await setCaseState(deskCase.id, {
        pipelineStage: stage as SellPipelineStage,
        ...(typeof payload.nextAction === 'string'
          ? { nextAction: payload.nextAction, nextActionAt: hoursFromNow(24) }
          : {}),
      });
      break;
    }

    case 'SLA_SWEEP':
    case 'TASK_COMPLETED':
    default:
      break;
  }

  const updated = await prisma.deskCase.findUnique({ where: { id: deskCase.id } });
  if (updated && updated.pipelineStage !== deskCase.pipelineStage) {
    await syncChecklistsForCase({
      caseId: updated.id,
      agencyUserId: input.agencyUserId,
      clientId: updated.clientId,
      kind: updated.kind,
      pipelineStage: updated.pipelineStage,
    });
  }

  const openTask = await prisma.deskTask.findFirst({
    where: { caseId: deskCase.id, status: 'OPEN', trigger: { not: 'CHECKLIST' } },
    orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { id: 'asc' }],
  });

  return {
    case: updated,
    nextBestAction: openTask
      ? { id: openTask.id, title: openTask.title, dueAt: openTask.dueAt, priority: openTask.priority }
      : updated?.nextAction
        ? { id: null, title: updated.nextAction, dueAt: updated.nextActionAt, priority: 'NORMAL' }
        : null,
  };
}

export async function runDeskSlaSweep(agencyUserId: number) {
  await ensureDeskSchema();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  await markOverdueChecklistAlerts(agencyUserId);

  const cases = await prisma.deskCase.findMany({
    where: {
      agencyUserId,
      pipelineStage: { notIn: ['LOST', 'AFTERCARE', 'ACT'] },
    },
  });

  let touched = 0;
  for (const row of cases) {
    let health: DeskHealth | null = null;
    let nextAction: string | null = null;
    let nextActionAt: Date | null = null;

    if (row.nextActionAt && row.nextActionAt < now) {
      health = 'AT_RISK';
      nextAction = row.nextAction || 'Przeterminowany next action';
      nextActionAt = now;
    } else if (
      row.kind === 'BUY' &&
      row.pipelineStage === 'INQUIRY' &&
      row.createdAt < oneDayAgo &&
      (!row.lastContactedAt || row.lastContactedAt < oneDayAgo)
    ) {
      health = 'ATTENTION';
      nextAction = 'Lead bez odpowiedzi 24h — zadzwoń';
      nextActionAt = hoursFromNow(2);
    } else if (row.pipelineStage === 'CALLBACK' && row.nextActionAt && row.nextActionAt < now) {
      health = 'AT_RISK';
      nextAction = 'Callback przeterminowany — oddzwoń teraz';
      nextActionAt = now;
    } else if (row.lastContactedAt && row.lastContactedAt < sevenDaysAgo) {
      health = 'ATTENTION';
      nextAction = 'Brak kontaktu 7 dni — zadzwoń';
      nextActionAt = hoursFromNow(4);
    } else if (row.contractEndsAt && row.contractEndsAt <= in14Days && row.contractEndsAt > now) {
      health = 'ATTENTION';
      nextAction = 'Umowa kończy się w ciągu 14 dni';
      nextActionAt = row.contractEndsAt;
    }

    if (health) {
      await setCaseState(row.id, {
        health,
        ...(nextAction ? { nextAction, nextActionAt } : {}),
      });
      touched += 1;
    }
  }

  // Missing debrief — open urgent debrief tasks
  const debriefTasks = await prisma.deskTask.findMany({
    where: {
      agencyUserId,
      status: 'OPEN',
      title: { contains: 'debrief' },
      dueAt: { lt: now },
    },
    select: { caseId: true },
    distinct: ['caseId'],
  });
  for (const t of debriefTasks) {
    if (!t.caseId) continue;
    await setCaseState(t.caseId, {
      health: 'AT_RISK',
      nextAction: 'Zrób debrief prezentacji',
      nextActionAt: now,
    });
    touched += 1;
  }

  // OH / auction / presentation follow-up overdue
  const followUpTasks = await prisma.deskTask.findMany({
    where: {
      agencyUserId,
      status: 'OPEN',
      trigger: 'CHECKLIST',
      dueAt: { lt: now },
      OR: [
        { title: { contains: 'Follow-up' } },
        { title: { contains: 'follow-up' } },
        { title: { contains: 'OH' } },
        { title: { contains: 'aukcj' } },
      ],
    },
    select: { caseId: true },
    distinct: ['caseId'],
  });
  for (const t of followUpTasks) {
    if (!t.caseId) continue;
    await setCaseState(t.caseId, { health: 'ATTENTION' });
    touched += 1;
  }

  // HOT buyers on price drop cases
  const priceDropTasks = await prisma.deskTask.findMany({
    where: {
      agencyUserId,
      status: 'OPEN',
      title: { contains: 'Radar' },
    },
    include: { case: { select: { temperature: true } } },
  });
  for (const t of priceDropTasks) {
    if (t.case?.temperature !== 'HOT' && t.caseId) {
      await setCaseState(t.caseId, { temperature: 'HOT', health: 'ATTENTION' });
      touched += 1;
    }
  }

  // Listing expiry hint via linked offers
  const liveCases = cases.filter((c) => c.pipelineStage === 'LIVE' && c.linkedOfferId);
  for (const row of liveCases) {
    if (!row.linkedOfferId) continue;
    const offer = await prisma.offer.findUnique({
      where: { id: row.linkedOfferId },
      select: { expiresAt: true },
    });
    if (offer?.expiresAt && offer.expiresAt <= in5Days && offer.expiresAt > now) {
      await setCaseState(row.id, {
        health: 'ATTENTION',
        nextAction: 'Oferta wygasa za ≤5 dni — odnów publikację',
        nextActionAt: offer.expiresAt,
      });
      touched += 1;
    }
  }

  return { touched };
}
