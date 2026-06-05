import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'estateos.contact.thread.prefs.v1';

type PrefsPayload = {
  order: number[];
  hidden: number[];
  aliases: Record<string, string>;
};

type State = {
  hydrated: boolean;
  order: number[];
  hidden: number[];
  aliases: Record<number, string>;
  hydrate: () => Promise<void>;
  setOrder: (threadIds: number[]) => Promise<void>;
  hideThread: (threadId: number) => Promise<void>;
  setAlias: (threadId: number, alias: string | null) => Promise<void>;
  getDisplayName: (threadId: number, fallback: string) => string;
};

async function persist(payload: PrefsPayload) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export const useContactThreadPrefsStore = create<State>((set, get) => ({
  hydrated: false,
  order: [],
  hidden: [],
  aliases: {},

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        set({ hydrated: true });
        return;
      }
      const parsed = JSON.parse(raw) as PrefsPayload;
      const aliases: Record<number, string> = {};
      for (const [k, v] of Object.entries(parsed.aliases || {})) {
        const id = Number(k);
        const label = String(v || '').trim();
        if (Number.isFinite(id) && id > 0 && label) aliases[id] = label;
      }
      set({
        hydrated: true,
        order: (parsed.order || []).filter((id) => Number.isFinite(id)),
        hidden: (parsed.hidden || []).filter((id) => Number.isFinite(id)),
        aliases,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setOrder: async (threadIds) => {
    const order = threadIds.filter((id) => Number.isFinite(id) && id > 0);
    set({ order });
    const s = get();
    await persist({
      order,
      hidden: s.hidden,
      aliases: Object.fromEntries(Object.entries(s.aliases).map(([k, v]) => [k, v])),
    });
  },

  hideThread: async (threadId) => {
    const hidden = [...new Set([...get().hidden, threadId])];
    set({ hidden });
    const s = get();
    await persist({
      order: s.order.filter((id) => id !== threadId),
      hidden,
      aliases: Object.fromEntries(Object.entries(s.aliases).map(([k, v]) => [k, v])),
    });
  },

  setAlias: async (threadId, alias) => {
    const next = { ...get().aliases };
    const label = String(alias || '').trim();
    if (!label) delete next[threadId];
    else next[threadId] = label;
    set({ aliases: next });
    const s = get();
    await persist({
      order: s.order,
      hidden: s.hidden,
      aliases: Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v])),
    });
  },

  getDisplayName: (threadId, fallback) => {
    const alias = get().aliases[threadId];
    return alias?.trim() || fallback;
  },
}));

export function sortContactThreads<T extends { id: number }>(
  threads: T[],
  order: number[],
  hidden: number[],
): T[] {
  const hiddenSet = new Set(hidden);
  const visible = threads.filter((t) => !hiddenSet.has(t.id));
  if (!order.length) return visible;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...visible].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return b.id - a.id;
  });
}
