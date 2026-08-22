import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';
import { dispatchDeskWorkflow } from '@/lib/desk/workflowEngine';
import {
  isQualificationComplete,
  qualificationPayloadToBuyerPref,
  type BuyerQualificationPayload,
} from '@/lib/desk/buyerQualification';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
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
    where: { id: caseId, agencyUserId, kind: 'BUY' },
    include: { client: true },
  });
  if (!deskCase) {
    return NextResponse.json({ error: 'Nie znaleziono sprawy BUY.' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<BuyerQualificationPayload>;
  if (!body.buyerFilters) {
    return NextResponse.json({ error: 'Brak buyerFilters.' }, { status: 400 });
  }

  const payload = body as BuyerQualificationPayload;
  if (!isQualificationComplete(payload)) {
    return NextResponse.json({ error: 'Uzupełnij miasto, budżet i finansowanie.' }, { status: 400 });
  }

  const prefData = qualificationPayloadToBuyerPref(payload);
  await prisma.agencyClientBuyerPreference.upsert({
    where: { clientId: deskCase.clientId },
    create: { clientId: deskCase.clientId, ...prefData },
    update: prefData,
  });

  const qualificationMeta = {
    minPrice: payload.minPrice ?? null,
    maxPrice: payload.maxPrice ?? prefData.maxPrice ?? null,
    financing: payload.financing,
    downPayment: payload.downPayment ?? null,
    maxArea: payload.maxArea ?? null,
    rooms: payload.rooms ?? null,
    marketType: payload.marketType ?? 'both',
    purchaseTimeline: payload.purchaseTimeline ?? null,
    purchaseGoal: payload.purchaseGoal ?? null,
    mustHave: payload.mustHave ?? null,
    niceToHave: payload.niceToHave ?? null,
    exclusions: payload.exclusions ?? null,
    qualificationNotes: payload.qualificationNotes ?? null,
    qualifiedAt: new Date().toISOString(),
  };

  const prevMeta =
    deskCase.metadata && typeof deskCase.metadata === 'object'
      ? (deskCase.metadata as Record<string, unknown>)
      : {};

  await prisma.deskCase.update({
    where: { id: caseId },
    data: {
      metadata: { ...prevMeta, qualification: qualificationMeta },
      title: deskCase.title || `BUY · ${deskCase.client.firstName} ${deskCase.client.lastName}`,
    },
  });

  if (payload.notes?.trim() || payload.qualificationNotes?.trim()) {
    await prisma.agencyClient.update({
      where: { id: deskCase.clientId },
      data: {
        notes: payload.notes?.trim() || payload.qualificationNotes?.trim() || undefined,
      },
    });
  }

  const result = await dispatchDeskWorkflow({
    agencyUserId,
    caseId,
    trigger: 'BUYER_QUALIFIED',
    payload: { qualification: qualificationMeta },
  });

  return NextResponse.json({ success: true, ...result });
}
