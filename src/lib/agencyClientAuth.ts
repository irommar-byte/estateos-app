import { prisma } from '@/lib/prisma';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { isAgentOrAgencySeller } from '@/lib/sellerDisplay';

export async function requireAgencyUserId(req?: Request): Promise<number | null> {
  const userId = await resolveWebUserId(req);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, planType: true, buyerType: true },
  });
  if (!user || !isAgentOrAgencySeller(user)) return null;

  const membership = await prisma.agencyCompanyMember.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });
  if (membership && membership.status !== 'ACTIVE') return null;

  return user.id;
}

const LITE_ACTIVITY_KINDS = [
  'ACQUISITION_MEETING',
  'MEETING_CHANGE_PROPOSED',
  'MEETING_CONFIRMED',
  'PRESENTATION_PROPOSED',
  'PRESENTATION_CHANGE_PROPOSED',
  'PRESENTATION_CONFIRMED',
] as const;

export async function getAgencyClientLiteForUser(clientId: number, agencyUserId: number) {
  return prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId, status: 'ACTIVE' },
    include: {
      linkedUser: { select: { id: true, email: true, lastLoginAt: true } },
      linkedOffer: { select: { status: true } },
      buyerPreference: true,
      matches: {
        orderBy: { score: 'desc' },
        take: 1,
        select: {
          id: true,
          score: true,
          notifiedAt: true,
          clientFeedback: true,
          clientFeedbackAt: true,
        },
      },
      activities: {
        where: { kind: { in: [...LITE_ACTIVITY_KINDS] } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
}

export async function getAgencyClientForUser(clientId: number, agencyUserId: number) {
  return prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId, status: 'ACTIVE' },
    include: {
      linkedUser: { select: { id: true, email: true, lastLoginAt: true } },
      linkedOffer: { select: { status: true } },
      buyerPreference: true,
      matches: {
        orderBy: { score: 'desc' },
        take: 50,
        include: {
          offer: {
            select: {
              id: true,
              title: true,
              price: true,
              pricePln: true,
              priceCurrency: true,
              city: true,
              district: true,
              street: true,
              description: true,
              area: true,
              rooms: true,
              transactionType: true,
              images: true,
              status: true,
            },
          },
        },
      },
      activities: { orderBy: { createdAt: 'desc' }, take: 80 },
    },
  });
}
