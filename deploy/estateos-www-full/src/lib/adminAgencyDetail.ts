import { prisma } from '@/lib/prisma';
import { formatAgentTitle } from '@/lib/agentProfile';
import { getWalletSnapshotsForUserIds } from '@/lib/walletLedger';

export type AdminAgencyMemberRow = {
  memberId: number;
  userId: number;
  role: string;
  status: string;
  agentTitle: string;
  titleLabel: string;
  isOfficeManager: boolean;
  approvedAt: string | null;
  createdAt: string;
  user: {
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
    image: string | null;
    isPro: boolean;
    extraListings: number;
    lastLoginAt: string | null;
    createdAt: string;
    activeOffers: number;
    walletCredits: number;
  };
};

export type AdminAgencyListItem = {
  id: number;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  address: string | null;
  website: string | null;
  officePhone: string | null;
  officeEmail: string | null;
  extraListings: number;
  plusExpiresAt: string | null;
  createdAt: string;
  ownerUserId: number;
  ownerName: string | null;
  managerName: string | null;
  stats: {
    activeMembers: number;
    pendingMembers: number;
    activeOffers: number;
    totalOffers: number;
  };
};

export type AdminAgencyDetail = AdminAgencyListItem & {
  nip: string | null;
  updatedAt: string;
  members: AdminAgencyMemberRow[];
  recentOffers: Array<{
    id: number;
    title: string;
    status: string;
    price: number;
    city: string;
    updatedAt: string;
    agent: { id: number; name: string | null };
  }>;
};

async function offerCountsForUserIds(userIds: number[]) {
  if (!userIds.length) return { active: 0, total: 0 };
  const groups = await prisma.offer.groupBy({
    by: ['status'],
    where: { userId: { in: userIds } },
    _count: { id: true },
  });
  let active = 0;
  let total = 0;
  for (const g of groups) {
    total += g._count.id;
    if (g.status === 'ACTIVE') active += g._count.id;
  }
  return { active, total };
}

async function activeOffersPerUser(userIds: number[]) {
  if (!userIds.length) return new Map<number, number>();
  const groups = await prisma.offer.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, status: 'ACTIVE' },
    _count: { id: true },
  });
  return new Map(groups.map((g) => [g.userId, g._count.id]));
}

function shapeManagerName(members: Array<{ role: string; agentTitle: string; user: { name: string | null } }>) {
  const admin =
    members.find((m) => m.role === 'ADMIN' && m.agentTitle === 'KIEROWNIK_BIURO') ||
    members.find((m) => m.role === 'ADMIN');
  return admin?.user.name || null;
}

