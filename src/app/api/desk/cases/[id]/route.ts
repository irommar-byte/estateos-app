import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';
import { dispatchDeskWorkflow } from '@/lib/desk/workflowEngine';
import { buildAggregateDeskTimeline } from '@/lib/desk/aggregateTimeline';
import { contractDaysRemaining } from '@/lib/desk/timeline';
import { listChecklistTasks } from '@/lib/desk/checklistEngine';
import { parseQualificationFromMetadata } from '@/lib/desk/buyerQualification';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  await ensureDeskSchema();
  const { id } = await ctx.params;
  const caseId = Number(id);
  if (!Number.isFinite(caseId)) {
    return NextResponse.json({ error: 'Nieprawidłowe ID sprawy.' }, { status: 400 });
  }

  const deskCase = await prisma.deskCase.findFirst({
    where: { id: caseId, agencyUserId },
    include: {
      client: {
        include: {
          activities: { orderBy: { createdAt: 'desc' }, take: 80 },
          acquisition: true,
          buyerPreference: true,
          matches: {
            orderBy: { score: 'desc' },
            take: 40,
            include: {
              offer: {
                select: {
                  id: true,
                  title: true,
                  pricePln: true,
                  city: true,
                  district: true,
                  street: true,
                  area: true,
                  rooms: true,
                  status: true,
                  images: true,
                },
              },
            },
          },
        },
      },
      tasks: { orderBy: [{ status: 'asc' }, { dueAt: 'asc' }], take: 50 },
    },
  });

  if (!deskCase) {
    return NextResponse.json({ error: 'Nie znaleziono sprawy.' }, { status: 404 });
  }

  const linkedOfferId = deskCase.linkedOfferId || deskCase.client.linkedOfferId;
  const linkedOffer = linkedOfferId
    ? await prisma.offer.findUnique({
        where: { id: linkedOfferId },
        select: {
          id: true,
          title: true,
          status: true,
          pricePln: true,
          listPricePln: true,
          city: true,
          district: true,
          street: true,
          area: true,
          rooms: true,
          expiresAt: true,
          images: true,
          agentCommissionPercent: true,
          userId: true,
        },
      })
    : null;

  let matchingBuyers: Array<{
    clientId: number;
    name: string;
    score: number;
    phone: string | null;
    email: string | null;
    temperature?: string | null;
  }> = [];

  if (linkedOffer && deskCase.kind === 'SELL') {
    const prefs = await prisma.agencyClientMatch.findMany({
      where: { offerId: linkedOffer.id },
      orderBy: { score: 'desc' },
      take: 30,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            agencyUserId: true,
            deskCases: {
              where: { kind: 'BUY' },
              take: 1,
              select: { temperature: true },
            },
          },
        },
      },
    });
    matchingBuyers = prefs
      .filter((m) => m.client.agencyUserId === agencyUserId)
      .map((m) => ({
        clientId: m.client.id,
        name: `${m.client.firstName} ${m.client.lastName}`.trim(),
        score: m.score,
        phone: m.client.phone,
        email: m.client.email,
        temperature: m.client.deskCases[0]?.temperature || null,
      }));
  }

  const siblingCases = await prisma.deskCase.findMany({
    where: {
      agencyUserId,
      clientId: deskCase.clientId,
      id: { not: deskCase.id },
    },
    select: { id: true, kind: true, pipelineStage: true, title: true },
  });

  const openTask = deskCase.tasks.find((t) => t.status === 'OPEN' && t.trigger !== 'CHECKLIST') || null;
  const checklist = await listChecklistTasks(caseId);
  const timeline = await buildAggregateDeskTimeline({
    clientId: deskCase.clientId,
    caseId,
    agencyUserId,
    linkedOfferId,
    activities: deskCase.client.activities,
    tasks: deskCase.tasks,
  });

  const qualification = parseQualificationFromMetadata(deskCase.metadata);

  const acquisition = deskCase.client.acquisition;
  const coop =
    acquisition?.formData && typeof acquisition.formData === 'object'
      ? ((acquisition.formData as Record<string, unknown>).cooperation as Record<string, unknown> | undefined)
      : undefined;

  return NextResponse.json({
    success: true,
    case: deskCase,
    linkedOffer,
    matchingBuyers,
    siblingCases,
    timeline,
    checklist,
    qualification,
    contract: {
      signedAt: acquisition?.signedAt || null,
      status: acquisition?.status || null,
      agreementType: coop?.agreementType || null,
      commissionType: coop?.commissionType || null,
      commissionValue: coop?.commissionValue || null,
      durationMonths: coop?.durationMonths || null,
      endsAt: deskCase.contractEndsAt,
      daysRemaining: contractDaysRemaining(deskCase.contractEndsAt),
      documentHash: acquisition?.documentHash || null,
    },
    nextBestAction: openTask
      ? { id: openTask.id, title: openTask.title, dueAt: openTask.dueAt, priority: openTask.priority }
      : deskCase.nextAction
        ? { id: null, title: deskCase.nextAction, dueAt: deskCase.nextActionAt, priority: 'NORMAL' }
        : null,
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  await ensureDeskSchema();
  const { id } = await ctx.params;
  const caseId = Number(id);
  if (!Number.isFinite(caseId)) {
    return NextResponse.json({ error: 'Nieprawidłowe ID sprawy.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.stage) {
    const result = await dispatchDeskWorkflow({
      agencyUserId,
      caseId,
      trigger: 'MANUAL_STAGE',
      payload: { stage: String(body.stage), nextAction: body.nextAction },
    });
    return NextResponse.json({ success: true, ...result });
  }

  if (body.action === 'add_note') {
    const deskCase = await prisma.deskCase.findFirst({
      where: { id: caseId, agencyUserId },
      select: { clientId: true },
    });
    if (!deskCase) {
      return NextResponse.json({ error: 'Nie znaleziono sprawy.' }, { status: 404 });
    }
    await prisma.agencyClientActivity.create({
      data: {
        clientId: deskCase.clientId,
        agencyUserId,
        kind: 'DESK_NOTE',
        title: 'Notatka',
        body: String(body.note || '').trim() || null,
      },
    });
    await prisma.deskCase.update({
      where: { id: caseId },
      data: { lastContactedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'refresh_matches') {
    const deskCase = await prisma.deskCase.findFirst({
      where: { id: caseId, agencyUserId },
      select: { clientId: true, kind: true },
    });
    if (!deskCase) {
      return NextResponse.json({ error: 'Nie znaleziono sprawy.' }, { status: 404 });
    }
    if (deskCase.kind === 'BUY') {
      const { refreshAgencyClientMatches } = await import('@/lib/agencyClientMatching');
      const result = await refreshAgencyClientMatches(deskCase.clientId);
      return NextResponse.json({ success: true, ...result });
    }
    return NextResponse.json({ error: 'Refresh matches dotyczy spraw BUY.' }, { status: 400 });
  }

  if (body.action === 'link_offer') {
    const offerId = Number(body.offerId);
    if (!Number.isFinite(offerId)) {
      return NextResponse.json({ error: 'Brak offerId.' }, { status: 400 });
    }
    const deskCase = await prisma.deskCase.findFirst({
      where: { id: caseId, agencyUserId },
      select: { id: true },
    });
    if (!deskCase) {
      return NextResponse.json({ error: 'Nie znaleziono sprawy.' }, { status: 404 });
    }
    const offer = await prisma.offer.findFirst({
      where: { id: offerId, userId: agencyUserId },
      select: { id: true },
    });
    if (!offer) {
      return NextResponse.json({ error: 'Nie znaleziono oferty lub brak uprawnień.' }, { status: 404 });
    }
    await prisma.deskCase.update({
      where: { id: caseId },
      data: { linkedOfferId: offerId },
    });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'link_deal') {
    const dealId = Number(body.dealId);
    if (!Number.isFinite(dealId)) {
      return NextResponse.json({ error: 'Brak dealId.' }, { status: 400 });
    }
    const deskCase = await prisma.deskCase.findFirst({
      where: { id: caseId, agencyUserId },
      select: { id: true },
    });
    if (!deskCase) {
      return NextResponse.json({ error: 'Nie znaleziono sprawy.' }, { status: 404 });
    }
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, sellerId: agencyUserId },
      select: { id: true },
    });
    if (!deal) {
      return NextResponse.json({ error: 'Nie znaleziono deala lub brak uprawnień.' }, { status: 404 });
    }
    await prisma.deskCase.update({
      where: { id: caseId },
      data: {
        linkedDealId: dealId,
        pipelineStage: 'DEAL',
        nextAction: 'Prowadź Deal Room / negocjację',
        nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        temperature: 'HOT',
      },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Brak obsługiwanej zmiany.' }, { status: 400 });
}
