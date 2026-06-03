import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/notification.service';
import {
  counterpartyId,
  isDealParticipant,
  isReviewableOutcome,
} from '@/lib/appointments/presentationFlow';

export async function submitPresentationReview(input: {
  appointmentId: number;
  reviewerId: number;
  rating: number;
  comment?: string | null;
}) {
  const appointmentId = Number(input.appointmentId);
  const reviewerId = Number(input.reviewerId);
  const rating = Number(input.rating);
  const comment = input.comment?.trim().slice(0, 500) || null;

  if (!appointmentId || !reviewerId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('INVALID_REVIEW_PAYLOAD');
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      deal: { select: { id: true, buyerId: true, sellerId: true, offerId: true } },
    },
  });
  if (!appointment?.deal) throw new Error('APPOINTMENT_NOT_FOUND');
  if (!isDealParticipant(appointment.deal, reviewerId)) throw new Error('DEAL_PARTICIPANT_REQUIRED');
  if (!isReviewableOutcome(appointment.status)) throw new Error('APPOINTMENT_NOT_REVIEWABLE');

  const targetId = counterpartyId(appointment.deal, reviewerId);
  if (!targetId) throw new Error('SELF_REVIEW_FORBIDDEN');

  try {
    const review = await prisma.review.create({
      data: {
        dealId: appointment.dealId,
        reviewerId,
        revieweeId: targetId,
        rating,
        comment,
        source: 'PRESENTATION',
      },
    });

    await prisma.notification.create({
      data: {
        userId: targetId,
        title: 'Nowa opinia po prezentacji',
        body: 'Kontrahent ocenił współpracę — możesz też dodać swoją opinię.',
        type: 'DEAL_UPDATE',
        targetType: 'DEAL',
        targetId: String(appointment.dealId),
        idempotencyKey: `presentation_review:${appointmentId}:from:${reviewerId}`,
      },
    });

    try {
      await notificationService.sendPushToUser(targetId, {
        title: 'Nowa opinia po prezentacji',
        body: 'Dodaj swoją ocenę w Deal Room.',
        data: {
          target: 'dealroom',
          notificationType: 'presentation_review',
          dealId: appointment.dealId,
          offerId: appointment.deal.offerId ?? null,
          appointmentId,
          deeplink: `estateos://dealroom/${appointment.dealId}`,
        },
      });
    } catch {
      /* non-blocking */
    }

    return review;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('REVIEW_ALREADY_EXISTS');
    }
    throw error;
  }
}
