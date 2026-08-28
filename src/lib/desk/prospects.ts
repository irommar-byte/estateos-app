import { prisma } from '@/lib/prisma';
import { generatePortalToken } from '@/lib/agencyClientNotify';
import { buildPhoneLookupVariants, normalizePhoneE164 } from '@/lib/phoneE164';
import { ensureAgencyClientLinkedUser } from '@/lib/crm/linkedUser';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';
import { dispatchDeskWorkflow } from '@/lib/desk/workflowEngine';
import type { DeskPropertySnapshot } from '@/lib/desk/types';

function normalizePhone(raw: unknown): string | null {
  const input = String(raw || '').trim();
  if (!input) return null;
  const normalized = input.replace(/[^\d+]/g, '');
  if (!normalized.startsWith('+') || normalized.length < 8) return null;
  return normalized;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Prospect', lastName: '—' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '—' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export async function findExistingAgencyClient(params: {
  agencyUserId: number;
  email?: string | null;
  phone?: string | null;
}) {
  const email = params.email?.trim().toLowerCase() || null;
  const phoneE164 = normalizePhoneE164(params.phone);
  const phoneVariants = phoneE164 ? buildPhoneLookupVariants(phoneE164) : [];
  if (!email && !phoneVariants.length) return null;

  const or: Array<{ email?: string; phone?: { in: string[] } }> = [];
  if (email) or.push({ email });
  if (phoneVariants.length) or.push({ phone: { in: phoneVariants } });

  return prisma.agencyClient.findFirst({
    where: {
      agencyUserId: params.agencyUserId,
      status: 'ACTIVE',
      OR: or,
    },
  });
}

export async function createProspectCase(params: {
  agencyUserId: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  propertyType?: string | null;
  price?: number | null;
  note?: string | null;
  draft?: Record<string, unknown> | null;
}) {
  await ensureDeskSchema();

  const phone = normalizePhone(params.phone);
  if (params.phone && !phone) {
    throw new Error('INVALID_PHONE');
  }
  const email = params.email ? String(params.email).trim().toLowerCase() : null;

  let firstName = (params.firstName || '').trim();
  let lastName = (params.lastName || '').trim();
  if ((!firstName || !lastName) && params.name) {
    const split = splitName(params.name);
    firstName = firstName || split.firstName;
    lastName = lastName || split.lastName;
  }
  if (!firstName) firstName = 'Prospect';
  if (!lastName) lastName = '—';

  const existing = await findExistingAgencyClient({
    agencyUserId: params.agencyUserId,
    email,
    phone,
  });

  let client = existing;
  if (!client) {
    const linkedUserId = await ensureAgencyClientLinkedUser({
      email,
      phone,
      name: `${firstName} ${lastName}`.trim(),
    });
    client = await prisma.agencyClient.create({
      data: {
        agencyUserId: params.agencyUserId,
        type: 'SELLER',
        firstName,
        lastName,
        email,
        phone,
        notes: params.note || null,
        sellerCity: params.city || null,
        sellerDistrict: params.district || null,
        sellerPrice: params.price ?? null,
        sellerDescription: params.address || params.note || null,
        linkedUserId,
        portalToken: generatePortalToken(),
      },
    });
  } else if (params.note) {
    await prisma.agencyClient.update({
      where: { id: client.id },
      data: {
        notes: [client.notes, params.note].filter(Boolean).join('\n'),
        sellerCity: client.sellerCity || params.city || null,
        sellerPrice: client.sellerPrice ?? params.price ?? null,
      },
    });
  }

  const snapshot: DeskPropertySnapshot = {
    address: params.address || null,
    city: params.city || null,
    district: params.district || null,
    propertyType: params.propertyType || null,
    price: params.price ?? null,
    note: params.note || null,
    draft: params.draft || null,
  };

  const titleParts = [
    `${client.firstName} ${client.lastName}`.trim(),
    params.address || params.city || null,
  ].filter(Boolean);

  const deskCase = await prisma.deskCase.create({
    data: {
      agencyUserId: params.agencyUserId,
      clientId: client.id,
      kind: 'SELL',
      pipelineStage: 'FOUND',
      source: params.source || 'manual',
      sourceUrl: params.sourceUrl || null,
      propertySnapshot: snapshot as object,
      title: titleParts.join(' · '),
      temperature: 'WARM',
      health: 'HEALTHY',
      nextAction: 'Zadzwoń do właściciela',
      nextActionAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    },
  });

  await dispatchDeskWorkflow({
    agencyUserId: params.agencyUserId,
    caseId: deskCase.id,
    trigger: 'PROSPECT_CREATED',
    payload: {
      source: params.source || 'manual',
      sourceUrl: params.sourceUrl || null,
    },
  });

  const refreshed = await prisma.deskCase.findUnique({
    where: { id: deskCase.id },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
      tasks: {
        where: { status: 'OPEN' },
        orderBy: { dueAt: 'asc' },
        take: 5,
      },
    },
  });

  return { case: refreshed, reusedClient: Boolean(existing) };
}

export async function backfillDeskCasesForAgency(agencyUserId: number) {
  await ensureDeskSchema();

  const clients = await prisma.agencyClient.findMany({
    where: { agencyUserId, status: 'ACTIVE' },
    include: {
      acquisition: true,
      buyerPreference: true,
      deskCases: { select: { id: true, kind: true } },
    },
  });

  let created = 0;
  for (const client of clients) {
    const hasSell = client.deskCases.some((c) => c.kind === 'SELL');
    const hasBuy = client.deskCases.some((c) => c.kind === 'BUY');

    if (client.type === 'SELLER' && !hasSell) {
      let stage = 'FOUND';
      if (client.acquisition?.signedAt) stage = 'CONTRACT';
      else if (client.acquisition) stage = 'ACQUISITION';
      if (client.linkedOfferId) {
        const offer = await prisma.offer.findUnique({
          where: { id: client.linkedOfferId },
          select: { status: true },
        });
        if (offer?.status === 'ACTIVE') stage = 'LIVE';
        else if (offer) stage = 'LISTING';
      }

      await prisma.deskCase.create({
        data: {
          agencyUserId,
          clientId: client.id,
          kind: 'SELL',
          pipelineStage: stage,
          source: 'backfill',
          linkedOfferId: client.linkedOfferId,
          linkedAcquisitionId: client.acquisition?.id ?? null,
          propertySnapshot: {
            city: client.sellerCity,
            district: client.sellerDistrict,
            price: client.sellerPrice,
            area: client.sellerArea,
            rooms: client.sellerRooms,
            note: client.sellerDescription,
          },
          title: `${client.firstName} ${client.lastName}`.trim(),
          nextAction: stage === 'LIVE' ? 'Sprawdź matching i marketing' : 'Otwórz sprawę w Desk',
          nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          temperature: 'WARM',
          health: 'HEALTHY',
        },
      });
      created += 1;
    }

    const wantsBuy = client.type === 'BUYER' || Boolean(client.buyerPreference);
    if (wantsBuy && !hasBuy) {
      await prisma.deskCase.create({
        data: {
          agencyUserId,
          clientId: client.id,
          kind: 'BUY',
          pipelineStage: client.buyerPreference ? 'QUALIFIED' : 'INQUIRY',
          source: 'backfill',
          title: `${client.firstName} ${client.lastName} · kupujący`,
          nextAction: client.buyerPreference ? 'Odśwież matching' : 'Uzupełnij kryteria',
          nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          temperature: 'WARM',
          health: 'HEALTHY',
        },
      });
      created += 1;
    }
  }

  return { created, scanned: clients.length };
}
