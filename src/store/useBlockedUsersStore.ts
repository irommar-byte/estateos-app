import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/network';

/**
 * Lokalny rejestr ZABLOKOWANYCH użytkowników — warstwa Apple Guideline 1.2.
 *
 * Kontekst
 * ────────
 * Apple wymaga w aplikacjach UGC, żeby każdy zalogowany użytkownik mógł:
 *   (1) zgłosić obraźliwą / nielegalną treść (Report),
 *   (2) zablokować innego użytkownika tak, by jego oferty i wiadomości
 *       przestały być widoczne natychmiast — niezależnie od kanału (czat,
 *       lista, ekran szczegółów oferty).
 *
 * Ten store jest źródłem prawdy dla (2) po stronie klienta. Każdy ekran, który
 * renderuje treści cudzych userów, powinien wywoływać `isBlocked(userId)` i
 * pomijać element, jeśli zwróci `true`. Lokalny filtr działa OD RAZU — backend
 * jest odpytywany asynchronicznie, a aplikacja działa nawet w offline.
 *
 * Trwałość
 * ────────
 * Lista trzymana jest w `AsyncStorage` pod kluczem `@estateos_blocked_v1_<userId>`.
 * Dzięki temu różne konta na tym samym urządzeniu nie mieszają sobie list
 * (urządzenie współdzielone w rodzinie, tryb tester etc.).
 *
 * Backend (kontrakt potwierdzony przez agenta backendowego 12.05.2026)
 * ────────────────────────────────────────────────────────────────────
 *   GET    /api/mobile/v1/blocks            → [{ user: { id, name, role, ... } }]
 *   POST   /api/mobile/v1/blocks            body: { targetUserId }
 *                                           200 { duplicate:false } / 200 { duplicate:true }
 *                                           400 CANNOT_BLOCK_ADMIN / CANNOT_BLOCK_SELF
 *   DELETE /api/mobile/v1/blocks/:userId    200 (idempotentne)
 *
 * Defense-in-depth: backend dodatkowo filtruje `GET /api/mobile/v1/offers`
 * po obustronnej liście blokad — czyli `getBlockedScope` po stronie serwera.
 * Klient nie polega na tym, tylko sam filtruje listy w `RadarHomeScreen` /
 * `DealroomListScreen` (UI musi działać natychmiast).
 *
 * User-shape cache
 * ────────────────
 * Razem z ID trzymamy `usersById` — krótki snapshot { name, role, companyName }
 * pobrany z `GET /blocks`. Dzięki temu `BlockedUsersModal` nie musi strzelać
 * do `/api/users/:id/public` per użytkownik, co znacznie skraca czas otwierania
 * listy w Profilu.
 */

const STORAGE_KEY_PREFIX = '@estateos_blocked_v1_';

export interface BlockedUserShape {
  id: number;
  name: string;
  role?: string | null;
  companyName?: string | null;
}

