import { prisma } from '@/lib/prisma';
import { isAgentOrAgencySeller } from '@/lib/sellerDisplay';
import { listAgencyCompaniesWithStats } from '@/lib/agencyCompany';

export type OfferManagementStatus = 'SELF' | 'TRANSFER_PENDING' | 'AGENCY_MANAGED';

export function isAgencyManagedOffer(offer: {
  managementStatus?: string | null;
}): boolean {
  return String(offer.managementStatus || 'SELF').toUpperCase() === 'AGENCY_MANAGED';
}

export function isFormerOwnerReadOnly(
  offer: { originalOwnerUserId?: number | null; userId?: number; managementStatus?: string | null },
  viewerUserId: number | null | undefined,
): boolean {
  if (!viewerUserId || !offer.originalOwnerUserId) return false;
  return (
    isAgencyManagedOffer(offer) &&
    offer.originalOwnerUserId === viewerUserId &&
    offer.userId !== viewerUserId
  );
}

export function canInteractOnOfferAsBuyer(
  offer: { originalOwnerUserId?: number | null; userId?: number; managementStatus?: string | null },
  viewerUserId: number | null | undefined,
): boolean {
  if (!viewerUserId) return true;
  if (isFormerOwnerReadOnly(offer, viewerUserId)) return false;
  return true;
}

export async function linkOfferToAgencyClient(params: {
  agencyUserId: number;
  clientId: number;
  offerId: number;
}) {
  const { agencyUserId, clientId, offerId } = params;
  const client = await prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId, type: 'SELLER', status: 'ACTIVE' },
  });
  if (!client) throw new Error('Nie znaleziono klienta sprzedającego.');

  const offer = await prisma.offer.findFirst({
    where: { id: offerId, userId: agencyUserId },
  });
  if (!offer) throw new Error('Oferta musi należeć do Twojego konta agencji.');

  await prisma.$transaction([
    prisma.agencyClient.update({
      where: { id: clientId },
      data: { linkedOfferId: offerId },
    }),
    prisma.agencyClientActivity.create({
      data: {
        clientId,
        agencyUserId,
        kind: 'LISTING_LINKED',
        title: 'Powiązano ogłoszenie',
        body: `Oferta #${offerId} została przypisana do klienta.`,
        offerId,
      },
    }),
  ]);

  return { clientId, offerId };
}

export async function transferOfferManagementFromLead(leadId: number, ownerUserId: number) {
  const lead = await prisma.leadTransfer.findUnique({
    where: { id: leadId },
    include: {
      offer: true,
      owner: { select: { id: true, name: true, email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true } },
      agency: { select: { id: true, name: true, companyName: true } },
    },
  });
  if (!lead) throw new Error('Nie znaleziono zapytania o przekazanie.');
  if (lead.ownerId !== ownerUserId) throw new Error('Brak uprawnień.');
  if (!['TERMS_PROPOSED', 'USER_COUNTER'].includes(lead.status)) {
    throw new Error('Agencja musi najpierw zaproponować warunki współpracy.');
  }
  if (isAgencyManagedOffer(lead.offer)) {
    throw new Error('Ta oferta jest już zarządzana przez agencję.');
  }

  const ownerName = String(lead.owner.name || lead.owner.email?.split('@')[0] || 'Klient').trim();
  const nameParts = ownerName.split(/\s+/);
  const firstName = nameParts[0] || 'Klient';
  const lastName = nameParts.slice(1).join(' ') || 'EstateOS';

  const result = await prisma.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: lead.offerId },
      data: {
        userId: lead.agencyId,
        originalOwnerUserId: lead.ownerId,
        managementStatus: 'AGENCY_MANAGED',
      },
    });

    await tx.leadTransfer.update({
      where: { id: leadId },
      data: { status: 'ACCEPTED' },
    });

    let agencyClient = await tx.agencyClient.findFirst({
      where: { agencyUserId: lead.agencyId, linkedOfferId: lead.offerId },
    });

    if (!agencyClient) {
      const now = new Date();
      agencyClient = await tx.agencyClient.create({
        data: {
          agencyUserId: lead.agencyId,
          type: 'SELLER',
          firstName,
          lastName,
          email: lead.owner.email,
          phone: lead.owner.phone,
          emailVerifiedAt: lead.owner.email ? now : null,
          phoneVerifiedAt: lead.owner.phone ? now : null,
          linkedUserId: lead.ownerId,
          notes: `Przekazanie zarządzania z konta właściciela (#${lead.ownerId}). Prowizja: ${lead.commissionRate ?? '—'}%. Kontakt uznany za zweryfikowany — właściciel przekazał ofertę przez Concierge.`,
          sellerTransactionType: lead.offer.transactionType,
          sellerPropertyType: lead.offer.propertyType,
          sellerCity: lead.offer.city,
          sellerDistrict: lead.offer.district,
          sellerPrice: lead.offer.price,
          sellerArea: lead.offer.area,
          sellerRooms: lead.offer.rooms,
          sellerDescription: lead.offer.description,
          linkedOfferId: lead.offerId,
        },
      });

      await tx.agencyClientActivity.create({
        data: {
          clientId: agencyClient.id,
          agencyUserId: lead.agencyId,
          kind: 'MANAGEMENT_TRANSFER',
          title: 'Przejęto zarządzanie ofertą',
          body: `Właściciel zaakceptował warunki. Oferta #${lead.offerId} jest w pełni obsługiwana przez biuro.`,
          offerId: lead.offerId,
        },
      });
    } else {
      const now = new Date();
      await tx.agencyClient.update({
        where: { id: agencyClient.id },
        data: {
          linkedUserId: lead.ownerId,
          email: lead.owner.email ?? agencyClient.email,
          phone: lead.owner.phone ?? agencyClient.phone,
          emailVerifiedAt: agencyClient.emailVerifiedAt ?? (lead.owner.email ? now : null),
          phoneVerifiedAt: agencyClient.phoneVerifiedAt ?? (lead.owner.phone ? now : null),
        },
      });
    }

    return { offerId: lead.offerId, agencyClientId: agencyClient.id };
  });

  return result;
}

