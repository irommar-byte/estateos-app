import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DiscoveryFeedProfile } from '../contracts/discoveryContracts';
import type { DiscoverySession } from '../services/discoveryService';

const PROFILE_KEY_PREFIX = '@estateos_discovery_profile_v2';

type DiscoveryLocalProfile = {
  preferredBudgetPln: number | null;
  preferredAreaM2: number | null;
  interactions: number;
  confidence: number;
  contradictionIndex: number;
  explorationHunger: number;
  searchPhase: string;
};

type DiscoveryState = {
  session: DiscoverySession | null;
  profile: DiscoveryLocalProfile | null;
  hydratedForUserId: string | null;
  setSession: (session: DiscoverySession | null) => void;
  mergeServerProfile: (profile: DiscoveryFeedProfile | null) => void;
  hydrate: (userId: string | number | null | undefined) => Promise<void>;
  persist: (userId: string | number | null | undefined) => Promise<void>;
  clear: () => void;
};

function key(userId: string | number | null | undefined) {
  return `${PROFILE_KEY_PREFIX}:${userId || 'guest'}`;
}

function normalize(profile: DiscoveryFeedProfile | DiscoveryLocalProfile | null): DiscoveryLocalProfile | null {
  if (!profile) return null;
  return {
    preferredBudgetPln: profile.preferredBudgetPln ?? null,
    preferredAreaM2: profile.preferredAreaM2 ?? null,
    interactions: Number(profile.interactions || 0),
    confidence: Number(profile.confidence || 0),
    contradictionIndex: Number(profile.contradictionIndex || 0),
    explorationHunger: Number(profile.explorationHunger ?? 1),
    searchPhase: String(profile.searchPhase || 'ACTIVE'),
  };
}

export const useDiscoveryStore = create<DiscoveryState>((set, get) => ({
  session: null,
  profile: null,
  hydratedForUserId: null,
  setSession: (session) => set({ session }),
  mergeServerProfile: (profile) => {
    const next = normalize(profile);
    if (!next) return;
    set((state) => ({ profile: { ...(state.profile || next), ...next } }));
  },
  hydrate: async (userId) => {
    try {
      const raw = await AsyncStorage.getItem(key(userId));
      const profile = raw ? normalize(JSON.parse(raw)) : null;
      set({ profile, hydratedForUserId: String(userId || 'guest') });
    } catch {
      set({ hydratedForUserId: String(userId || 'guest') });
    }
  },
  persist: async (userId) => {
    const profile = get().profile;
    if (!profile) return;
    await AsyncStorage.setItem(key(userId), JSON.stringify(profile));
  },
  clear: () => set({ session: null, profile: null, hydratedForUserId: null }),
}));
