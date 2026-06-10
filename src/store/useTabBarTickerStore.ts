import { create } from 'zustand';
import type { TabBarTickerMessage, TabBarTickerPhase } from '../contracts/tabBarTickerContract';
import { TAB_BAR_INFO_INTERVAL_MS } from '../contracts/tabBarTickerContract';

type State = {
  phase: TabBarTickerPhase;
  active: TabBarTickerMessage | null;
  pending: TabBarTickerMessage[];
  infoPool: TabBarTickerMessage[];
  infoIndex: number;
  nextInfoAt: number;
  /** Sygnał do komponentu UI — inkrementowany przy nowym immediate w stanie idle. */
  tick: number;
  /** 0 gdy idle — brak szarego paska, mapa dochodzi do tab bara. */
  grooveHeight: number;
  setPhase: (phase: TabBarTickerPhase) => void;
  setActive: (msg: TabBarTickerMessage | null) => void;
  setInfoPool: (pool: TabBarTickerMessage[]) => void;
  setGrooveHeight: (h: number) => void;
  enqueue: (msg: TabBarTickerMessage) => void;
  consumeNext: () => TabBarTickerMessage | null;
  markInfoCycleDone: () => void;
  bumpTick: () => void;
};

function dedupePush(list: TabBarTickerMessage[], msg: TabBarTickerMessage): TabBarTickerMessage[] {
  if (list.some((m) => m.id === msg.id)) return list;
  return [...list, msg];
}

export const useTabBarTickerStore = create<State>((set, get) => ({
  phase: 'idle',
  active: null,
  pending: [],
  infoPool: [],
  infoIndex: 0,
  nextInfoAt: Date.now(),
  tick: 0,
  grooveHeight: 0,
  setPhase: (phase) => set({ phase }),
  setActive: (active) => set({ active }),
  setInfoPool: (infoPool) => set({ infoPool }),
  setGrooveHeight: (grooveHeight) => set({ grooveHeight }),
  enqueue: (msg) => {
    if (msg.priority === 'immediate') {
      set((s) => ({
        pending: dedupePush(s.pending, msg),
        tick: s.phase === 'idle' ? s.tick + 1 : s.tick,
      }));
      return;
    }
    set((s) => ({
      infoPool: dedupePush(s.infoPool, msg),
    }));
  },
  consumeNext: () => {
    const { pending, infoPool, infoIndex, nextInfoAt } = get();
    if (pending.length > 0) {
      const [head, ...rest] = pending;
      set({ pending: rest });
      return head;
    }
    if (Date.now() < nextInfoAt || infoPool.length === 0) return null;
    const msg = infoPool[infoIndex % infoPool.length];
    set({ infoIndex: (infoIndex + 1) % infoPool.length });
    return msg;
  },
  markInfoCycleDone: () => {
    set({ nextInfoAt: Date.now() + TAB_BAR_INFO_INTERVAL_MS });
  },
  bumpTick: () => set((s) => ({ tick: s.tick + 1 })),
}));
