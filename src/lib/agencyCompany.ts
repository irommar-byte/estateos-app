import { prisma } from '@/lib/prisma';
import type { AgencyMemberRole, AgencyMemberStatus, AgencyAgentTitle } from '@prisma/client';
import {
  AGENCY_AGENT_TITLES,
  formatAgentTitle,
  pickAgentAvatar,
  pickTeamMemberAvatar,
  resolveProfileMediaUrl,
} from '@/lib/agentProfile';
import { resolveCompanyPartnerPlanStatus } from '@/lib/partnerPlanStatus';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { notifyMemberApproved, notifyOffersTransferred } from '@/lib/agencyCompanyNotify';

export function slugifyCompanyName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || `firma-${Date.now()}`;
}

export async function uniqueCompanySlug(name: string): Promise<string> {
  const base = slugifyCompanyName(name);
  let slug = base;
  let i = 1;
  while (await prisma.agencyCompany.findUnique({ where: { slug } })) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

export type AgencyCompanyPublic = {
  id: number;
  name: string;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  officePhone: string | null;
  officeEmail: string | null;
};

export function shapeCompanyPublic(company: {
  id: number;
  name: string;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  officePhone: string | null;
  officeEmail: string | null;
}): AgencyCompanyPublic {
  return {
    id: company.id,
    name: company.name,
    address: company.address,
    website: company.website,
    logoUrl: company.logoUrl,
    officePhone: company.officePhone,
    officeEmail: company.officeEmail,
  };
}

export async function getUserAgencyMembership(userId: number) {
  return prisma.agencyCompanyMember.findUnique({
    where: { userId },
    include: {
      company: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

/** Zdjęcie widoczne na profilu — upload kierownika w zespole ma pierwszeństwo. */
export async function getUserDisplayAvatar(userId: number): Promise<string | null> {
  const membership = await prisma.agencyCompanyMember.findUnique({
    where: { userId },
    select: {
      profilePhotoUrl: true,
      user: { select: { image: true } },
      company: { select: { logoUrl: true } },
    },
  });
  if (membership) {
    return pickAgentAvatar({
      profilePhotoUrl: membership.profilePhotoUrl,
      userImage: membership.user.image,
      companyLogoUrl: membership.company.logoUrl,
    });
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
  return resolveProfileMediaUrl(user?.image);
}

type AgencyMembershipWithCompany = NonNullable<Awaited<ReturnType<typeof getUserAgencyMembership>>>;

/** Zakłada brakującą firmę dla agenta z companyName (legacy / samotny kierownik). */
export async function ensureAgencyCompanyForAgentUser(userId: number): Promise<AgencyMembershipWithCompany | null> {
  const existing = await getUserAgencyMembership(userId);
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      planType: true,
      name: true,
      email: true,
      companyName: true,
      companyAddress: true,
      companyWebsite: true,
      companyLogoUrl: true,
      officePhone: true,
      officeEmail: true,
      ownedAgencyCompany: { select: { id: true } },
    },
  });
  if (!user) return null;

  const isAgentLike = user.role === 'AGENT' || user.planType === 'AGENCY';
  if (!isAgentLike) return null;

  const companyName = String(user.companyName || '').trim();
  const resolvedCompanyName =
    companyName || String(user.name || '').trim() || String(user.email || '').split('@')[0] || `Biuro agenta ${user.id}`;

  if (user.ownedAgencyCompany) {
    return prisma.agencyCompanyMember.create({
      data: {
        companyId: user.ownedAgencyCompany.id,
        userId,
        role: 'ADMIN',
        status: 'ACTIVE',
        agentTitle: 'KIEROWNIK_BIURO',
        approvedAt: new Date(),
        approvedById: userId,
      },
      include: {
        company: { include: { owner: { select: { id: true, name: true, email: true } } } },
      },
    });
  }

  const slug = await uniqueCompanySlug(resolvedCompanyName);
  return prisma.$transaction(async (tx) => {
    if (!companyName) {
      await tx.user.update({
        where: { id: userId },
        data: { companyName: resolvedCompanyName },
      });
    }
    const company = await tx.agencyCompany.create({
      data: {
        name: resolvedCompanyName,
        slug,
        address: user.companyAddress,
        website: user.companyWebsite,
        logoUrl: user.companyLogoUrl,
        officePhone: user.officePhone,
        officeEmail: user.officeEmail,
        ownerUserId: userId,
      },
    });
    return tx.agencyCompanyMember.create({
      data: {
        companyId: company.id,
        userId,
        role: 'ADMIN',
        status: 'ACTIVE',
        agentTitle: 'KIEROWNIK_BIURO',
        approvedAt: new Date(),
        approvedById: userId,
      },
      include: {
        company: { include: { owner: { select: { id: true, name: true, email: true } } } },
      },
    });
  });
}

export async function getAgencyTeamForViewer(userId: number) {
  const membership = await getUserAgencyMembership(userId);
  if (!membership || membership.status !== 'ACTIVE') return { membership, team: [] };

  const isAdmin = membership.role === 'ADMIN';
  const members = await prisma.agencyCompanyMember.findMany({
    where: {
      companyId: membership.companyId,
      status: isAdmin ? { in: ['ACTIVE', 'PENDING'] } : 'ACTIVE',
    },
    include: {
      user: { select: { id: true, name: true, image: true, email: true } },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });

  return {
    membership,
    team: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      status: m.status,
      agentTitle: m.agentTitle,
      titleLabel: formatAgentTitle(m.agentTitle),
      name: m.user.name,
      image: pickTeamMemberAvatar({ userImage: m.user.image, profilePhotoUrl: m.profilePhotoUrl }),
      email: isAdmin ? m.user.email : null,
      isSelf: m.userId === userId,
    })),
  };
}

export function shapeAgencyMembershipResponse(
  membership: AgencyMembershipWithCompany,
  team: Array<{
    id: number;
    userId: number;
    role: string;
    status: string;
    agentTitle: string;
    titleLabel: string;
    name: string | null;
    image: string | null;
    email: string | null;
    isSelf: boolean;
  }>,
) {
  const selfTeam = team.find((m) => m.isSelf);
  return {
    id: membership.id,
    role: membership.role,
    status: membership.status,
    agentTitle: membership.agentTitle,
    titleLabel: formatAgentTitle(membership.agentTitle),
    displayAvatarUrl: selfTeam?.image ?? null,
    pendingApproval: membership.status === 'PENDING',
    companyId: membership.company.id,
    companyName: membership.company.name,
    company: {
      id: membership.company.id,
      name: membership.company.name,
      slug: membership.company.slug,
      address: membership.company.address,
      website: membership.company.website,
      logoUrl: membership.company.logoUrl,
      officePhone: membership.company.officePhone,
      officeEmail: membership.company.officeEmail,
      extraListings: membership.company.extraListings,
      plusExpiresAt: membership.company.plusExpiresAt?.toISOString() ?? null,
      ownerUserId: membership.company.ownerUserId,
    },
    team,
    stats: {
      activeMembers: team.filter((m) => m.status === 'ACTIVE').length,
      pendingMembers: team.filter((m) => m.status === 'PENDING').length,
    },
  };
}

export async function requireActiveAgencyAdmin(userId: number) {
  const membership = await getUserAgencyMembership(userId);
  if (!membership || membership.status !== 'ACTIVE' || membership.role !== 'ADMIN') {
    return null;
  }
  return membership;
}

export async function requireActiveAgencyMember(userId: number) {
  const membership = await getUserAgencyMembership(userId);
  if (!membership || membership.status !== 'ACTIVE') return null;
  return membership;
}

export async function listCompaniesForRegistration() {
  const companies = await prisma.agencyCompany.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      address: true,
      website: true,
      logoUrl: true,
      officePhone: true,
      officeEmail: true,
      _count: { select: { members: { where: { status: 'ACTIVE' } } } },
    },
    take: 500,
  });
  return companies.map((c) => ({
    ...shapeCompanyPublic(c),
    activeAgents: c._count.members,
  }));
}

