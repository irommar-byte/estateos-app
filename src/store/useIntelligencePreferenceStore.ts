import { create } from 'zustand';
import {
  fetchIntelligencePreference,
  readLocalIntelligencePreference,
  setIntelligencePreference,
} from '../services/intelligencePreferenceService';

type IntelligencePreferenceState = {
  enabled: boolean;
  decided: boolean;
  hydrated: boolean;
  hydrate: (token?: string | null) => Promise<void>;
  setEnabled: (token: string | null | undefined, next: boolean) => Promise<void>;
};

export const useIntelligencePreferenceStore = create<IntelligencePreferenceState>((set, get) => ({
  enabled: false,
  decided: false,
  hydrated: false,

  hydrate: async (token) => {
    const local = await readLocalIntelligencePreference();
    set({
      enabled: local.enabled,
      decided: local.decided,
      hydrated: true,
    });
    if (!token) return;
    const remote = await fetchIntelligencePreference(token);
    if (!remote) return;
    set({
      enabled: remote.enabled,
      decided: remote.decided,
      hydrated: true,
    });
  },

  setEnabled: async (token, next) => {
    set({ enabled: next, decided: true, hydrated: true });
    const saved = await setIntelligencePreference(token, next);
    // Avoid clobbering a newer local toggle while the request was in flight.
    if (get().enabled === next || get().enabled === saved.enabled) {
      set({
        enabled: saved.enabled,
        decided: saved.decided,
        hydrated: true,
      });
    }
  },
}));
