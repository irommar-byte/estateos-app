import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { useUnreadBadgeStore } from '../store/useUnreadBadgeStore';
import {
  fetchContactMessages,
  fetchContactThreads,
  sendContactMessage,
  type ContactThreadRow,
} from '../services/contactService';
import { API_URL } from '../config/network';
import { postDealroomTextMessage } from '../utils/dealroomOfferReserve';

export type QuickReplyTarget =
  | {
      kind: 'contact';
      threadId: number;
      title: string;
      preview?: string;
      unread: number;
    }
  | {
      kind: 'deal';
      dealId: number;
      title: string;
      preview?: string;
      unread: number;
    };

function threadUnread(t: ContactThreadRow): number {
  return Math.max(0, Number(t.unread ?? t.unreadCount ?? 0));
}

function pickLatestContact(threads: ContactThreadRow[]): QuickReplyTarget | null {
  const unread = threads
    .filter((t) => threadUnread(t) > 0)
    .sort((a, b) => {
      const ta = Date.parse(String(a.updatedAt || 0)) || 0;
      const tb = Date.parse(String(b.updatedAt || 0)) || 0;
      return tb - ta;
    });
  const top = unread[0];
  if (!top) return null;
  return {
    kind: 'contact',
    threadId: Number(top.id),
    title: String(top.peerUserName || top.peer?.name || 'Wiadomość'),
    preview: top.lastMessage ? String(top.lastMessage) : undefined,
    unread: threadUnread(top),
  };
}

async function pickLatestDeal(token: string): Promise<QuickReplyTarget | null> {
  try {
    const res = await fetch(`${API_URL}/api/mobile/v1/deals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    const deals = Array.isArray(json?.deals) ? json.deals : Array.isArray(json?.items) ? json.items : [];
    const unread = deals
      .filter((d: any) => Number(d?.unread || 0) > 0)
      .sort((a: any, b: any) => {
        const ta = Date.parse(String(a?.updatedAt || a?.lastMessageAt || 0)) || 0;
        const tb = Date.parse(String(b?.updatedAt || b?.lastMessageAt || 0)) || 0;
        return tb - ta;
      });
    const top = unread[0];
    if (!top) return null;
    const dealId = Number(top.id || top.dealId);
    if (!dealId) return null;
    return {
      kind: 'deal',
      dealId,
      title: String(top.title || top.offerTitle || 'Dealroom'),
      preview: top.lastMessage ? String(top.lastMessage) : undefined,
      unread: Number(top.unread || 0),
    };
  } catch {
    return null;
  }
}

/**
 * Najnowszy wątek z nieprzeczytaną wiadomością (contact → deal)
 * do chmurki szybkiej odpowiedzi na Taśmach Market.
 */
export function useLatestUnreadQuickReply(enabled = true) {
  const token = useAuthStore((s) => s.token);
  const setUnreadContactCount = useUnreadBadgeStore((s) => s.setUnreadContactCount);
  const [target, setTarget] = useState<QuickReplyTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const dismissedUntilRef = useRef(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled || !token) {
      if (mountedRef.current) setTarget(null);
      return;
    }
    if (Date.now() < dismissedUntilRef.current) return;

    try {
      const threads = await fetchContactThreads(token);
      const contactTarget = pickLatestContact(threads);
      if (contactTarget) {
        if (mountedRef.current) setTarget(contactTarget);
        return;
      }
      const dealTarget = await pickLatestDeal(token);
      if (mountedRef.current) setTarget(dealTarget);
    } catch {
      // cicho — chmurka po prostu się nie pokaże
    }
  }, [enabled, token]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setTarget(null);
      return;
    }
    void refresh();
    const id = setInterval(() => void refresh(), 18_000);
    const onApp = (state: AppStateStatus) => {
      if (state === 'active') void refresh();
    };
    const sub = AppState.addEventListener('change', onApp);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
      sub.remove();
    };
  }, [enabled, refresh]);

  const sendReply = useCallback(
    async (text: string): Promise<{ ok: boolean; error?: string }> => {
      const trimmed = text.trim();
      if (!token || !target || !trimmed) {
        return { ok: false, error: 'Brak treści' };
      }
      setLoading(true);
      try {
        if (target.kind === 'contact') {
          await sendContactMessage(token, target.threadId, trimmed);
          // Oznacz wątek jako przeczytany bez nawigacji do Wiadomości.
          await fetchContactMessages(token, target.threadId).catch(() => undefined);
          try {
            const threads = await fetchContactThreads(token);
            setUnreadContactCount(
              threads.reduce(
                (acc, t) => acc + Math.max(0, Number(t.unread ?? t.unreadCount ?? 0)),
                0,
              ),
            );
          } catch {
            /* ignore */
          }
        } else {
          const ok = await postDealroomTextMessage({
            dealId: target.dealId,
            token,
            content: trimmed,
          });
          if (!ok) return { ok: false, error: 'Nie udało się wysłać' };
        }
        dismissedUntilRef.current = Date.now() + 8_000;
        if (mountedRef.current) setTarget(null);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: String(e?.message || 'Nie udało się wysłać') };
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [token, target, setUnreadContactCount],
  );

  const clearLocal = useCallback(() => {
    dismissedUntilRef.current = Date.now() + 8_000;
    setTarget(null);
  }, []);

  return {
    target,
    unreadCount: target?.unread ?? 0,
    hasUnread: Boolean(target),
    loading,
    refresh,
    sendReply,
    clearLocal,
  };
}