export async function getCompanyDashboard(companyId: number) {
  const company = await prisma.agencyCompany.findUnique({
    where: { id: companyId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              extraListings: true,
              plusExpiresAt: true,
              createdAt: true,
              lastLoginAt: true,
              _count: { select: { offers: { where: { status: 'ACTIVE' } }, agencyClients: true } },
            },
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      },
      creditTransfers: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          toUser: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!company) return null;

  const memberIds = company.members.filter((m) => m.status === 'ACTIVE').map((m) => m.userId);
  const allUserIds = company.members.map((m) => m.userId);
  const totalOffers = memberIds.length
    ? await prisma.offer.count({ where: { userId: { in: memberIds }, status: 'ACTIVE' } })
    : 0;

  const offerStatusGroups = allUserIds.length
    ? await prisma.offer.groupBy({
        by: ['userId', 'status'],
        where: { userId: { in: allUserIds } },
        _count: { id: true },
      })
    : [];
  const offerStatsByUser = new Map<number, { active: number; pending: number; sold: number; inDeal: number }>();
  for (const row of offerStatusGroups) {
    const cur = offerStatsByUser.get(row.userId) || { active: 0, pending: 0, sold: 0, inDeal: 0 };
    const c = row._count.id;
    if (row.status === 'ACTIVE') cur.active += c;
    else if (row.status === 'PENDING') cur.pending += c;
    else if (row.status === 'SOLD') cur.sold += c;
    else if (row.status === 'IN_DEAL') cur.inDeal += c;
    offerStatsByUser.set(row.userId, cur);
  }

  const dealsInProgress = allUserIds.length
    ? await prisma.deal.groupBy({
        by: ['sellerId'],
        where: {
          sellerId: { in: allUserIds },
          status: { in: ['INITIATED', 'NEGOTIATION', 'AGREED', 'MEETING'] },
        },
        _count: { id: true },
      })
    : [];
  const dealsBySeller = new Map(dealsInProgress.map((d) => [d.sellerId, d._count.id]));

  const recentCompanyOffers = memberIds.length
    ? await prisma.offer.findMany({
        where: { userId: { in: memberIds }, status: { in: ['ACTIVE', 'PENDING', 'IN_DEAL'] } },
        orderBy: { updatedAt: 'desc' },
        take: 12,
        select: {
          id: true,
          title: true,
          status: true,
          price: true,
          city: true,
          district: true,
          images: true,
          userId: true,
          updatedAt: true,
          user: { select: { id: true, name: true } },
        },
      })
    : [];

  const reviewAgg = memberIds.length
    ? await prisma.review.groupBy({
        by: ['revieweeId'],
        where: { revieweeId: { in: memberIds }, isAutoGenerated: false },
        _count: { id: true },
        _avg: { rating: true },
      })
    : [];
  const reviewByUser = new Map(
    reviewAgg.map((r) => [
      r.revieweeId,
      { count: r._count.id, avg: r._avg.rating != null ? Number(r._avg.rating.toFixed(1)) : null },
    ]),
  );

  const activeAgentCount = company.members.filter((m) => m.status === 'ACTIVE').length;
  const partnerPlan = await resolveCompanyPartnerPlanStatus({
    ownerUserId: company.ownerUserId,
    extraListings: company.extraListings,
    plusExpiresAt: company.plusExpiresAt,
    activeAgents: activeAgentCount,
  });

  return {
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      address: company.address,
      website: company.website,
      logoUrl: company.logoUrl,
      officePhone: company.officePhone,
      officeEmail: company.officeEmail,
      extraListings: company.extraListings,
      plusExpiresAt: company.plusExpiresAt?.toISOString() ?? null,
      ownerUserId: company.ownerUserId,
    },
    stats: {
      activeAgents: company.members.filter((m) => m.status === 'ACTIVE').length,
      pendingAgents: company.members.filter((m) => m.status === 'PENDING').length,
      totalOffers,
    },
    recentOffers: recentCompanyOffers.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      price: o.price,
      city: o.city,
      district: o.district,
      imageUrl: resolveOfferPrimaryImage(o) || null,
      agentUserId: o.userId,
      updatedAt: o.updatedAt.toISOString(),
      agent: o.user,
    })),
    members: company.members.map((m) => {
      const offerStats = offerStatsByUser.get(m.userId) || { active: 0, pending: 0, sold: 0, inDeal: 0 };
      return {
      id: m.id,
      userId: m.userId,
      role: m.role,
      status: m.status,
      agentTitle: m.agentTitle,
      profilePhotoUrl: m.profilePhotoUrl,
      approvedAt: m.approvedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        extraListings: m.user.extraListings,
        plusExpiresAt: m.user.plusExpiresAt?.toISOString() ?? null,
        lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
        memberSince: m.user.createdAt.toISOString(),
        activeOffers: offerStats.active,
        pendingOffers: offerStats.pending,
        soldOffers: offerStats.sold,
        inDealOffers: offerStats.inDeal,
        dealsInProgress: dealsBySeller.get(m.userId) ?? 0,
        crmClients: m.user._count.agencyClients,
        reviewsCount: reviewByUser.get(m.userId)?.count ?? 0,
        averageRating: reviewByUser.get(m.userId)?.avg ?? null,
      },
    };
    }),
    creditTransfers: company.creditTransfers.map((t) => ({
      id: t.id,
      amount: t.amount,
      note: t.note,
      createdAt: t.createdAt.toISOString(),
      toUser: t.toUser,
      createdBy: t.createdBy,
    })),
    partnerPlan,
  };
}

