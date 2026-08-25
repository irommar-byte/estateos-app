import { create } from 'zustand';
import {
  fetchIntelligencePreference,
  isIntelligenceEnablePromptSnoozed,
  readLocalIntelligencePreference,
  setIntelligencePreference,
  snoozeIntelligenceEnablePrompt,
} from '../services/intelligencePreferenceService';

type IntelligencePreferenceState = {
  enabled: boolean;
  decided: boolean;
  hydrated: boolean;
  synced: boolean;
  hydrate: (token?: string | null) => Promise<void>;
  setEnabled: (token: string | null | undefined, next: boolean) => Promise<void>;
  snoozeEnablePrompt: () => Promise<void>;
  isEnablePromptSnoozed: () => Promise<boolean>;
};

export const useIntelligencePreferenceStore = create<IntelligencePreferenceState>((set, get) => ({
  enabled: false,
  decided: false,
  hydrated: false,
  synced: false,

  hydrate: async (token) => {
    const local = await readLocalIntelligencePreference();
    set({
      enabled: local.enabled,
      decided: local.decided,
      hydrated: true,
      synced: !token,
    });
    if (!token) return;
    const remote = await fetchIntelligencePreference(token);
    if (!remote) {
      set({ synced: true });
      return;
    }
    set({
      enabled: remote.enabled,
      decided: remote.decided,
      hydrated: true,
      synced: true,
    });
  },

  setEnabled: async (token, next) => {
    set({ enabled: next, decided: true, hydrated: true, synced: true });
    const saved = await setIntelligencePreference(token, next);
    if (get().enabled === next || get().enabled === saved.enabled) {
      set({
        enabled: saved.enabled,
        decided: saved.decided,
        hydrated: true,
        synced: true,
      });
    }
  },

  snoozeEnablePrompt: async () => {
    await snoozeIntelligenceEnablePrompt();
  },

  isEnablePromptSnoozed: () => isIntelligenceEnablePromptSnoozed(),
}));
