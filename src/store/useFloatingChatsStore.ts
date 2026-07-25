import { create } from 'zustand';

export type FloatingChatEntry = {
  threadId: number;
  peerUserId: number;
  peerName: string;
  peerImage?: string | null;
  unread?: number;
  lastPreview?: string;
  peerIsOnline?: boolean;
  peerLastSeenAt?: string | null;
};

type State = {
  entries: FloatingChatEntry[];
  minimized: boolean;
  /** Ukryj cały dock (np. gdy otwarty pełnoekranowy ContactChat). */
  dockSuppressed: boolean;
  upsertThread: (entry: FloatingChatEntry) => void;
  removeThread: (threadId: number) => void;
  setMinimized: (minimized: boolean) => void;
  setDockSuppressed: (suppressed: boolean) => void;
  bumpUnread: (threadId: number, preview?: string) => void;
  clearUnread: (threadId: number) => void;
  syncEntries: (entries: FloatingChatEntry[]) => void;
};

const MAX_ENTRIES = 4;

export const useFloatingChatsStore = create<State>((set) => ({
  entries: [],
  minimized: true,
  dockSuppressed: false,
  upsertThread: (entry) =>
    set((s) => {
      const filtered = s.entries.filter((e) => e.threadId !== entry.threadId);
      const next = [{ ...entry, unread: entry.unread ?? 0 }, ...filtered].slice(0, MAX_ENTRIES);
      return { entries: next };
    }),
  removeThread: (threadId) =>
    set((s) => ({ entries: s.entries.filter((e) => e.threadId !== threadId) })),
  setMinimized: (minimized) => set({ minimized }),
  setDockSuppressed: (dockSuppressed) =>
    set((s) => ({
      dockSuppressed,
      minimized: dockSuppressed ? true : s.minimized,
    })),
  bumpUnread: (threadId, preview) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.threadId === threadId
          ? { ...e, unread: (e.unread ?? 0) + 1, lastPreview: preview ?? e.lastPreview }
          : e
      ),
    })),
  clearUnread: (threadId) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.threadId === threadId ? { ...e, unread: 0 } : e)),
    })),
  syncEntries: (entries) =>
    set((s) => {
      const next = entries.slice(0, MAX_ENTRIES);
      if (
        s.entries.length === next.length &&
        s.entries.every((e, i) => {
          const n = next[i];
          return (
            n &&
            e.threadId === n.threadId &&
            e.peerName === n.peerName &&
            (e.peerImage ?? null) === (n.peerImage ?? null) &&
            (e.unread ?? 0) === (n.unread ?? 0) &&
            (e.lastPreview ?? '') === (n.lastPreview ?? '') &&
            Boolean(e.peerIsOnline) === Boolean(n.peerIsOnline) &&
            (e.peerLastSeenAt ?? null) === (n.peerLastSeenAt ?? null)
          );
        })
      ) {
        return s;
      }
      return { entries: next };
    }),
}));
