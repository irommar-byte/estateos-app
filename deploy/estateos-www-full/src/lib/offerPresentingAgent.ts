import { prisma } from '@/lib/prisma';
import {
  isAgentOrAgencySeller,
  resolveSellerDisplayName,
  resolveSellerPersonName,
  resolveServicingCompanyName,
} from '@/lib/sellerDisplay';
import { getBestUserAvatarUrl } from '@/lib/userAvatar';

export type PresentingAgentProfile = {
  userId: number;
  name: string;
  personName: string | null;
  companyName: string | null;
  displayName: string;
  phone: string | null;
  email: string | null;
  image: string | null;
  role: string;
  planType: string | null;
};

function shapePresentingAgent(user: {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  role: string;
  planType: string | null;
  companyName: string | null;
  buyerType?: string | null;
}): PresentingAgentProfile {
  const userLike = user;
  const personName = resolveSellerPersonName(userLike);
  const companyName = resolveServicingCompanyName(userLike);
  const displayName = resolveSellerDisplayName(userLike, user.name || 'Agent');
  return {
    userId: user.id,
    name: user.name || displayName,
    personName,
    companyName,
    displayName,
    phone: user.phone,
    email: user.email,
    image: getBestUserAvatarUrl(user) || user.image,
    role: user.role,
    planType: user.planType,
  };
}

export function presentingAgentAsOfferUser(agent: PresentingAgentProfile) {
  return {
    id: agent.userId,
    name: agent.personName || agent.name,
    email: agent.email,
    phone: agent.phone,
    image: agent.image,
    role: agent.role,
    planType: agent.planType,
    companyName: agent.companyName,
    displayName: agent.displayName,
    publicName: agent.displayName,
    personName: agent.personName,
    servicingCompanyName: agent.companyName,
    isPresentingAgent: true,
  };
}

export async function resolvePresentingAgent(params: {
  offerId: number;
  portalToken?: string | null;
  agentUserId?: number | null;
}): Promise<PresentingAgentProfile | null> {
  const portalToken = params.portalToken?.trim();
  if (portalToken) {
    const client = await prisma.agencyClient.findFirst({
      where: { portalToken, status: 'ACTIVE' },
      select: { agencyUserId: true, type: true },
    });
    if (!client) return null;
    const user = await prisma.user.findUnique({
      where: { id: client.agencyUserId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        role: true,
        planType: true,
        companyName: true,
        buyerType: true,
      },
    });
    if (!user || !isAgentOrAgencySeller(user)) return null;
    return shapePresentingAgent(user);
  }

  const agentId = Number(params.agentUserId);
  if (!Number.isFinite(agentId) || agentId <= 0) return null;

  const user = await prisma.user.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      role: true,
      planType: true,
      companyName: true,
      buyerType: true,
    },
  });
  if (!user || !isAgentOrAgencySeller(user)) return null;
  return shapePresentingAgent(user);
}

export function appendPresentationQuery(
  baseUrl: string,
  opts: { portalToken?: string | null; agentUserId?: number | null },
): string {
  const url = new URL(baseUrl, 'https://estateos.pl');
  if (opts.portalToken) url.searchParams.set('portal', opts.portalToken);
  else if (opts.agentUserId) url.searchParams.set('agent', String(opts.agentUserId));
  return url.pathname + url.search;
}
