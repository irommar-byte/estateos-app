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
  return user.id;
}

export async function getAgencyClientForUser(clientId: number, agencyUserId: number) {
  return prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId, status: 'ACTIVE' },
    include: {
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
              area: true,
              rooms: true,
              transactionType: true,
              images: true,
              status: true,
            },
          },
        },
      },
      activities: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  });
}
