import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/core/notification.core';
import { crmAgentPushData } from '@/lib/crm/agentPush';
import { formatBuyerBudget, type BuyerMissionRecord } from '@/lib/buyerIntakeShared';

const PROPERTY_LABEL: Record<string, string> = { apartment: 'mieszkanie', house: 'dom', plot: 'działka', commercial: 'lokal' };

/**
 * Agent dostaje powiadomienie o nowym kliencie z formularza: kogo, czego szuka i ile ofert
 * system już dopasował — z jednego dotknięcia otwiera kartę klienta i wysyła pierwszą propozycję.
 */
export async function notifyAgentAboutBuyerIntake(params: {
  agencyUserId: number;
  clientId: number;
  clientName: string;
  mission: BuyerMissionRecord;
  reusedClient: boolean;
  firstOfferSent: boolean;
}): Promise<void> {
  const matches = await prisma.agencyClientMatch.count({
    where: { clientId: params.clientId, score: { gte: 60 }, notifiedAt: null },
  });
  const wanted = [
    PROPERTY_LABEL[String(params.mission.propertyType)] || null,
    params.mission.city,
    params.mission.budgetMax ? `do ${formatBuyerBudget(params.mission.budgetMax, params.mission.transactionType)}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const next = params.firstOfferSent
    ? 'Pierwsza propozycja poszła automatycznie.'
    : matches
      ? `${matches} dopasowanych ofert czeka — wyślij pierwszą albo włącz automatyczne propozycje.`
      : 'Brak dopasowań w bazie — zadzwoń i doprecyzuj kryteria.';

  await sendNotification({
    userId: params.agencyUserId,
    type: 'CRM_EVENT',
    title: params.reusedClient ? 'Klient uzupełnił kryteria' : 'Nowy klient kupujący',
    body: `${params.clientName}${wanted ? ` · ${wanted}` : ''}. ${next}`,
    data: crmAgentPushData(params.clientId, { notificationType: 'crm_buyer_intake' }),
    idempotencyKey: `buyer-intake:${params.clientId}:${new Date().toISOString().slice(0, 13)}`,
  });
}