export async function transferCompanyCredits(params: {
  companyId: number;
  adminUserId: number;
  toUserId: number;
  amount: number;
  note?: string;
}) {
  const { companyId, adminUserId, toUserId, amount, note } = params;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Podaj dodatnią liczbę kredytów.');

  const admin = await requireActiveAgencyAdmin(adminUserId);
  if (!admin || admin.companyId !== companyId) throw new Error('Brak uprawnień administratora.');

  const target = await prisma.agencyCompanyMember.findFirst({
    where: { companyId, userId: toUserId, status: 'ACTIVE' },
  });
  if (!target) throw new Error('Pracownik nie należy do firmy lub nie jest aktywny.');

  await prisma.$transaction(async (tx) => {
    const company = await tx.agencyCompany.findUnique({ where: { id: companyId } });
    if (!company || company.extraListings < amount) throw new Error('Za mało kredytów w puli firmy.');

    const recipient = await tx.user.findUnique({
      where: { id: toUserId },
      select: { id: true, extraListings: true, plusExpiresAt: true },
    });
    if (!recipient) throw new Error('Nie znaleziono użytkownika.');

    const companyExpiry = company.plusExpiresAt;
    const recipientExpiry = recipient.plusExpiresAt;
    const mergedExpiry =
      companyExpiry && recipientExpiry
        ? new Date(Math.max(companyExpiry.getTime(), recipientExpiry.getTime()))
        : companyExpiry || recipientExpiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await tx.agencyCompany.update({
      where: { id: companyId },
      data: { extraListings: { decrement: amount } },
    });
    await tx.user.update({
      where: { id: toUserId },
      data: {
        extraListings: { increment: amount },
        plusExpiresAt: mergedExpiry,
      },
    });
    await tx.agencyCompanyCreditTransfer.create({
      data: {
        companyId,
        toUserId,
        amount,
        note: note?.trim() || null,
        createdById: adminUserId,
      },
    });
  });
}

