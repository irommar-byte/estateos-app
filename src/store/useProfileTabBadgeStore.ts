import { create } from 'zustand';

/**
 * Suma czerwonych badge'y w sekcji administratora na ekranie Profil
 * (baza ofert + zgłoszenia UGC + weryfikacja prawna).
 *
 * `ProfileScreen` jest źródłem prawdy — po każdym odświeżeniu liczników
 * zapisuje sumę tutaj. `App.tsx` czyta ją wyłącznie pod `tabBarBadge` zakładki Profil.
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
