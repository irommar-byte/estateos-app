/** Unikalny dźwięk push EstateOS (plik w bundlu iOS/Android). */
export const ESTATEOS_NOTIFY_SOUND = 'estateos_notify.wav';

/** Kanał Android z custom sound — nowy id, bo Android zamraża ustawienia kanału. */
export const CONTACT_PUSH_CHANNEL_ID = 'contact-messages-v2';

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
    sound: ESTATEOS_NOTIFY_SOUND,
    channelId: CONTACT_PUSH_CHANNEL_ID,
    /** Zamienia poprzedni banner tej samej rozmowy (WhatsApp-style). */
    collapseId: threadIdentifier,
    /** Android: zamiana już wyświetlonego powiadomienia tej rozmowy. */
    tag: androidGroup,
    /** NSE ustawia threadIdentifier z data (Expo nie mapuje oficjalnie thread-id). */
    mutableContent: true,
    ios: {
      threadId: threadIdentifier,
      sound: ESTATEOS_NOTIFY_SOUND,
    },
    android: {
      channelId: CONTACT_PUSH_CHANNEL_ID,
      group: androidGroup,
      groupId: androidGroup,
      sound: ESTATEOS_NOTIFY_SOUND,
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