export async function setMemberStatus(params: {
  companyId: number;
  adminUserId: number;
  memberId: number;
  status: AgencyMemberStatus;
}) {
  const admin = await requireActiveAgencyAdmin(params.adminUserId);
  if (!admin || admin.companyId !== params.companyId) throw new Error('Brak uprawnień.');

  const member = await prisma.agencyCompanyMember.findFirst({
    where: { id: params.memberId, companyId: params.companyId },
    include: {
      company: {
        select: {
          name: true,
          ownerUserId: true,
          extraListings: true,
          plusExpiresAt: true,
        },
      },
    },
  });
  if (!member) throw new Error('Nie znaleziono pracownika.');
  if (member.role === 'ADMIN') throw new Error('Nie można zmieniać statusu administratora.');

  if (params.status === 'ACTIVE' && member.status !== 'ACTIVE') {
    const activeAgents = await prisma.agencyCompanyMember.count({
      where: { companyId: params.companyId, status: 'ACTIVE', id: { not: member.id } },
    });
    const plan = await resolveCompanyPartnerPlanStatus({
      ownerUserId: member.company.ownerUserId,
      extraListings: member.company.extraListings,
      plusExpiresAt: member.company.plusExpiresAt,
      activeAgents,
    });
    const limit = plan.agentsLimit;
    if (limit != null && activeAgents + 1 > limit) {
      throw new Error(
        `Limit agentów dla planu ${plan.currentPlan?.id === 'free' ? 'Partner Free' : 'Partner'} (${limit}) został osiągnięty. Ulepsz pakiet w panelu Moje biuro.`,
      );
    }
  }

  const updated = await prisma.agencyCompanyMember.update({
    where: { id: params.memberId },
    data: {
      status: params.status,
      approvedAt: params.status === 'ACTIVE' ? new Date() : null,
      approvedById: params.status === 'ACTIVE' ? params.adminUserId : null,
    },
  });

  if (params.status === 'ACTIVE' && member.status === 'PENDING') {
    void notifyMemberApproved({
      userId: member.userId,
      companyName: member.company.name,
    });
  }

  return updated;
}

