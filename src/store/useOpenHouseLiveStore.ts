import { create } from 'zustand';
import type { OpenHouseTickerItem } from '../contracts/openHouseContract';

export type LiveBannerPhase = 'hidden' | 'entering' | 'visible' | 'genie' | 'docked';

type PlusAnchor = { x: number; y: number };

type State = {
  items: OpenHouseTickerItem[];
  index: number;
  phase: LiveBannerPhase;
  panelOpen: boolean;
  plusAnchor: PlusAnchor;
  setItems: (items: OpenHouseTickerItem[]) => void;
  setIndex: (index: number | ((prev: number) => number)) => void;
  setPhase: (phase: LiveBannerPhase) => void;
  setPanelOpen: (open: boolean) => void;
  setPlusAnchor: (anchor: PlusAnchor) => void;
  openPanel: () => void;
  closePanel: () => void;
  dockToPlus: () => void;
  showBanner: () => void;
};

export const useOpenHouseLiveStore = create<State>((set, get) => ({
  items: [],
  index: 0,
  phase: 'hidden',
  panelOpen: false,
  plusAnchor: { x: 0, y: 0 },
  setItems: (items) => set({ items, index: 0 }),
  setIndex: (index) =>
    set((s) => ({
      index: typeof index === 'function' ? index(s.index) : index,
    })),
  setPhase: (phase) => set({ phase }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setPlusAnchor: (plusAnchor) => set({ plusAnchor }),
  openPanel: () => set({ panelOpen: true, phase: 'docked' }),
  closePanel: () => set({ panelOpen: false }),
  dockToPlus: () => {
    const { phase } = get();
    if (phase === 'docked' || phase === 'genie' || phase === 'hidden') return;
    set({ phase: 'genie' });
  },
  showBanner: () => {
    const { items, phase } = get();
    if (!items.length) return;
    if (phase === 'visible' || phase === 'entering') return;
    set({ phase: 'entering', panelOpen: false });
  },
}));
