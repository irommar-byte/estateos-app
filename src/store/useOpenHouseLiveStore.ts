import { create } from 'zustand';
import type { OpenHouseTickerItem } from '../contracts/openHouseContract';

export type LiveBannerPhase =
  | 'hidden'
  | 'hero'
  | 'typing'
  | 'genie'
  | 'docked';

type PlusAnchor = { x: number; y: number };

function itemsSignature(items: OpenHouseTickerItem[]): string {
  return items.map((i) => i.id).join('|');
}

type State = {
  items: OpenHouseTickerItem[];
  index: number;
  phase: LiveBannerPhase;
  panelOpen: boolean;
  plusAnchor: PlusAnchor;
  offerPillTopY: number;
  reservedEventIds: number[];
  /** Dla jakiej paczki ogłoszeń banner już się odtworzył. */
  bannerPlayedForSig: string | null;
  /** Użytkownik otworzył panel Live i „odczytał" komunikaty. */
  livePanelAcknowledged: boolean;
  setItems: (items: OpenHouseTickerItem[]) => void;
  setIndex: (index: number | ((prev: number) => number)) => void;
  setPhase: (phase: LiveBannerPhase) => void;
  setPanelOpen: (open: boolean) => void;
  setPlusAnchor: (anchor: PlusAnchor) => void;
  setOfferPillTopY: (y: number) => void;
  setReservedEventIds: (ids: number[]) => void;
  addReservedEventId: (eventId: number) => void;
  removeReservedEventId: (eventId: number) => void;
  markBannerPlayed: () => void;
  openPanel: () => void;
  closePanel: () => void;
  dockToPlus: () => void;
  /** silent: tylko badge na „+”, bez animowanego paska na mapie */
  showBanner: (options?: { silent?: boolean }) => void;
  hasLiveUnread: () => boolean;
};

export const useOpenHouseLiveStore = create<State>((set, get) => ({
  items: [],
  index: 0,
  phase: 'hidden',
  panelOpen: false,
  plusAnchor: { x: 0, y: 0 },
  offerPillTopY: 0,
  reservedEventIds: [],
  bannerPlayedForSig: null,
  livePanelAcknowledged: true,
  setItems: (items) => {
    const nextSig = itemsSignature(items);
    const prevSig = itemsSignature(get().items);
    set({
      items,
      index: 0,
      ...(nextSig !== prevSig && prevSig !== ''
        ? { bannerPlayedForSig: null, livePanelAcknowledged: true }
        : {}),
    });
  },
  setIndex: (index) =>
    set((s) => ({
      index: typeof index === 'function' ? index(s.index) : index,
    })),
  setPhase: (phase) => set({ phase }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setPlusAnchor: (plusAnchor) => set({ plusAnchor }),
  setOfferPillTopY: (offerPillTopY) => set({ offerPillTopY }),
  setReservedEventIds: (reservedEventIds) => set({ reservedEventIds }),
  addReservedEventId: (eventId) =>
    set((s) => ({
      reservedEventIds: s.reservedEventIds.includes(eventId)
        ? s.reservedEventIds
        : [eventId, ...s.reservedEventIds],
    })),
  removeReservedEventId: (eventId) =>
    set((s) => ({
      reservedEventIds: s.reservedEventIds.filter((id) => id !== eventId),
    })),
  markBannerPlayed: () => {
    const sig = itemsSignature(get().items);
    set({
      bannerPlayedForSig: sig,
      phase: 'docked',
      livePanelAcknowledged: false,
    });
  },
  openPanel: () => set({ panelOpen: true, phase: 'docked', livePanelAcknowledged: true }),
  closePanel: () => set({ panelOpen: false }),
  dockToPlus: () => {
    const { phase } = get();
    if (phase === 'docked' || phase === 'genie' || phase === 'hidden') return;
    set({ phase: 'genie' });
  },
  showBanner: (options) => {
    const { items, phase, panelOpen, bannerPlayedForSig } = get();
    if (!items.length || panelOpen) return;
    if (phase === 'hero' || phase === 'typing' || phase === 'genie') return;
    const sig = itemsSignature(items);
    if (bannerPlayedForSig === sig) return;
    if (options?.silent) {
      set({ phase: 'docked', panelOpen: false, index: 0, livePanelAcknowledged: false });
      return;
    }
    set({ phase: 'hero', panelOpen: false, index: 0 });
  },
  hasLiveUnread: () => {
    const { items, livePanelAcknowledged } = get();
    return items.length > 0 && !livePanelAcknowledged;
  },
}));
