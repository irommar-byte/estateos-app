import type { PropertyType, TransactionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { refreshAgencyClientMatches } from '@/lib/agencyClientMatching';
import { generatePortalToken } from '@/lib/agencyClientNotify';
import { ensureAgencyClientLinkedUser } from '@/lib/crm/linkedUser';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';
import { findExistingAgencyClient } from '@/lib/desk/prospects';
import { dispatchDeskWorkflow } from '@/lib/desk/workflowEngine';
import { normalizePhoneE164 } from '@/lib/phoneE164';
import {
  buyerMissionQualificationMeta,
  buyerMissionToBuyerPrefCreate,
  isBuyerStep3Complete,
  normalizeBuyerContactEmail,
  type BuyerMissionRecord,
} from '@/lib/buyerIntakeShared';
import { bootstrapBuyerIntakePortal } from '@/lib/buyerIntakePortalBootstrap.server';

export type PersistBuyerIntakeContactInput = {
  mission: BuyerMissionRecord;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
};

export type PersistBuyerIntakeContactResult = {
  clientId: number;
  deskCaseId: number;
  reusedClient: boolean;
  portalToken: string | null;
  intelligenceSent: boolean;
  firstOfferId: number | null;
  intelligenceSkipReason: string | null;
  welcomeEmailSent: boolean;
};

export async function persistBuyerIntakeContact(
  input: PersistBuyerIntakeContactInput,
): Promise<PersistBuyerIntakeContactResult> {
  const { mission } = input;
  if (!isBuyerStep3Complete(mission)) {
    throw new Error('INCOMPLETE_MISSION');
  }

  const phone = normalizePhoneE164(input.phone);
  if (!phone) {
    throw new Error('INVALID_PHONE');
  }

  await ensureDeskSchema();

  const agencyUserId = mission.agentUserId;
  const email = normalizeBuyerContactEmail(input.email);
  const prefData = buyerMissionToBuyerPrefCreate(mission);
  const qualificationMeta = buyerMissionQualificationMeta(mission);

  const existing = await findExistingAgencyClient({ agencyUserId, email, phone });
  let client = existing;
  let reusedClient = Boolean(existing);

  if (!client) {
    const linkedUserId = await ensureAgencyClientLinkedUser({
      email,
      phone,
      name: `${input.firstName} ${input.lastName}`.trim(),
    });
    client = await prisma.agencyClient.create({
      data: {
        agencyUserId,
        type: 'BUYER',
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        phone,
        linkedUserId,
        portalToken: generatePortalToken(),
        notes: `Lead z /szukam · ${mission.city || '—'}`,
      },
    });
    reusedClient = false;
  } else {
    await prisma.agencyClient.update({
      where: { id: client.id },
      data: {
        firstName: client.firstName || input.firstName,
        lastName: client.lastName === '—' ? input.lastName : client.lastName,
        email: client.email || email,
        phone: client.phone || phone,
        notes: [client.notes, `Lead z /szukam · ${new Date().toLocaleDateString('pl-PL')}`]
          .filter(Boolean)
          .join('\n'),
        ...(client.type === 'SELLER' ? {} : { type: 'BUYER' }),
      },
    });
  }

  await prisma.agencyClientBuyerPreference.upsert({
    where: { clientId: client.id },
    create: {
      clientId: client.id,
      ...prefData,
      transactionType: prefData.transactionType as TransactionType,
      propertyType: prefData.propertyType as PropertyType,
    },
    update: {
      ...prefData,
      transactionType: prefData.transactionType as TransactionType,
      propertyType: prefData.propertyType as PropertyType,
    },
  });

  let deskCase = await prisma.deskCase.findFirst({
    where: { agencyUserId, clientId: client.id, kind: 'BUY' },
    orderBy: { updatedAt: 'desc' },
  });

  const prevMeta =
    deskCase?.metadata && typeof deskCase.metadata === 'object'
      ? (deskCase.metadata as Record<string, unknown>)
      : {};

  if (!deskCase) {
    deskCase = await prisma.deskCase.create({
      data: {
        agencyUserId,
        clientId: client.id,
        kind: 'BUY',
        pipelineStage: 'QUALIFIED',
        source: 'buyer_intake_szukam',
        sourceUrl: '/szukam',
        title: `${input.firstName} ${input.lastName} · kupujący`,
        nextAction: 'Zadzwoń i potwierdź kryteria',
        nextActionAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        temperature: 'HOT',
        health: 'HEALTHY',
        metadata: { qualification: qualificationMeta },
      },
    });
    await dispatchDeskWorkflow({
      agencyUserId,
      caseId: deskCase.id,
      trigger: 'BUYER_QUALIFIED',
      payload: { source: 'buyer_intake_szukam' },
    });
  } else {
    deskCase = await prisma.deskCase.update({
      where: { id: deskCase.id },
      data: {
        pipelineStage: deskCase.pipelineStage === 'INQUIRY' ? 'QUALIFIED' : deskCase.pipelineStage,
        source: deskCase.source || 'buyer_intake_szukam',
        metadata: { ...prevMeta, qualification: qualificationMeta },
        nextAction: 'Zadzwoń i potwierdź kryteria',
        nextActionAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        temperature: 'HOT',
      },
    });
  }

  await prisma.agencyClientActivity.create({
    data: {
      clientId: client.id,
      agencyUserId,
      kind: 'BUYER_INTAKE',
      title: 'Zgłoszenie z /szukam',
      body: [mission.city, mission.budgetMax ? `budżet ${mission.budgetMax}` : null]
        .filter(Boolean)
        .join(' · '),
      metadata: {
        mission: {
          propertyType: mission.propertyType,
          transactionType: mission.transactionType,
          purchaseTimeline: mission.purchaseTimeline,
        },
        deskCaseId: deskCase.id,
      },
    },
  });

  await refreshAgencyClientMatches(client.id);

  const bootstrap = await bootstrapBuyerIntakePortal(client.id);

  if (bootstrap.intelligenceSent) {
    await prisma.deskCase.update({
      where: { id: deskCase.id },
      data: {
        nextAction: 'Czekaj na reakcję klienta w panelu',
        nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  return {
    clientId: client.id,
    deskCaseId: deskCase.id,
    reusedClient,
    portalToken: bootstrap.portalToken,
    intelligenceSent: bootstrap.intelligenceSent,
    firstOfferId: bootstrap.firstOfferId,
    intelligenceSkipReason: bootstrap.intelligenceSkipReason,
    welcomeEmailSent: bootstrap.welcomeEmailSent,
  };
}
