import { ESTATEOS_NOTIFY_SOUND } from '@/lib/contactPushPayload';

export const DEALROOM_PUSH_CHANNEL_ID = 'dealroom-messages-v2';

export function dealroomPushThreadIdentifier(dealId: number | string): string {
  return `estateos-deal-${dealId}`;
}

export function buildDealroomMessagePushPayload(params: {
  dealId: number;
  preview: string;
  senderId?: number | string | null;
  senderName?: string | null;
  offerId?: number | string | null;
  title?: string;
}) {
  const threadIdentifier = dealroomPushThreadIdentifier(params.dealId);
  const androidGroup = `deal-thread-${params.dealId}`;
  const title = params.title || 'Nowa wiadomość w Dealroom';

  return {
    title,
    subtitle: `Transakcja #${params.dealId}`,
    body: params.preview,
    sound: ESTATEOS_NOTIFY_SOUND,
    channelId: DEALROOM_PUSH_CHANNEL_ID,
    mutableContent: true,
    threadIdentifier,
    ios: {
      threadId: threadIdentifier,
      sound: ESTATEOS_NOTIFY_SOUND,
    },
    android: {
      channelId: DEALROOM_PUSH_CHANNEL_ID,
      group: androidGroup,
      groupId: androidGroup,
      sound: ESTATEOS_NOTIFY_SOUND,
    },
    data: {
      target: 'dealroom',
      notificationType: 'dealroom_chat',
      targetType: 'DEAL',
      targetId: String(params.dealId),
      dealId: String(params.dealId),
      offerId: params.offerId != null ? String(params.offerId) : undefined,
      kind: 'deal_message',
      senderId: params.senderId != null ? String(params.senderId) : undefined,
      senderName: params.senderName || undefined,
      threadIdentifier,
      deeplink: `estateos://dealroom/${params.dealId}`,
      screen: 'DealroomChat',
      route: 'DealroomChat',
    },
  };
}
