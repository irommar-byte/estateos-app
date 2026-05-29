import { NextResponse } from 'next/server';
import { getAuthedUserIdFromRequest } from '@/lib/sessionAuth';
import { getPendingPresentationStep } from '@/lib/appointments/presentationFlowPending';

export async function GET(req: Request) {
  try {
    const userId = await getAuthedUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ pending: null });

    const pending = await getPendingPresentationStep(userId);
    if (pending?.step === 'review') {
      return NextResponse.json({
        pending: {
          appId: pending.appointment.id,
          appointmentId: pending.appointment.id,
          dealId: pending.appointment.dealId,
          targetId: pending.appointment.counterparty.id,
          targetName: pending.appointment.counterparty.name,
          date: pending.appointment.proposedDate,
        },
      });
    }
    return NextResponse.json({ pending: null });
  } catch {
    return NextResponse.json({ pending: null }, { status: 500 });
  }
}
