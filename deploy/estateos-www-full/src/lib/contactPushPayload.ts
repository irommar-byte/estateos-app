/** Jeden stos powiadomień iOS/Android per rozmówca (nadawca). */
export function contactPushThreadIdentifier(senderUserId: number): string {
  return `estateos-contact-peer-${senderUserId}`;
}

export function buildContactMessagePushPayload(params: {
  senderName: string;
  preview: string;
  threadId: number;
  senderUserId: number;
}) {
  const threadIdentifier = contactPushThreadIdentifier(params.senderUserId);
  const androidGroup = `contact-thread-${params.threadId}`;

  return {
    title: params.senderName,
    subtitle: 'EstateOS Contact',
    body: params.preview,
    channelId: 'contact-messages',
    ios: {
      threadId: threadIdentifier,
    },
    android: {
      channelId: 'contact-messages',
      group: androidGroup,
      groupId: androidGroup,
    },
    data: {
      target: 'contact',
      targetType: 'CONTACT',
      threadId: String(params.threadId),
      peerUserId: String(params.senderUserId),
      peerName: params.senderName,
      notificationType: 'CONTACT_MESSAGE',
      threadIdentifier,
    },
  };
}