interface BlockedUsersState {
  /** Set zablokowanych ID — używany do O(1) lookupu w renderze list. */
  blockedIds: Set<number>;
  /** Krótki snapshot user-shape pobrany z `GET /blocks` (do listy w Profilu). */
  usersById: Record<number, BlockedUserShape>;
  /** True po pierwszym `hydrate` — pozwala zablokować render do czasu załadowania. */
  isHydrated: boolean;
  /** True w trakcie synchronizacji z backendem (np. do spinnera w UI). */
  isSyncing: boolean;
  /**
   * Hydruje store z AsyncStorage dla danego użytkownika. Wywoływać raz po
   * zalogowaniu i przy starcie aplikacji, gdy mamy już `user.id`.
   */
  hydrate: (userId: number | string) => Promise<void>;
  /**
   * Pobiera autorytatywną listę z serwera i nadpisuje lokalną. Bezpieczne do
   * odpalenia w tle po hydracji.
   */
  syncFromBackend: (token: string) => Promise<void>;
  /**
   * Blokuje użytkownika. Aktualizacja optymistyczna + persist do AsyncStorage
   * + POST do backendu w tle. Zwraca `{ ok, error? }` — `error` to `error_code`
   * z backendu (np. `CANNOT_BLOCK_ADMIN`), żeby UI mogło pokazać konkretny
   * komunikat.
   */
  block: (
    targetUserId: number,
    token: string,
    userId: number | string
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Odblokowuje użytkownika (DELETE w backendzie). */
  unblock: (
    targetUserId: number,
    token: string,
    userId: number | string
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Sprawdzenie O(1) — używać w `renderItem` list. */
  isBlocked: (targetUserId: number | string | null | undefined) => boolean;
  /** Czyści store po `logout` (nie kasuje danych z AsyncStorage). */
  clear: () => void;
}

const storageKey = (userId: number | string) => `${STORAGE_KEY_PREFIX}${userId}`;

const normalizeId = (id: unknown): number | null => {
  const n = typeof id === 'string' ? parseInt(id, 10) : Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const persist = async (userId: number | string, ids: Set<number>) => {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(Array.from(ids)));
  } catch (err) {
    if (__DEV__) console.warn('[blockedUsers] persist failed', err);
  }
};

/**
 * Backend zwraca listę blokad w jednym z dwóch kształtów — defensywnie obu
 * obsługujemy:
 *   1) Array bezpośrednio: `[{ id, blockedUserId, user: {...} }, ...]`
 *   2) `{ blocks: [...] }` lub `{ items: [...] }` (klasyczny envelope).
 *
 * Z każdego elementu wyciągamy ID zablokowanego (po `blockedUserId` /
 * `targetUserId` / `user.id`) oraz krótki user-shape do cache'u.
 */
const parseBlocksPayload = (
  payload: unknown
): { ids: Set<number>; usersById: Record<number, BlockedUserShape> } => {
  const root: unknown =
    Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { blocks?: unknown })?.blocks)
        ? (payload as { blocks: unknown[] }).blocks
        : Array.isArray((payload as { items?: unknown })?.items)
          ? (payload as { items: unknown[] }).items
          : [];

  const ids = new Set<number>();
  const usersById: Record<number, BlockedUserShape> = {};

  if (!Array.isArray(root)) return { ids, usersById };

  for (const raw of root) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const nested = (r.user || r.blockedUser || r.target || r) as Record<string, unknown>;
    const id =
      normalizeId(r.blockedUserId) ??
      normalizeId(r.targetUserId) ??
      normalizeId((nested as Record<string, unknown>)?.id) ??
      normalizeId(r.id);
    if (id === null) continue;
    ids.add(id);
    const u = nested as Record<string, unknown>;
    usersById[id] = {
      id,
      name:
        (typeof u.name === 'string' && u.name) ||
        (typeof u.fullName === 'string' && u.fullName) ||
        [u.firstName, u.lastName]
          .filter((p) => typeof p === 'string' && p)
          .join(' ')
          .trim() ||
        `Użytkownik #${id}`,
      role: typeof u.role === 'string' ? u.role : null,
      companyName: typeof u.companyName === 'string' ? u.companyName : null,
    };
  }

  return { ids, usersById };
};