export async function assertAgencyCanCreateForClient(agencyUserId: number, agencyClientId: number) {
  const client = await prisma.agencyClient.findFirst({
    where: { id: agencyClientId, agencyUserId, type: 'SELLER', status: 'ACTIVE' },
  });
  if (!client) throw new Error('Nie znaleziono aktywnego klienta sprzedającego.');
  return client;
}

export function sellerClientToListingPrefill(client: {
  sellerTransactionType?: string | null;
  sellerPropertyType?: string | null;
  sellerCity?: string | null;
  sellerDistrict?: string | null;
  sellerPrice?: number | null;
  sellerArea?: number | null;
  sellerRooms?: number | null;
  sellerDescription?: string | null;
  firstName?: string;
  lastName?: string;
  notes?: string | null;
}) {
  return {
    transactionType: client.sellerTransactionType || 'SELL',
    propertyType: client.sellerPropertyType || 'FLAT',
    city: client.sellerCity || 'Warszawa',
    district: client.sellerDistrict || 'OTHER',
    price: client.sellerPrice ?? 0,
    area: client.sellerArea ?? 0,
    rooms: client.sellerRooms ?? 0,
    description: [client.sellerDescription, client.notes].filter(Boolean).join('\n\n'),
    titleHint: client.sellerCity
      ? `${client.sellerPropertyType === 'HOUSE' ? 'Dom' : 'Mieszkanie'} — ${client.sellerCity}`
      : undefined,
  };
}

export async function listAgenciesWithStats() {
  const fromCompanies = await listAgencyCompaniesWithStats();
  let merged: Awaited<ReturnType<typeof listLegacyAgenciesWithStats>>;
  if (fromCompanies.length > 0) {
    const memberRows = await prisma.agencyCompanyMember.findMany({ select: { userId: true } });
    const memberIds = new Set(memberRows.map((m) => m.userId));
    const legacyAgencies = await listLegacyAgenciesWithStats(memberIds);
    merged = [...fromCompanies, ...legacyAgencies].sort((a, b) => {
      const ra = a.averageRating ?? 0;
      const rb = b.averageRating ?? 0;
      if (rb !== ra) return rb - ra;
      return b.activeListings - a.activeListings;
    });
  } else {
    merged = await listLegacyAgenciesWithStats(new Set());
  }

  return attachConciergeManagedCounts(merged);
}

async function attachConciergeManagedCounts<T extends { id: number }>(
  agencies: T[],
): Promise<Array<T & { conciergeManaged: number }>> {
  if (agencies.length === 0) return [];
  const ids = agencies.map((a) => a.id);
  const grouped = await prisma.leadTransfer.groupBy({
    by: ['agencyId'],
    where: { agencyId: { in: ids }, status: 'ACCEPTED' },
    _count: { id: true },
  });
  const map = new Map(grouped.map((g) => [g.agencyId, g._count.id]));
  return agencies.map((agency) => ({
    ...agency,
    conciergeManaged: map.get(agency.id) ?? 0,
  }));
}

async function listLegacyAgenciesWithStats(excludeUserIds: Set<number>) {
  const agencies = await prisma.user.findMany({
    where: {
      OR: [{ role: 'AGENT' }, { planType: 'AGENCY' }],
      ...(excludeUserIds.size > 0 ? { id: { notIn: [...excludeUserIds] } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      companyName: true,
      companyAddress: true,
      companyWebsite: true,
      companyLogoUrl: true,
      officePhone: true,
      officeEmail: true,
      phone: true,
      createdAt: true,
      planType: true,
      role: true,
      _count: {
        select: {
          offers: { where: { status: 'ACTIVE' } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const ids = agencies.map((a) => a.id);
  const reviews = ids.length
    ? await prisma.review.findMany({
        where: { revieweeId: { in: ids }, isAutoGenerated: false },
        select: { revieweeId: true, rating: true },
      })
    : [];

  const byAgency = new Map<number, number[]>();
  for (const r of reviews) {
    const list = byAgency.get(r.revieweeId) || [];
    list.push(r.rating);
    byAgency.set(r.revieweeId, list);
  }

  return agencies
    .map((agency) => {
      const ratings = byAgency.get(agency.id) || [];
      const reviewsCount = ratings.length;
      const averageRating =
        reviewsCount > 0 ? ratings.reduce((a, b) => a + b, 0) / reviewsCount : null;
      const displayName =
        String(agency.companyName || '').trim() ||
        String(agency.name || '').trim() ||
        'Agencja EstateOS';
      return {
        id: agency.id,
        name: agency.name,
        companyName: agency.companyName,
        displayName,
        image: agency.image,
        companyAddress: agency.companyAddress,
        companyWebsite: agency.companyWebsite,
        companyLogoUrl: agency.companyLogoUrl,
        officePhone: agency.officePhone,
        officeEmail: agency.officeEmail,
        phone: agency.phone,
        activeListings: agency._count.offers,
        reviewsCount,
        averageRating: averageRating != null ? Number(averageRating.toFixed(1)) : null,
        isAgency: isAgentOrAgencySeller(agency),
        memberSince: agency.createdAt.toISOString(),
      };
    })
    .sort((a, b) => {
      const ra = a.averageRating ?? 0;
      const rb = b.averageRating ?? 0;
      if (rb !== ra) return rb - ra;
      return b.activeListings - a.activeListings;
    });
}
