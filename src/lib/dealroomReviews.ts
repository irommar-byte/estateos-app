import { Prisma, Review } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/notification.service';

const REVIEW_REVEAL_DELAY_MS = 14 * 24 * 60 * 60 * 1000;
const AUTO_COMMENT = 'Transakcja zakończyła się pomyślnie.';
const AUTO_SOURCE = 'SYSTEM_14D_FALLBACK';

type DealSideIds = { buyerId: number; sellerId: number };

function getReviewRevealAt(finalizedAt: Date): Date {
  return new Date(finalizedAt.getTime() + REVIEW_REVEAL_DELAY_MS);
}

function coerceDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveFinalizedAtSafe(deal: { finalizedAt?: Date | null; updatedAt?: Date | null }): Date {
  return coerceDate(deal.finalizedAt) || coerceDate(deal.updatedAt) || new Date(0);
}

export async function submitDealReview(input: {
  dealId: number;
  reviewerId: number;
  targetId: number;
  rating: number;
  comment?: string | null;
}) {
  const dealId = Number(input.dealId);
  const reviewerId = Number(input.reviewerId);
  const targetId = Number(input.targetId);
  const rating = Number(input.rating);
  const comment = input.comment?.trim() || null;

  if (!dealId || !reviewerId || !targetId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('INVALID_REVIEW_PAYLOAD');
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, offerId: true, buyerId: true, sellerId: true },
  });
  if (!deal) throw new Error('DEAL_NOT_FOUND');
  if (![deal.buyerId, deal.sellerId].includes(reviewerId) || ![deal.buyerId, deal.sellerId].includes(targetId)) {
    throw new Error('DEAL_PARTICIPANT_REQUIRED');
  }
  if (reviewerId === targetId) throw new Error('SELF_REVIEW_FORBIDDEN');

  let review: Review;
  try {
    review = await prisma.review.create({
      data: {
        dealId,
        reviewerId,
        revieweeId: targetId,
        rating,
        comment,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('REVIEW_ALREADY_EXISTS');
    }
    throw error;
  }

  await prisma.notification.create({
    data: {
      userId: targetId,
      title: 'Otrzymano ocenę kontrahenta',
      body: 'Kliknij, aby przejść do transakcji i dodać swoją opinię.',
      type: 'DEAL_UPDATE',
      targetType: 'DEAL',
      targetId: String(dealId),
      idempotencyKey: `deal_review:deal:${dealId}:reviewer:${reviewerId}:target:${targetId}`,
    },
  });

  try {
    await notificationService.sendPushToUser(targetId, {
      title: 'Otrzymano ocenę kontrahenta',
      body: 'Kliknij, aby przejść do transakcji i dodać swoją opinię.',
      data: {
        target: 'dealroom',
        notificationType: 'dealroom_review',
        targetType: 'DEAL',
        dealId,
        offerId: deal.offerId ?? null,
        screen: 'DealroomChat',
        route: 'DealroomChat',
        deeplink: `estateos://dealroom/${dealId}`,
      },
    });
  } catch (pushError) {
    console.warn('[DEALROOM REVIEW PUSH WARN]', pushError);
  }

  return review;
}

export async function getDealReviewVisibility(input: {
  dealId: number;
  viewerId: number;
  sides?: DealSideIds;
  finalizedAt?: Date;
}) {
  const { dealId, viewerId } = input;
  const sides =
    input.sides ||
    (await prisma.deal.findUnique({
      where: { id: dealId },
      select: { buyerId: true, sellerId: true, finalizedAt: true, updatedAt: true },
    }));
  if (!sides) {
    return null;
  }

  const partnerId = viewerId === sides.buyerId ? sides.sellerId : sides.buyerId;
  const finalizedAt = input.finalizedAt || resolveFinalizedAtSafe(sides as { finalizedAt?: Date | null; updatedAt?: Date | null });
  const reviewRevealAt = getReviewRevealAt(finalizedAt);

  const [myReview, partnerReview] = await Promise.all([
    prisma.review.findFirst({
      where: { dealId, reviewerId: viewerId, revieweeId: partnerId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.review.findFirst({
      where: { dealId, reviewerId: partnerId, revieweeId: viewerId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const now = new Date();
  const myReviewSubmitted = Boolean(myReview);
  const reviewRevealUnlocked = myReviewSubmitted || now >= reviewRevealAt;
  const partnerReviewVisible = reviewRevealUnlocked && Boolean(partnerReview);

  return {
    myReviewSubmitted,
    reviewRevealAt: reviewRevealAt.toISOString(),
    reviewRevealUnlocked,
    partnerReviewVisible,
    partnerReview: partnerReviewVisible ? partnerReview : null,
  };
}

export async function createMissingFallbackReviews(params: {
  dealId: number;
  buyerId: number;
  sellerId: number;
}) {
  const { dealId, buyerId, sellerId } = params;
  const existing = await prisma.review.findMany({
    where: { dealId, reviewerId: { in: [buyerId, sellerId] } },
    select: { reviewerId: true, revieweeId: true },
  });

  const hasBuyer = existing.some((r) => r.reviewerId === buyerId && r.revieweeId === sellerId);
  const hasSeller = existing.some((r) => r.reviewerId === sellerId && r.revieweeId === buyerId);

  const toCreate: Array<{ reviewerId: number; revieweeId: number }> = [];
  if (!hasBuyer) toCreate.push({ reviewerId: buyerId, revieweeId: sellerId });
  if (!hasSeller) toCreate.push({ reviewerId: sellerId, revieweeId: buyerId });

  let created = 0;
  for (const row of toCreate) {
    try {
      await prisma.review.create({
        data: {
          dealId,
          reviewerId: row.reviewerId,
          revieweeId: row.revieweeId,
          rating: 5,
          comment: AUTO_COMMENT,
          isAutoGenerated: true,
          source: AUTO_SOURCE,
        },
      });
      created += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue;
      }
      throw error;
    }
  }

  return { created, skipped: toCreate.length - created };
}