export async function updateMemberProfile(params: {
  companyId: number;
  adminUserId: number;
  memberId: number;
  agentTitle?: AgencyAgentTitle;
  profilePhotoUrl?: string | null;
}) {
  const admin = await requireActiveAgencyAdmin(params.adminUserId);
  if (!admin || admin.companyId !== params.companyId) throw new Error('Brak uprawnień.');

  const member = await prisma.agencyCompanyMember.findFirst({
    where: { id: params.memberId, companyId: params.companyId },
  });
  if (!member) throw new Error('Nie znaleziono pracownika.');

  const data: { agentTitle?: AgencyAgentTitle; profilePhotoUrl?: string | null } = {};
  if (params.agentTitle) {
    if (!AGENCY_AGENT_TITLES.includes(params.agentTitle)) {
      throw new Error('Nieprawidłowe stanowisko.');
    }
    data.agentTitle = params.agentTitle;
  }
  if (params.profilePhotoUrl !== undefined) {
    data.profilePhotoUrl = params.profilePhotoUrl;
  }
  if (!Object.keys(data).length) throw new Error('Brak danych do zapisania.');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.agencyCompanyMember.update({ where: { id: params.memberId }, data });
    if (data.profilePhotoUrl !== undefined) {
      await tx.user.update({
        where: { id: member.userId },
        data: { image: data.profilePhotoUrl },
      });
    }
    return updated;
  });
}

export async function getMemberInsights(params: {
  adminUserId: number;
  memberId: number;
}) {
  const admin = await requireActiveAgencyAdmin(params.adminUserId);
  if (!admin) throw new Error('Brak uprawnień.');

  const member = await prisma.agencyCompanyMember.findFirst({
    where: { id: params.memberId, companyId: admin.companyId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          phone: true,
          extraListings: true,
          plusExpiresAt: true,
          createdAt: true,
          lastLoginAt: true,
        },
      },
    },
  });
  if (!member) throw new Error('Nie znaleziono pracownika.');

  const [offers, clients, activities, dealsCount] = await Promise.all([
    prisma.offer.findMany({
      where: { userId: member.userId },
      orderBy: { updatedAt: 'desc' },
      take: 80,
      select: {
        id: true,
        title: true,
        status: true,
        price: true,
        pricePln: true,
        city: true,
        district: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.agencyClient.findMany({
      where: { agencyUserId: member.userId },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        type: true,
        status: true,
        email: true,
        phone: true,
        updatedAt: true,
      },
    }),
    prisma.agencyClientActivity.findMany({
      where: { agencyUserId: member.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        client: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.deal.count({
      where: {
        sellerId: member.userId,
        status: { in: ['INITIATED', 'NEGOTIATION', 'AGREED', 'MEETING'] },
      },
    }),
  ]);

  return {
    member: {
      id: member.id,
      userId: member.userId,
      role: member.role,
      status: member.status,
      agentTitle: member.agentTitle,
      profilePhotoUrl: member.profilePhotoUrl,
      approvedAt: member.approvedAt?.toISOString() ?? null,
      createdAt: member.createdAt.toISOString(),
      user: {
        ...member.user,
        plusExpiresAt: member.user.plusExpiresAt?.toISOString() ?? null,
        createdAt: member.user.createdAt.toISOString(),
        lastLoginAt: member.user.lastLoginAt?.toISOString() ?? null,
      },
    },
    dealsInProgress: dealsCount,
    offers: offers.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      price: o.price,
      pricePln: o.pricePln,
      city: o.city,
      district: o.district,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    })),
    clients: clients.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      type: c.type,
      status: c.status,
      email: c.email,
      phone: c.phone,
      updatedAt: c.updatedAt.toISOString(),
    })),
    activities: activities.map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      body: a.body,
      offerId: a.offerId,
      createdAt: a.createdAt.toISOString(),
      clientName: a.client ? `${a.client.firstName} ${a.client.lastName}`.trim() : null,
    })),
  };
}