export async function listAdminAgencies(): Promise<AdminAgencyListItem[]> {
  const companies = await prisma.agencyCompany.findMany({
    include: {
      owner: { select: { id: true, name: true } },
      members: {
        select: {
          userId: true,
          status: true,
          role: true,
          agentTitle: true,
          user: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const results: AdminAgencyListItem[] = [];
  for (const company of companies) {
    const activeMemberIds = company.members.filter((m) => m.status === 'ACTIVE').map((m) => m.userId);
    const allMemberIds = company.members.map((m) => m.userId);
    const offerStats = await offerCountsForUserIds(allMemberIds);

    results.push({
      id: company.id,
      name: company.name,
      slug: company.slug,
      logoUrl: company.logoUrl,
      address: company.address,
      website: company.website,
      officePhone: company.officePhone,
      officeEmail: company.officeEmail,
      extraListings: company.extraListings,
      plusExpiresAt: company.plusExpiresAt?.toISOString() ?? null,
      createdAt: company.createdAt.toISOString(),
      ownerUserId: company.ownerUserId,
      ownerName: company.owner.name,
      managerName: shapeManagerName(company.members),
      stats: {
        activeMembers: company.members.filter((m) => m.status === 'ACTIVE').length,
        pendingMembers: company.members.filter((m) => m.status === 'PENDING').length,
        activeOffers: activeMemberIds.length
          ? (
              await offerCountsForUserIds(activeMemberIds)
            ).active
          : 0,
        totalOffers: offerStats.total,
      },
    });
  }

  return results;
}

export async function getAdminAgencyDetail(companyId: number): Promise<AdminAgencyDetail | null> {
  const company = await prisma.agencyCompany.findUnique({
    where: { id: companyId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              image: true,
              isPro: true,
              extraListings: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });
  if (!company) return null;

  const memberUserIds = company.members.map((m) => m.userId);
  const offersPerUser = await activeOffersPerUser(memberUserIds);
  const wallets = await getWalletSnapshotsForUserIds(memberUserIds);
  const allOfferStats = await offerCountsForUserIds(memberUserIds);
  const activeMemberIds = company.members.filter((m) => m.status === 'ACTIVE').map((m) => m.userId);
  const activeOfferStats = await offerCountsForUserIds(activeMemberIds);

  const recentOffers = activeMemberIds.length
    ? await prisma.offer.findMany({
        where: { userId: { in: activeMemberIds } },
        orderBy: { updatedAt: 'desc' },
        take: 15,
        select: {
          id: true,
          title: true,
          status: true,
          price: true,
          city: true,
          updatedAt: true,
          user: { select: { id: true, name: true } },
        },
      })
    : [];

  const listBase: AdminAgencyListItem = {
    id: company.id,
    name: company.name,
    slug: company.slug,
    logoUrl: company.logoUrl,
    address: company.address,
    website: company.website,
    officePhone: company.officePhone,
    officeEmail: company.officeEmail,
    extraListings: company.extraListings,
    plusExpiresAt: company.plusExpiresAt?.toISOString() ?? null,
    createdAt: company.createdAt.toISOString(),
    ownerUserId: company.ownerUserId,
    ownerName: company.owner.name,
    managerName: shapeManagerName(company.members),
    stats: {
      activeMembers: company.members.filter((m) => m.status === 'ACTIVE').length,
      pendingMembers: company.members.filter((m) => m.status === 'PENDING').length,
      activeOffers: activeOfferStats.active,
      totalOffers: allOfferStats.total,
    },
  };

  return {
    ...listBase,
    nip: company.nip,
    updatedAt: company.updatedAt.toISOString(),
    members: company.members.map((m) => ({
      memberId: m.id,
      userId: m.userId,
      role: m.role,
      status: m.status,
      agentTitle: m.agentTitle,
      titleLabel: formatAgentTitle(m.agentTitle),
      isOfficeManager: m.role === 'ADMIN' || m.agentTitle === 'KIEROWNIK_BIURO',
      approvedAt: m.approvedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        phone: m.user.phone,
        image: m.user.image,
        isPro: m.user.isPro,
        extraListings: m.user.extraListings,
        lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
        createdAt: m.user.createdAt.toISOString(),
        activeOffers: offersPerUser.get(m.userId) ?? 0,
        walletCredits: wallets[m.userId]?.credits ?? 0,
      },
    })),
    recentOffers: recentOffers.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      price: o.price,
      city: o.city,
      updatedAt: o.updatedAt.toISOString(),
      agent: o.user,
    })),
  };
}

export async function updateAdminAgencyCompany(
  companyId: number,
  data: {
    name?: string;
    address?: string | null;
    website?: string | null;
    officePhone?: string | null;
    officeEmail?: string | null;
    extraListings?: number;
  },
) {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const name = String(data.name || '').trim();
    if (!name) throw new Error('Nazwa biura jest wymagana.');
    patch.name = name;
  }
  if (data.address !== undefined) patch.address = String(data.address || '').trim() || null;
  if (data.website !== undefined) {
    let w = String(data.website || '').trim();
    if (w && !/^https?:\/\//i.test(w)) w = `https://${w}`;
    patch.website = w || null;
  }
  if (data.officePhone !== undefined) patch.officePhone = String(data.officePhone || '').trim() || null;
  if (data.officeEmail !== undefined) {
    const e = String(data.officeEmail || '').toLowerCase().trim();
    if (e && !e.includes('@')) throw new Error('Nieprawidłowy e-mail biura.');
    patch.officeEmail = e || null;
  }
  if (data.extraListings !== undefined) {
    const n = Number(data.extraListings);
    if (!Number.isFinite(n) || n < 0) throw new Error('Nieprawidłowa liczba kredytów.');
    patch.extraListings = Math.floor(n);
  }
  if (!Object.keys(patch).length) throw new Error('Brak danych do zapisania.');

  return prisma.$transaction(async (tx) => {
    const company = await tx.agencyCompany.update({ where: { id: companyId }, data: patch });
    const userPatch: Record<string, string | null> = {};
    if (patch.name) userPatch.companyName = patch.name as string;
    if (patch.address !== undefined) userPatch.companyAddress = patch.address as string | null;
    if (patch.website !== undefined) userPatch.companyWebsite = patch.website as string | null;
    if (patch.officePhone !== undefined) userPatch.officePhone = patch.officePhone as string | null;
    if (patch.officeEmail !== undefined) userPatch.officeEmail = patch.officeEmail as string | null;
    if (Object.keys(userPatch).length) {
      const members = await tx.agencyCompanyMember.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { userId: true },
      });
      if (members.length) {
        await tx.user.updateMany({
          where: { id: { in: members.map((m) => m.userId) } },
          data: userPatch,
        });
      }
    }
    return company;
  });
}
