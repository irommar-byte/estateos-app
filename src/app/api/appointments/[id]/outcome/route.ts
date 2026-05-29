import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthedUserIdFromRequest } from '@/lib/sessionAuth';
import {
  canClosePresentation,
  counterpartyId,
  isDealParticipant,
  mapOutcomeInput,
} from '@/lib/appointments/presentationFlow';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthedUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const appointmentId = Number(id);
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid appointment id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const outcome = mapOutcomeInput(body?.outcome ?? body?.status);
    if (!outcome) {
      return NextResponse.json({ success: false, error: 'Invalid outcome' }, { status: 400 });
    }

    const note =
      body?.note != null ? String(body.note).trim().slice(0, 500) : null;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { deal: true },
    });
    if (!appointment) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    if (!isDealParticipant(appointment.deal, userId)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (!canClosePresentation(appointment)) {
      return NextResponse.json(
        { success: false, error: 'TOO_EARLY', code: 'TOO_EARLY' },
        { status: 409 },
      );
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: outcome,
        outcomeAt: new Date(),
        outcomeById: userId,
        outcomeNote: note,
      },
    });

    const cpId = counterpartyId(appointment.deal, userId);
    if (cpId) {
      await prisma.notification.create({
        data: {
          userId: cpId,
          title: 'Zaktualizowano wynik prezentacji',
          body: 'Druga strona domknęła wizytę — możesz wystawić opinię.',
          type: 'DEAL_UPDATE',
          targetType: 'DEAL',
          targetId: String(appointment.dealId),
          idempotencyKey: `presentation_outcome:${appointmentId}:by:${userId}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      appointment: {
        id: updated.id,
        status: updated.status,
        outcomeAt: updated.outcomeAt,
      },
      reviewAllowed: outcome === 'COMPLETED' || outcome === 'NO_SHOW',
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
