import { create } from 'zustand';
import { AppState, type AppStateStatus } from 'react-native';
import { DEFAULT_EUR_PLN_RATE } from '../money/constants';
import { getEurPlnRate, startFxRateDailyScheduler } from '../money/fxRateService';
import type { FxRateSnapshot } from '../money/types';

type FxRateState = {
  rate: number;
  rateDate: string;
  source: string;
  sessionKey: string;
  loading: boolean;
  refresh: (force?: boolean) => Promise<FxRateSnapshot>;
  applySnapshot: (snap: FxRateSnapshot, sessionKey?: string) => void;
};

let schedulerStarted = false;
let appStateSub: { remove: () => void } | null = null;

export const useFxRateStore = create<FxRateState>((set, get) => ({
  rate: DEFAULT_EUR_PLN_RATE,
  rateDate: '',
  source: 'fallback',
  sessionKey: '',
  loading: false,

  applySnapshot: (snap, sessionKey) => {
    set({
      rate: snap.rate,
      rateDate: snap.date,
      source: snap.source || 'NBP',
      sessionKey: sessionKey || get().sessionKey,
      loading: false,
    });
  },

  refresh: async (force = false) => {
    set({ loading: true });
    try {
      const snap = await getEurPlnRate({ force });
      set({
        rate: snap.rate,
        rateDate: snap.date,
        source: snap.source || 'NBP',
        sessionKey: snap.sessionKey || get().sessionKey,
        loading: false,
      });
      return snap;
    } catch {
      set({ loading: false });
      return {
        rate: get().rate,
        date: get().rateDate,
        source: get().source,
      };
    }
  },
}));

/** Uruchamia scheduler 08:00 + odświeżenie przy powrocie aplikacji na pierwszy plan. */
export function bootstrapFxRateRefresh(): void {
  void useFxRateStore.getState().refresh();

  if (!schedulerStarted) {
    schedulerStarted = true;
    startFxRateDailyScheduler(() => {
      void useFxRateStore.getState().refresh(true);
    });
  }

  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void useFxRateStore.getState().refresh();
      }
    });
  }
}
