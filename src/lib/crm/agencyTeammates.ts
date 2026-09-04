import { prisma } from '@/lib/prisma';

export async function agentCanPublishOfferEvents(agencyUserId: number, offerUserId: number) {
  if (agencyUserId === offerUserId) return true;
  const members = await prisma.agencyCompanyMember.findMany({
    where: {
      userId: { in: [agencyUserId, offerUserId] },
      status: 'ACTIVE',
    },
    select: { userId: true, companyId: true },
  });
  const agent = members.find((row) => row.userId === agencyUserId);
  const owner = members.find((row) => row.userId === offerUserId);
  return Boolean(agent && owner && agent.companyId === owner.companyId);
}
