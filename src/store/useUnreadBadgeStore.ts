import { create } from 'zustand';

/**
 * Globalny licznik nieprzeczytanych / „wymagających uwagi" dealroomów.
 *
 * KONTEKST
 * ────────
 * Na zakładce „Wiadomości" rysujemy czerwony badge z liczbą. Liczba ta MUSI
 * być spójna z czerwoną kropką pojawiającą się na karcie konkretnej transakcji
 * w `DealroomListScreen`. W przeciwnym wypadku użytkownik widzi czerwoną
 * kropkę przy karcie, a na zakładce 0 — co psuje zaufanie do systemu
 * powiadomień.
 *
 * Czerwona kropka NIE oznacza tylko `deal.unread > 0` (liczba nieprzeczytanych
 * wiadomości tekstowych). Pojawia się też, gdy partner skontrował cenę / termin
 * i to MY musimy zareagować (`needsReactionFromMessages`). Logika tej decyzji
 * żyje w `DealroomListScreen` (źródło prawdy), bo wymaga pełnych wątków
 * wiadomości — zbyt drogo dublować ją w `App.tsx`.
 *
 * DLATEGO
 * ───────
 * `DealroomListScreen` policzy badge i zapisze tu sumę. `App.tsx` jedynie czyta
 * tę liczbę i renderuje `tabBarBadge` + ustawia iOS Application Icon Badge.
 *
 * Domyślne `0` jest bezpieczne — pokazujemy badge dopiero, gdy dealroomy
 * faktycznie czegoś wymagają.
 */
interface UnreadBadgeState {
  /** Liczba dealroomów wymagających uwagi (suma kart z czerwoną kropką). */
  unreadDealCount: number;
  /** Setter — wywoływany z `DealroomListScreen` po każdym przeliczeniu. */
  setUnreadDealCount: (count: number) => void;
}

export const useUnreadBadgeStore = create<UnreadBadgeState>((set) => ({
  unreadDealCount: 0,
  setUnreadDealCount: (count: number) =>
    set((prev) => {
      const next = Math.max(0, Math.round(Number(count) || 0));
      // Mikrooptymalizacja — nie wymuszamy re-renderu jeśli wartość się nie zmieniła.
      // `App.tsx` przerysowuje cały tab bar przy każdej zmianie state'u licznika.
      return prev.unreadDealCount === next ? prev : { ...prev, unreadDealCount: next };
    }),
}));
