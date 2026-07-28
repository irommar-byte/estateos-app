import { create } from 'zustand';

type FeaturedCelebrationState = {
  visible: boolean;
  playToken: number;
  play: () => void;
  dismiss: () => void;
};

export const useFeaturedCelebrationStore = create<FeaturedCelebrationState>((set) => ({
  visible: false,
  playToken: 0,
  play: () => set((s) => ({ visible: true, playToken: s.playToken + 1 })),
  dismiss: () => set({ visible: false }),
}));

export function playFeaturedCelebration() {
  useFeaturedCelebrationStore.getState().play();
}
