import { prisma } from '@/lib/prisma';
import { JOURNEY_ACTIVITY } from '@/lib/crm/clientJourney';
import { generatePortalToken } from '@/lib/agencyClientNotify';
import { seedAcquisitionForm } from '@/lib/crm/acquisitionOffer';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';

export type ClientPersonProject = {
  id: number;
  type: 'BUYER' | 'SELLER';
  title: string;
  subtitle: string;
  statusLabel: string;
  portalUnreadCount: number;
  linkedOfferId: number | null;
  matchCount: number;
  updatedAt: string;
  createdAt: string;
  coverImageUrl: string | null;
};

function identityWhere(client: {
  id: number;
  email?: string | null;
  phone?: string | null;
  peselHash?: string | null;
  linkedUserId?: number | null;
}) {
  const or: Array<Record<string, unknown>> = [{ id: client.id }];
  if (client.linkedUserId) or.push({ linkedUserId: client.linkedUserId });
  if (client.email) or.push({ email: String(client.email).trim().toLowerCase() });
  if (client.phone) or.push({ phone: client.phone });
  if (client.peselHash) or.push({ peselHash: client.peselHash });
  return or;
}

function sellerTitle(row: {
  linkedOffer?: { title: string } | null;
  sellerCity: string | null;
  sellerPropertyType: string | null;
  sellerRooms: number | null;
}) {
  if (row.linkedOffer?.title) return row.linkedOffer.title;
  const bits = [
    row.sellerPropertyType === 'HOUSE' ? 'Dom' : row.sellerPropertyType === 'PLOT' ? 'Działka' : 'Mieszkanie',
    row.sellerRooms ? `${row.sellerRooms} pok.` : null,
    row.sellerCity,
  ].filter(Boolean);
  return bits.join(' · ') || 'Pozysk sprzedaży';
}

function buyerTitle(row: {
  buyerPreference?: { city: string | null; minRooms: number | null; maxPrice: number | null } | null;
  buyerCity?: string | null;
}) {
  const city = row.buyerPreference?.city || row.buyerCity || null;
  const rooms = row.buyerPreference?.minRooms;
  const bits = [
    city ? `Szuka: ${city}` : 'Poszukiwanie mieszkania',
    rooms ? `od ${rooms} pok.` : null,
  ].filter(Boolean);
  return bits.join(' · ');
}

function extractCoverImage(offer: { images?: string | null } | null): string | null {
  if (!offer) return null;
  return resolveOfferPrimaryImage({ images: offer.images }) || null;
}

export async function loadClientPersonProjects(params: {
  agencyUserId: number;
  client: {
    id: number;
    email: string | null;
    phone: string | null;
    peselHash: string | null;
    linkedUserId: number | null;
  };
}): Promise<{ selling: ClientPersonProject[]; buying: ClientPersonProject[] }> {
  const rows = await prisma.agencyClient.findMany({
    where: {
      agencyUserId: params.agencyUserId,
      status: 'ACTIVE',
      OR: identityWhere(params.client) as never,
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      type: true,
      sellerCity: true,
      sellerPropertyType: true,
      sellerRooms: true,
      sellerPrice: true,
      linkedOfferId: true,
      linkedOffer: { select: { title: true, status: true, images: true } },
      createdAt: true,
      buyerPreference: { select: { city: true, minRooms: true, maxPrice: true } },
      acquisition: { select: { status: true, currentStep: true } },
      _count: { select: { matches: true } },
      updatedAt: true,
    },
  });

  const unreadRows = await prisma.agencyClientActivity.groupBy({
    by: ['clientId'],
    where: {
      clientId: { in: rows.map((row) => row.id) },
      kind: JOURNEY_ACTIVITY.PORTAL_MESSAGE,
    },
    _count: { _all: true },
  });
  const unreadByClient = new Map(unreadRows.map((row) => [row.clientId, row._count._all]));

  const selling: ClientPersonProject[] = [];
  const buying: ClientPersonProject[] = [];
  for (const row of rows) {
    const project: ClientPersonProject = {
      id: row.id,
      type: row.type,
      title: row.type === 'SELLER' ? sellerTitle(row) : buyerTitle(row),
      subtitle:
        row.type === 'SELLER'
          ? [
              row.acquisition?.status === 'SIGNED' ? 'Umowa podpisana' : 'Pozysk w toku',
              row.linkedOfferId ? `Oferta #${row.linkedOfferId}` : null,
              row.sellerPrice ? `${Math.round(row.sellerPrice).toLocaleString('pl-PL')} zł` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : [
              row.buyerPreference?.maxPrice
                ? `do ${Math.round(row.buyerPreference.maxPrice).toLocaleString('pl-PL')} zł`
                : 'Kryteria wyszukiwania',
              row._count.matches ? `${row._count.matches} dopasowań` : null,
            ]
              .filter(Boolean)
              .join(' · '),
      statusLabel:
        row.type === 'SELLER'
          ? row.linkedOffer?.status === 'ACTIVE'
            ? 'Ogłoszenie aktywne'
            : row.acquisition?.status === 'SIGNED'
              ? 'Pozysk zamknięty'
              : 'W przygotowaniu'
          : row._count.matches
            ? 'Radar aktywny'
            : 'Ustal kryteria',
      portalUnreadCount: unreadByClient.get(row.id) || 0,
      linkedOfferId: row.linkedOfferId,
      matchCount: row._count.matches,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      coverImageUrl: extractCoverImage(row.linkedOffer),
    };
    if (row.type === 'SELLER') selling.push(project);
    else buying.push(project);
  }
  return { selling, buying };
}

export async function createPersonProject(params: {
  agencyUserId: number;
  sourceClientId: number;
  type: 'BUYER' | 'SELLER';
}) {
  const source = await prisma.agencyClient.findFirst({
    where: { id: params.sourceClientId, agencyUserId: params.agencyUserId, status: 'ACTIVE' },
  });
  if (!source) return { ok: false as const, status: 404, error: 'Nie znaleziono klienta.' };

  const created = await prisma.agencyClient.create({
    data: {
      agencyUserId: params.agencyUserId,
      type: params.type,
      firstName: source.firstName,
      lastName: source.lastName,
      email: source.email,
      phone: source.phone,
      pesel: source.pesel,
      peselHash: source.peselHash,
      linkedUserId: source.linkedUserId,
      notes: source.notes,
      portalToken: generatePortalToken(),
      ...(params.type === 'BUYER'
        ? {
            buyerPreference: {
              create: { minMatchThreshold: 70 },
            },
          }
        : {
            sellerCity: source.sellerCity,
            sellerDistrict: source.sellerDistrict,
            sellerPropertyType: source.sellerPropertyType,
          }),
    },
  });

  if (params.type === 'SELLER') {
    await prisma.agencyClientAcquisition
      .create({
        data: {
          clientId: created.id,
          agencyUserId: params.agencyUserId,
          status: 'PREPARATION',
          currentStep: 1,
          formData: seedAcquisitionForm({ client: created }),
        },
      })
      .catch(() => {});
  }

  await prisma.agencyClientActivity.create({
    data: {
      clientId: created.id,
      agencyUserId: params.agencyUserId,
      kind: 'CLIENT_CREATED',
      title: params.type === 'SELLER' ? 'Nowy pozysk sprzedaży' : 'Nowe poszukiwanie',
      body: `${source.firstName} ${source.lastName} — ${params.type === 'SELLER' ? 'sprzedaż' : 'zakup'}.`,
    },
  });

  return { ok: true as const, clientId: created.id };
}
