import { API_URL } from '../config/network';
import { parseContactReactions } from '../utils/contactMessageReactions';

export type ContactThreadRow = {
  id: number;
  peerUserId: number;
  peerUserName: string;
  peer?: { id: number; name: string; email?: string | null; image?: string | null };
  lastMessage?: string;
  time?: string;
  unread?: number;
  unreadCount?: number;
  updatedAt?: string;
};

import type { ContactReactionsMap } from '../utils/contactMessageReactions';

export type ContactMessageRow = {
  id: number;
  threadId: number;
  senderId: number;
  content: string;
  attachment?: string | null;
  isRead?: boolean;
  reactions?: ContactReactionsMap;
  createdAt: string;
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function fetchContactThreads(token: string): Promise<ContactThreadRow[]> {
  const res = await fetch(`${API_URL}/api/mobile/v1/contact/threads`, {
    headers: authHeaders(token),
  });
  const json = await res.json().catch(() => ({}));
  const rows = Array.isArray(json?.threads) ? json.threads : Array.isArray(json?.items) ? json.items : [];
  return rows;
}

export async function initContactThread(
  token: string,
  peerUserId: number
): Promise<ContactThreadRow> {
  const res = await fetch(`${API_URL}/api/mobile/v1/contact/threads`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ peerUserId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.thread) {
    if (res.status === 404) {
      throw new Error('CONTACT_API_NOT_DEPLOYED');
    }
    throw new Error(String(json?.error || 'Nie udało się otworzyć czatu.'));
  }
  return json.thread as ContactThreadRow;
}

export async function fetchContactMessages(
  token: string,
  threadId: number
): Promise<{ messages: ContactMessageRow[]; isTyping?: boolean }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/contact/threads/${threadId}/messages?t=${Date.now()}`, {
    headers: authHeaders(token),
  });
  const json = await res.json().catch(() => ({}));
  const rows = Array.isArray(json?.messages) ? json.messages : [];
  return {
    messages: rows.map((m: ContactMessageRow & { reactions?: unknown }) => ({
      ...m,
      reactions: parseContactReactions(m.reactions),
    })),
    isTyping: Boolean(json?.isTyping),
  };
}

export async function sendContactMessage(
  token: string,
  threadId: number,
  content: string
): Promise<ContactMessageRow | null> {
  const res = await fetch(`${API_URL}/api/mobile/v1/contact/threads/${threadId}/messages`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ content: content.trim() }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(json?.error || 'Nie udało się wysłać wiadomości.'));
  return json?.message ?? null;
}

export async function sendContactTyping(token: string, threadId: number): Promise<void> {
  try {
    await fetch(`${API_URL}/api/mobile/v1/contact/threads/${threadId}/typing`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({}),
    });
  } catch {
    /* noop */
  }
}

export async function setContactMessageReaction(
  token: string,
  threadId: number,
  messageId: number,
  emoji: string | null,
): Promise<ContactMessageRow | null> {
  const res = await fetch(
    `${API_URL}/api/mobile/v1/contact/threads/${threadId}/messages/${messageId}/reaction`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ emoji }),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(json?.error || 'Nie udało się dodać reakcji.'));
  const msg = json?.message;
  if (!msg) return null;
  return {
    ...msg,
    reactions: parseContactReactions(msg.reactions),
  };
}

export function sumContactUnread(threads: ContactThreadRow[]): number {
  return threads.reduce((acc, t) => acc + Math.max(0, Number(t.unread ?? t.unreadCount ?? 0)), 0);
}

export async function deleteContactThread(token: string, threadId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/mobile/v1/contact/threads/${threadId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(json?.error || 'Nie udało się usunąć czatu.'));
}

export function contactThreadToFloatingEntry(
  thread: ContactThreadRow,
  displayName?: string,
): {
  threadId: number;
  peerUserId: number;
  peerName: string;
  peerImage?: string | null;
  unread?: number;
  lastPreview?: string;
} {
  return {
    threadId: thread.id,
    peerUserId: thread.peerUserId,
    peerName: displayName?.trim() || thread.peerUserName,
    peerImage: thread.peer?.image ?? null,
    unread: Math.max(0, Number(thread.unread ?? thread.unreadCount ?? 0)),
    lastPreview: thread.lastMessage,
  };
}
