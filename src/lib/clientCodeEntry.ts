import { create } from 'zustand';

/**
 * Okno „Mam kod od agenta” — otwierane z ekranu logowania, z Profilu i z karty powitalnej.
 * Hostem jest App.tsx (ClientCodeHost), więc działa z każdego miejsca aplikacji.
 */
type ClientCodeEntryState = {
  visible: boolean;
  open: () => void;
  close: () => void;
};

export const useClientCodeEntry = create<ClientCodeEntryState>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));

export function openClientCodeEntry() {
  useClientCodeEntry.getState().open();
}
