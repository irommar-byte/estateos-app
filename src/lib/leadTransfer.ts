import { prisma } from '@/lib/prisma';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { getUserDisplayAvatar } from '@/lib/agencyCompany';
import { getBestUserAvatarUrl } from '@/lib/userAvatar';
import { leadStatusMeta, type LeadTransferStatus } from '@/lib/leadTransferShared';

export type { LeadTransferStatus } from '@/lib/leadTransferShared';
export {
  LEAD_SERVICE_PRESETS,
  leadStatusMeta,
  countPendingConciergeLeads,
} from '@/lib/leadTransferShared';
export {
  CONCIERGE_NOTIFY_TITLES,
  conciergeNotificationLink,
  isConciergeLeadNotification,
  notifyLeadTransfer,
} from '@/lib/leadTransferNotify';

function formatOfferLocation(offer: {
  city?: string | null;
  district?: string | null;
  street?: string | null;
  buildingNumber?: string | null;
}) {
  const parts = [
    offer.street && offer.buildingNumber ? `${offer.street} ${offer.buildingNumber}` : offer.street,
    offer.district,
    offer.city,
  ].filter(Boolean);
  return parts.join(', ') || offer.city || '—';
}

export async function shapeEnrichedLeadTransfer(
  lead: {
    id: number;
    offerId: number;
    ownerId: number;
    agencyId: number;
    status: string;
    price: number | null;
    message: string | null;
    commissionRate: number | null;
    commissionTerms: string | null;
    createdAt: Date;
    updatedAt: Date;
    offer: {
      id: number;
      title: string;
      price: number;
      pricePln?: number | null;
      city: string | null;
      district: string | null;
      area: string | number | null;
      rooms: number | null;
      propertyType: string | null;
      transactionType: string | null;
      status: string;
      images: string | null;
      street?: string | null;
      buildingNumber?: string | null;
    };
    owner: { id: number; name: string | null; email: string; phone: string | null; image: string | null };
    agency: {
      id: number;
      name: string | null;
      companyName: string | null;
      image: string | null;
      phone: string | null;
    };
  },
  viewerUserId: number,
) {
  const viewerIsAgency = lead.agencyId === viewerUserId;
  const [ownerAvatar, agencyAvatar] = await Promise.all([
    getUserDisplayAvatar(lead.ownerId),
    getUserDisplayAvatar(lead.agencyId),
  ]);

  return {
    id: lead.id,
    offerId: lead.offerId,
    ownerId: lead.ownerId,
    agencyId: lead.agencyId,
    status: lead.status,
    commissionRate: lead.commissionRate,
    commissionTerms: lead.commissionTerms,
    message: lead.message,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    statusMeta: leadStatusMeta(lead.status, viewerIsAgency),
    offer: {
      id: lead.offer.id,
      title: lead.offer.title,
      price: lead.offer.price,
      pricePln: lead.offer.pricePln ?? lead.offer.price,
      city: lead.offer.city,
      district: lead.offer.district,
      area: lead.offer.area != null ? String(lead.offer.area) : null,
      rooms: lead.offer.rooms,
      propertyType: lead.offer.propertyType,
      transactionType: lead.offer.transactionType,
      status: lead.offer.status,
      imageUrl: resolveOfferPrimaryImage(lead.offer),
      locationLabel: formatOfferLocation(lead.offer),
      href: `/oferta/${lead.offer.id}`,
    },
    owner: {
      id: lead.owner.id,
      name: lead.owner.name || lead.owner.email.split('@')[0],
      email: lead.owner.email,
      phone: lead.owner.phone,
      image: ownerAvatar || getBestUserAvatarUrl(lead.owner),
    },
    agency: {
      id: lead.agency.id,
      name: lead.agency.companyName || lead.agency.name || 'Agencja',
      image: agencyAvatar || getBestUserAvatarUrl(lead.agency),
      phone: lead.agency.phone,
    },
  };
}

const LEAD_INCLUDE = {
  offer: {
    select: {
      id: true,
      title: true,
      price: true,
      pricePln: true,
      city: true,
      district: true,
      area: true,
      rooms: true,
      propertyType: true,
      transactionType: true,
      status: true,
      images: true,
      street: true,
      buildingNumber: true,
    },
  },
  owner: { select: { id: true, name: true, email: true, phone: true, image: true } },
  agency: { select: { id: true, name: true, companyName: true, image: true, phone: true } },
} as const;

export async function listEnrichedLeadTransfersForUser(userId: number) {
  const rows = await prisma.leadTransfer.findMany({
    where: { OR: [{ agencyId: userId }, { ownerId: userId }] },
    include: LEAD_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  });
  return Promise.all(rows.map((row) => shapeEnrichedLeadTransfer(row, userId)));
}
