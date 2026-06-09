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

export type ContactMessageRow = {
  id: number;
  threadId: number;
  senderId: number;
  content: string;
  attachment?: string | null;
  isRead?: boolean;
  createdAt: string;
};

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function fetchContactThreadsWeb(): Promise<{ threads: ContactThreadRow[]; totalUnread: number }> {
  const res = await fetch('/api/contact/threads', { cache: 'no-store', credentials: 'include' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(json?.error || 'Nie udało się pobrać wątków.'));
  const threads = Array.isArray(json?.threads) ? json.threads : [];
  const totalUnread =
    Number(json?.totalUnread) ||
    threads.reduce((sum: number, row: ContactThreadRow) => sum + Number(row.unread ?? row.unreadCount ?? 0), 0);
  return { threads, totalUnread };
}

export async function initContactThreadWeb(peerUserId: number): Promise<ContactThreadRow> {
  const res = await fetch('/api/contact/threads', {
    method: 'POST',
    headers: jsonHeaders,
    credentials: 'include',
    body: JSON.stringify({ peerUserId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.thread) {
    throw new Error(String(json?.error || 'Nie udało się otworzyć czatu.'));
  }
  return json.thread as ContactThreadRow;
}

export async function fetchContactMessagesWeb(
  threadId: number
): Promise<{ messages: ContactMessageRow[]; isTyping?: boolean }> {
  const res = await fetch(`/api/contact/threads/${threadId}/messages?t=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'include',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(json?.error || 'Nie udało się pobrać wiadomości.'));
  return {
    messages: Array.isArray(json?.messages) ? json.messages : [],
    isTyping: Boolean(json?.isTyping),
  };
}

export async function sendContactMessageWeb(threadId: number, content: string): Promise<ContactMessageRow> {
  const res = await fetch(`/api/contact/threads/${threadId}/messages`, {
    method: 'POST',
    headers: jsonHeaders,
    credentials: 'include',
    body: JSON.stringify({ content }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.message) {
    throw new Error(String(json?.error || 'Nie udało się wysłać wiadomości.'));
  }
  return json.message as ContactMessageRow;
}

export async function sendContactTypingWeb(threadId: number): Promise<void> {
  try {
    await fetch(`/api/contact/threads/${threadId}/typing`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    /* noop */
  }
}

export const CONTACT_UNREAD_REFRESH_EVENT = 'estateos:contact-unread-refresh';

export function dispatchContactUnreadRefresh(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONTACT_UNREAD_REFRESH_EVENT));
  }
}
