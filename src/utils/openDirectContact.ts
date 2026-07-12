import { Alert } from 'react-native';
import { initContactThread } from '../services/contactService';
import { useFloatingChatsStore } from '../store/useFloatingChatsStore';
import { t } from '../i18n';
import { navigateToContactChat } from './navigateToContactChat';

export async function openDirectContactChat(
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    dispatch?: (action: unknown) => void;
    getState?: () => unknown;
  },
  token: string | null | undefined,
  peerUserId: number,
  peerName?: string
): Promise<void> {
  if (!token) {
    Alert.alert(t('contact.errors.title'), t('contact.errors.loginRequired'));
    return;
  }
  const peerId = Number(peerUserId);
  if (!Number.isFinite(peerId) || peerId <= 0) return;

  try {
    const thread = await initContactThread(token, peerId);
    const name = peerName || thread.peerUserName || thread.peer?.name || t('contact.peerFallback', { id: peerId });
    useFloatingChatsStore.getState().upsertThread({
      threadId: thread.id,
      peerUserId: peerId,
      peerName: name,
      peerImage: thread.peer?.image ?? null,
    });
    navigateToContactChat(navigation as Parameters<typeof navigateToContactChat>[0], {
      threadId: thread.id,
      peerUserId: peerId,
      peerName: name,
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : '';
    const message =
      raw === 'CONTACT_API_NOT_DEPLOYED'
        ? t('contact.errors.serverNotReady')
        : raw || t('contact.errors.openFailed');
    Alert.alert(t('contact.errors.title'), message);
  }
}
