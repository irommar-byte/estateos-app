import { prisma } from '@/lib/prisma';
import { parseClientOfferFeedback } from '@/lib/crm/clientPortalFeedback';
import { sendIntelligenceOffer, pickIntelligenceOffer } from '@/lib/crm/clientIntelligenceRun';
import { autoSupplyClientFromNieruchomosciOnline } from '@/lib/crm/clientIntelligencePortalSupply';
import {
  createAndDeliverCheckback,
  detectExtremeCheckback,
  feedbackRequestsHandoff,
  getPendingCheckback,
  intelligenceNeedsHunt,
  INTELLIGENCE_ACTIVITY,
} from '@/lib/crm/intelligenceCheckback';
import { buildHandoffDialogueTurn } from '@/lib/crm/intelligenceDialogue';
import { sendPortalChat } from '@/lib/crm/portalChat';
import { notifyAgencyClientAboutOffer } from '@/lib/agencyClientNotify';
import { crmAgentPushData } from '@/lib/crm/agentPush';
import { sendNotification } from '@/lib/core/notification.core';

export type FeedbackReplyResult = {
  action: 'checkback' | 'sent' | 'handoff' | 'pending_blocked' | 'none' | 'error';
  message?: string;
  emailSent?: boolean;
};

async function notifyAgentHandoff(agencyUserId: number, clientId: number, body: string) {
  await sendNotification({
    userId: agencyUserId,
    type: 'CRM_EVENT',
    title: 'Klient prosi o kontakt',
    body: body.slice(0, 160),
    data: crmAgentPushData(clientId, { notificationType: 'crm_client' }),
  }).catch(() => {});
}

export async function handleIntelligenceAfterFeedback(params: {
  clientId: number;
  agencyUserId: number;
  matchId: number;
  agentFirstName?: string | null;
}): Promise<FeedbackReplyResult> {
  const pending = await getPendingCheckback(params.clientId);
  if (pending) {
    return { action: 'pending_blocked', message: 'Czekam na odpowiedź na poprzednie pytanie.' };
  }

  const match = await prisma.agencyClientMatch.findFirst({
    where: { id: params.matchId, clientId: params.clientId },
    select: { clientFeedback: true, offerId: true },
  });
  const feedback = parseClientOfferFeedback(match?.clientFeedback);
  const handoffReason = feedbackRequestsHandoff(feedback);
  if (handoffReason) {
    const turn = buildHandoffDialogueTurn({ reason: handoffReason, agentFirstName: params.agentFirstName });
    await prisma.agencyClientActivity.create({
      data: {
        clientId: params.clientId,
        agencyUserId: params.agencyUserId,
        kind: INTELLIGENCE_ACTIVITY.HANDOFF,
        title: 'Przekazanie do agenta',
        body: turn.body,
        offerId: match?.offerId || null,
        metadata: { matchId: params.matchId, reason: handoffReason },
      },
    });
    await sendPortalChat({
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      from: 'agent',
      content: turn.body,
    }).catch(() => {});
    await notifyAgentHandoff(params.agencyUserId, params.clientId, handoffReason);
    return { action: 'handoff', message: handoffReason };
  }

  const extreme = await detectExtremeCheckback({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    agentFirstName: params.agentFirstName,
  });
  if (extreme) {
    await createAndDeliverCheckback({
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      turn: extreme,
    });
    return { action: 'checkback', message: extreme.body };
  }

  let result = await sendIntelligenceOffer({
    clientId: params.clientId,
    ignoreInterval: true,
    replyToFeedback: true,
  });

  if (!result.sent) {
    const preview = await pickIntelligenceOffer(params.clientId, {
      preview: true,
      ignoreInterval: true,
      replyToFeedback: true,
    });
    const needsHunt = intelligenceNeedsHunt(preview.pick.skipReason, preview.pick.offerId);
    if (needsHunt) {
      const supply = await autoSupplyClientFromNieruchomosciOnline({
        clientId: params.clientId,
        agencyUserId: params.agencyUserId,
      });
      if (supply.imported > 0) {
        result = await sendIntelligenceOffer({
          clientId: params.clientId,
          ignoreInterval: true,
          replyToFeedback: true,
        });
      }
    }
  }

  if (result.sent) {
    return { action: 'sent', emailSent: result.emailSent };
  }
  return { action: 'none', message: result.pick.skipReason || undefined };
}

export async function handleCheckbackFollowUpSend(params: {
  clientId: number;
  agencyUserId: number;
}): Promise<FeedbackReplyResult> {
  const result = await sendIntelligenceOffer({
    clientId: params.clientId,
    ignoreInterval: true,
    replyToFeedback: true,
  });
  if (result.sent) return { action: 'sent', emailSent: result.emailSent };
  const supply = await autoSupplyClientFromNieruchomosciOnline({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
  });
  if (supply.imported > 0) {
    const retry = await sendIntelligenceOffer({
      clientId: params.clientId,
      ignoreInterval: true,
      replyToFeedback: true,
    });
    if (retry.sent) return { action: 'sent', emailSent: retry.emailSent };
  }
  return { action: 'none', message: result.pick.skipReason || undefined };
}

/** Portal chat + email mirror for intelligence offer (used when send already happened via notify). */
export async function mirrorIntelligenceOfferToChat(params: {
  clientId: number;
  agencyUserId: number;
  offerId: number;
  body: string;
}) {
  await sendPortalChat({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    from: 'agent',
    content: params.body,
  }).catch(() => {});
}

export { notifyAgencyClientAboutOffer };