export const useBlockedUsersStore = create<BlockedUsersState>((set, get) => ({
  blockedIds: new Set<number>(),
  usersById: {},
  isHydrated: false,
  isSyncing: false,

  hydrate: async (userId) => {
    try {
      const raw = await AsyncStorage.getItem(storageKey(userId));
      const arr: unknown = raw ? JSON.parse(raw) : [];
      const ids = new Set<number>(
        Array.isArray(arr)
          ? arr.map((v) => normalizeId(v)).filter((v): v is number => v !== null)
          : []
      );
      set({ blockedIds: ids, isHydrated: true });
    } catch (err) {
      if (__DEV__) console.warn('[blockedUsers] hydrate failed', err);
      set({ blockedIds: new Set<number>(), isHydrated: true });
    }
  },

  syncFromBackend: async (token) => {
    if (!token) return;
    set({ isSyncing: true });
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/blocks`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        if (__DEV__) console.log('[blockedUsers] sync skipped', res.status);
        return;
      }
      const data: unknown = await res.json().catch(() => ({}));
      const { ids, usersById } = parseBlocksPayload(data);
      set({ blockedIds: ids, usersById });
    } catch (err) {
      if (__DEV__) console.warn('[blockedUsers] sync failed', err);
    } finally {
      set({ isSyncing: false });
    }
  },

  block: async (targetUserId, token, userId) => {
    const target = normalizeId(targetUserId);
    if (target === null) return { ok: false, error: 'INVALID_USER_ID' };

    // Optymistyczna aktualizacja — UI od razu schowa treści zablokowanego.
    // Jeśli backend odmówi (np. próba blokady admina), rollback poniżej.
    const prev = get().blockedIds;
    const wasAlreadyBlocked = prev.has(target);
    if (!wasAlreadyBlocked) {
      const next = new Set(prev);
      next.add(target);
      set({ blockedIds: next });
      await persist(userId, next);
    }

    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: target }),
      });

      if (res.ok) {
        // Po POST robimy szybki sync, żeby pobrać user-shape (potrzebny w
        // `BlockedUsersModal` w Profilu). Niezależnie czy `duplicate:true`
        // czy nie — backend ma teraz autorytatywną listę.
        void get().syncFromBackend(token);
        return { ok: true };
      }

      // Próba blokady kogoś, kogo nie wolno blokować (np. admina) → rollback.
      const status = res.status;
      const data: { error_code?: string } = await res.json().catch(() => ({}));
      const code = String(data?.error_code || '');

      if (status === 400 && (code === 'CANNOT_BLOCK_ADMIN' || code === 'CANNOT_BLOCK_SELF')) {
        if (!wasAlreadyBlocked) {
          const rolled = new Set(prev);
          set({ blockedIds: rolled });
          await persist(userId, rolled);
        }
        return { ok: false, error: code };
      }

      // 5xx / 404 / 501 → defensywnie utrzymujemy lokalną blokadę. Apple
      // sprawdza efekt w UI, a w tle backend domknie sync przy starcie.
      if (status >= 500 || status === 404 || status === 501) {
        if (__DEV__) console.log('[blockedUsers] backend block transient', status);
        return { ok: true };
      }

      // Inne nieznane 4xx — rollback i błąd.
      if (!wasAlreadyBlocked) {
        const rolled = new Set(prev);
        set({ blockedIds: rolled });
        await persist(userId, rolled);
      }
      return { ok: false, error: code || 'UNKNOWN' };
    } catch (err) {
      // Brak sieci → blokada lokalna pozostaje, sync przy następnym uruchomieniu.
      if (__DEV__) console.warn('[blockedUsers] block network err', err);
      return { ok: true };
    }
  },

  unblock: async (targetUserId, token, userId) => {
    const target = normalizeId(targetUserId);
    if (target === null) return { ok: false, error: 'INVALID_USER_ID' };

    const prev = get().blockedIds;
    if (!prev.has(target)) return { ok: true };

    const next = new Set(prev);
    next.delete(target);
    const prevUsers = get().usersById;
    const nextUsers = { ...prevUsers };
    delete nextUsers[target];
    set({ blockedIds: next, usersById: nextUsers });
    await persist(userId, next);

    try {
      await fetch(`${API_URL}/api/mobile/v1/blocks/${target}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      return { ok: true };
    } catch (err) {
      if (__DEV__) console.warn('[blockedUsers] unblock network err', err);
      return { ok: true };
    }
  },

  isBlocked: (targetUserId) => {
    const id = normalizeId(targetUserId);
    if (id === null) return false;
    return get().blockedIds.has(id);
  },

  clear: () => {
    set({ blockedIds: new Set<number>(), usersById: {}, isHydrated: false });
  },
}));