export async function transferMemberOffers(params: {
  companyId: number;
  adminUserId: number;
  fromUserId: number;
  toUserId: number;
  offerIds: number[];
}) {
  const admin = await requireActiveAgencyAdmin(params.adminUserId);
  if (!admin || admin.companyId !== params.companyId) throw new Error('Brak uprawnień.');

  const { fromUserId, toUserId, offerIds } = params;
  if (fromUserId === toUserId) throw new Error('Wybierz innego agenta docelowego.');
  if (!offerIds.length) throw new Error('Wybierz co najmniej jedną ofertę.');

  const members = await prisma.agencyCompanyMember.findMany({
    where: {
      companyId: params.companyId,
      userId: { in: [fromUserId, toUserId] },
      status: 'ACTIVE',
    },
    include: { user: { select: { id: true, name: true } } },
  });
  const fromMember = members.find((m) => m.userId === fromUserId);
  const toMember = members.find((m) => m.userId === toUserId);
  if (!fromMember || !toMember) {
    throw new Error('Oboje pracownicy muszą być aktywni w firmie.');
  }

  const offers = await prisma.offer.findMany({
    where: {
      id: { in: offerIds },
      userId: fromUserId,
      status: { in: ['ACTIVE', 'PENDING', 'IN_DEAL'] },
    },
    select: { id: true, title: true },
  });
  if (offers.length !== offerIds.length) {
    throw new Error('Niektóre ogłoszenia nie należą do wybranego agenta lub nie mogą być przeniesione.');
  }

  await prisma.offer.updateMany({
    where: { id: { in: offerIds } },
    data: { userId: toUserId, updatedAt: new Date() },
  });

  void notifyOffersTransferred({
    toUserId,
    fromUserName: fromMember.user.name || 'Agent',
    count: offers.length,
  });

  return {
    transferred: offers.length,
    offerIds: offers.map((o) => o.id),
    fromUser: { id: fromUserId, name: fromMember.user.name },
    toUser: { id: toUserId, name: toMember.user.name },
  };
}

export async function updateCompanyLogo(params: {
  companyId: number;
  adminUserId: number;
  logoUrl: string;
}) {
  const admin = await requireActiveAgencyAdmin(params.adminUserId);
  if (!admin || admin.companyId !== params.companyId) throw new Error('Brak uprawnień.');
  return prisma.agencyCompany.update({
    where: { id: params.companyId },
    data: { logoUrl: params.logoUrl },
  });
}

