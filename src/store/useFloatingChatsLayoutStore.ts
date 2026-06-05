import { create } from 'zustand';

export type FloatingChatsAnchor =
  | { mode: 'default' }
  | { mode: 'radarFilter'; top: number; right: number };

type State = {
  anchor: FloatingChatsAnchor;
  setAnchor: (anchor: FloatingChatsAnchor) => void;
};

export const useFloatingChatsLayoutStore = create<State>((set) => ({
  anchor: { mode: 'default' },
  setAnchor: (anchor) => set({ anchor }),
}));
