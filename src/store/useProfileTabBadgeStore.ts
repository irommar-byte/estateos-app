import { create } from 'zustand';

/**
 * Suma czerwonych badge'y na ekranie Profil (sesje zdjęciowe, zadania admina itd.).
 *
 * `ProfileScreen` aktualizuje store po lokalnym przeliczeniu sekcji.
 * `App.tsx` woła `refreshProfileTabBadgeCounts` przy starcie / push / powrocie z tła,
 * żeby badge był widoczny na zakładce Profil nawet zanim użytkownik wejdzie w ekran.
 */
interface ProfileTabBadgeState {
  profilePendingCount: number;
  setProfilePendingCount: (count: number) => void;
}

export const useProfileTabBadgeStore = create<ProfileTabBadgeState>((set) => ({
  profilePendingCount: 0,
  setProfilePendingCount: (count: number) =>
    set((prev) => {
      const next = Math.max(0, Math.round(Number(count) || 0));
      return prev.profilePendingCount === next ? prev : { ...prev, profilePendingCount: next };
    }),
}));
