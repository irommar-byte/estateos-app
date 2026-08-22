import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';
import { dispatchDeskWorkflow } from '@/lib/desk/workflowEngine';
import type { DeskWorkflowTrigger } from '@/lib/desk/types';

type Ctx = { params: Promise<{ id: string }> };

const OUTCOME_MAP: Record<string, DeskWorkflowTrigger> = {
  NO_ANSWER: 'CALL_NO_ANSWER',
  CALLBACK: 'CALL_CALLBACK',
  NOT_INTERESTED: 'CALL_NOT_INTERESTED',
  INTERESTED: 'CALL_INTERESTED',
  MEETING_BOOKED: 'MEETING_BOOKED',
  MEETING_COMPLETED: 'MEETING_COMPLETED',
  CONTRACT_SIGNED: 'CONTRACT_SIGNED',
  LISTING_PUBLISHED: 'LISTING_PUBLISHED',
  PRICE_CHANGED: 'PRICE_CHANGED',
  PRESENTATION_COMPLETED: 'PRESENTATION_COMPLETED',
  OPEN_HOUSE_COMPLETED: 'OPEN_HOUSE_COMPLETED',
  BID_RECEIVED: 'BID_RECEIVED',
  DEAL_FINALIZED: 'DEAL_FINALIZED',
};

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

  const body = await req.json().catch(() => ({}));
  const outcome = String(body.outcome || body.trigger || '').toUpperCase();
  const trigger = OUTCOME_MAP[outcome];
  if (!trigger) {
    return NextResponse.json({ error: 'Nieznany wynik / trigger.' }, { status: 400 });
  }

  try {
    const result = await dispatchDeskWorkflow({
      agencyUserId,
      caseId,
      trigger,
      payload: body.payload && typeof body.payload === 'object' ? body.payload : body,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dispatch failed';
    if (message === 'DESK_CASE_NOT_FOUND') {
      return NextResponse.json({ error: 'Nie znaleziono sprawy.' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