function normalizeCompanyWebsite(value: unknown): string | null {
  let w = String(value ?? '').trim();
  if (!w) return null;
  if (!/^https?:\/\//i.test(w)) w = `https://${w}`;
  return w;
}

function normalizeOfficeEmail(value: unknown): string | null {
  const e = String(value ?? '').toLowerCase().trim();
  if (!e) return null;
  if (!e.includes('@')) throw new Error('Podaj prawidłowy adres e-mail biura.');
  return e;
}

/** Kierownik biura (ADMIN) — strona www, telefon i e-mail widoczne na profilu publicznym biura. */
export async function updateCompanyContact(params: {
  companyId: number;
  adminUserId: number;
  website?: string | null;
  officePhone?: string | null;
  officeEmail?: string | null;
}) {
  const admin = await requireActiveAgencyAdmin(params.adminUserId);
  if (!admin || admin.companyId !== params.companyId) throw new Error('Brak uprawnień.');

  const data: { website?: string | null; officePhone?: string | null; officeEmail?: string | null } = {};
  if (params.website !== undefined) data.website = normalizeCompanyWebsite(params.website);
  if (params.officePhone !== undefined) {
    data.officePhone = String(params.officePhone ?? '').trim() || null;
  }
  if (params.officeEmail !== undefined) data.officeEmail = normalizeOfficeEmail(params.officeEmail);
  if (!Object.keys(data).length) throw new Error('Brak danych do zapisania.');

  return prisma.$transaction(async (tx) => {
    const company = await tx.agencyCompany.update({
      where: { id: params.companyId },
      data,
    });

    const userPatch: { companyWebsite?: string | null; officePhone?: string | null; officeEmail?: string | null } = {};
    if (data.website !== undefined) userPatch.companyWebsite = data.website;
    if (data.officePhone !== undefined) userPatch.officePhone = data.officePhone;
    if (data.officeEmail !== undefined) userPatch.officeEmail = data.officeEmail;

    if (Object.keys(userPatch).length) {
      const members = await tx.agencyCompanyMember.findMany({
        where: { companyId: params.companyId, status: 'ACTIVE' },
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

export type AgencyOfficeBackfillReport = {
  scannedAgents: number;
  officesCreated: number;
  membershipsLinked: number;
  managersPromoted: number;
  photosSynced: number;
  skipped: number;
  errors: string[];
};

/** Migracja legacy: każdy agent dostaje biuro (nazwa z companyName) i rolę kierownika gdy jest jedynym członkiem. */
export async function backfillAgencyOfficesForLegacyAgents(): Promise<AgencyOfficeBackfillReport> {
  const report: AgencyOfficeBackfillReport = {
    scannedAgents: 0,
    officesCreated: 0,
    membershipsLinked: 0,
    managersPromoted: 0,
    photosSynced: 0,
    skipped: 0,
    errors: [],
  };

  const agents = await prisma.user.findMany({
    where: { OR: [{ role: 'AGENT' }, { planType: 'AGENCY' }] },
    select: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      companyAddress: true,
      companyWebsite: true,
      companyLogoUrl: true,
      officePhone: true,
      officeEmail: true,
      image: true,
    },
    orderBy: { id: 'asc' },
  });

  report.scannedAgents = agents.length;

  for (const agent of agents) {
    try {
      const beforeMembership = await prisma.agencyCompanyMember.findUnique({ where: { userId: agent.id } });
      const ensured = await ensureAgencyCompanyForAgentUser(agent.id);
      if (!beforeMembership && ensured) {
        if (ensured.company.ownerUserId === agent.id) report.officesCreated += 1;
        else report.membershipsLinked += 1;
      } else if (!ensured) {
        report.skipped += 1;
      }
    } catch (e) {
      report.errors.push(`user ${agent.id}: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  const companies = await prisma.agencyCompany.findMany({
    include: {
      members: {
        where: { status: 'ACTIVE' },
        select: { id: true, userId: true, role: true, agentTitle: true },
      },
    },
  });

  for (const company of companies) {
    const active = company.members;
    if (active.length !== 1) continue;
    const sole = active[0];
    if (sole.role === 'ADMIN' && sole.agentTitle === 'KIEROWNIK_BIURO') continue;
    try {
      await prisma.agencyCompanyMember.update({
        where: { id: sole.id },
        data: {
          role: 'ADMIN',
          agentTitle: 'KIEROWNIK_BIURO',
          approvedAt: new Date(),
          approvedById: sole.userId,
        },
      });
      if (company.ownerUserId !== sole.userId) {
        await prisma.agencyCompany.update({
          where: { id: company.id },
          data: { ownerUserId: sole.userId },
        });
      }
      report.managersPromoted += 1;
    } catch (e) {
      report.errors.push(`company ${company.id}: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  const membersWithPhotos = await prisma.agencyCompanyMember.findMany({
    include: {
      user: { select: { image: true } },
      company: { select: { logoUrl: true } },
    },
  });

  for (const member of membersWithPhotos) {
    const teamPhoto = member.profilePhotoUrl?.trim() || null;
    const logo = member.company.logoUrl?.trim() || null;
    if (!teamPhoto || (logo && teamPhoto === logo)) continue;
    if (member.user.image === teamPhoto) continue;
    await prisma.user.update({
      where: { id: member.userId },
      data: { image: teamPhoto },
    });
    report.photosSynced += 1;
  }

  return report;
}

export async function listAgencyCompaniesWithStats() {
  const companies = await prisma.agencyCompany.findMany({
    include: {
      members: {
        where: { status: 'ACTIVE' },
        select: { userId: true },
      },
      owner: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const results = await Promise.all(
    companies.map(async (company) => {
      const userIds = company.members.map((m) => m.userId);
      const activeListings = userIds.length
        ? await prisma.offer.count({ where: { userId: { in: userIds }, status: 'ACTIVE' } })
        : 0;
      const reviews = userIds.length
        ? await prisma.review.findMany({
            where: { revieweeId: { in: userIds }, isAutoGenerated: false },
            select: { rating: true },
          })
        : [];
      const reviewsCount = reviews.length;
      const averageRating =
        reviewsCount > 0 ? Number((reviews.reduce((s, r) => s + r.rating, 0) / reviewsCount).toFixed(1)) : null;

      return {
        id: company.ownerUserId,
        companyId: company.id,
        slug: company.slug,
        displayName: company.name,
        companyName: company.name,
        name: company.owner.name,
        image: company.logoUrl || company.owner.image,
        companyAddress: company.address,
        companyWebsite: company.website,
        companyLogoUrl: company.logoUrl,
        officePhone: company.officePhone,
        officeEmail: company.officeEmail,
        phone: company.officePhone,
        activeListings,
        reviewsCount,
        averageRating,
        memberCount: userIds.length,
        isAgency: true,
        memberSince: company.createdAt.toISOString(),
      };
    }),
  );

  return results.sort((a, b) => {
    const ra = a.averageRating ?? 0;
    const rb = b.averageRating ?? 0;
    if (rb !== ra) return rb - ra;
    return b.activeListings - a.activeListings;
  });
}

const companyPublicInclude = {
  members: {
    where: { status: 'ACTIVE' as const },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          phone: true,
          createdAt: true,
          _count: { select: { offers: { where: { status: 'ACTIVE' as const } } } },
        },
      },
    },
    orderBy: [{ role: 'asc' as const }, { createdAt: 'asc' as const }],
  },
};

async function buildCompanyPublicPayload(company: {
  id: number;
  name: string;
  slug: string | null;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  officePhone: string | null;
  officeEmail: string | null;
  createdAt: Date;
  members: Array<{
    userId: number;
    role: string;
    agentTitle: string | null;
    profilePhotoUrl: string | null;
    user: {
      id: number;
      name: string | null;
      image: string | null;
      phone: string | null;
      createdAt: Date;
      _count: { offers: number };
    };
  }>;
}) {
  const memberIds = company.members.map((m) => m.userId);
  const [activeListingsCount, offers] = await Promise.all([
    memberIds.length
      ? prisma.offer.count({ where: { userId: { in: memberIds }, status: 'ACTIVE' } })
      : Promise.resolve(0),
    memberIds.length
      ? prisma.offer.findMany({
          where: { userId: { in: memberIds }, status: 'ACTIVE' },
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
            images: true,
            transactionType: true,
            userId: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 120,
        })
      : Promise.resolve([]),
  ]);

  const reviews = memberIds.length
    ? await prisma.review.findMany({
        where: { revieweeId: { in: memberIds }, isAutoGenerated: false },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          revieweeId: true,
          reviewee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      })
    : [];

  const reviewsCount = reviews.length;
  const averageRating =
    reviewsCount > 0
      ? Number((reviews.reduce((s, r) => s + r.rating, 0) / reviewsCount).toFixed(1))
      : null;

  return {
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      address: company.address,
      website: company.website,
      logoUrl: company.logoUrl,
      officePhone: company.officePhone,
      officeEmail: company.officeEmail,
      memberSince: company.createdAt.toISOString(),
    },
    stats: {
      activeAgents: company.members.length,
      activeListings: activeListingsCount,
      reviewsCount,
      averageRating,
    },
    agents: company.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      image: pickTeamMemberAvatar({ userImage: m.user.image, profilePhotoUrl: m.profilePhotoUrl }),
      phone: m.user.phone,
      role: m.role,
      agentTitle: m.agentTitle,
      profilePhotoUrl: m.profilePhotoUrl,
      activeOffers: m.user._count.offers,
      memberSince: m.user.createdAt.toISOString(),
    })),
    offers: offers.map((o) => ({
      id: o.id,
      title: o.title,
      price: o.price,
      pricePln: o.pricePln,
      priceCurrency: o.priceCurrency,
      city: o.city,
      district: o.district,
      area: o.area,
      rooms: o.rooms,
      images: o.images,
      transactionType: o.transactionType,
      agent: o.user,
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      agent: r.reviewee,
    })),
  };
}

export async function getCompanyPublicBySlug(slug: string) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;

  const company = await prisma.agencyCompany.findFirst({
    where: { slug: normalized },
    include: companyPublicInclude,
  });
  if (!company) return null;

  return buildCompanyPublicPayload(company);
}

export async function getCompanyPublicById(companyId: number) {
  const id = Number(companyId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const company = await prisma.agencyCompany.findFirst({
    where: { id },
    include: companyPublicInclude,
  });
  if (!company) return null;

  return buildCompanyPublicPayload(company);
}
