import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { PasskeyService } from '../services/passkeyService'; // 🔥 IMPORT NASZEGO SERWISU!
import { stopRadarLiveActivity } from '../services/radarLiveActivityService';
import { API_URL } from '../config/network';
import { ALLOWED_PHONE_COUNTRY_SET } from '../utils/phoneRegions';

const formatPhone = (p?: string) => {
  if (!p || !String(p).trim()) return 'Brak numeru';
  const raw = String(p).trim();
  if (raw === 'Brak numeru') return 'Brak numeru';
  const n = parsePhoneNumberFromString(raw);
  if (n?.isValid()) return n.formatInternational();
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && !raw.includes('+')) {
    const pl = parsePhoneNumberFromString(digits, 'PL');
    if (pl?.isValid()) return pl.formatInternational();
  }
  if (digits.startsWith('48') && digits.length >= 11) {
    const intl = parsePhoneNumberFromString(`+${digits}`);
    if (intl?.isValid()) return intl.formatInternational();
  }
  return raw;
};

interface User {
  id: number;
  email: string;
  name: string | null;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  role: string;
  planType: string | null;
  isPro?: boolean;
  proExpiresAt?: string | null;
  plusExpiresAt?: string | null;
  isVerifiedPhone?: boolean;
  /** Zweryfikowany adres e-mail (osobno od telefonu / profilu). */
  isEmailVerified?: boolean;
  /** Czas weryfikacji e-maila (ISO) — uzupełniany przez backend. */
  emailVerifiedAt?: string | null;
  /** Adres oczekujący na potwierdzenie kodem (trwa zmiana e-mail). */
  pendingEmail?: string | null;
  /** Serwer: jednorazowa korekta imienia/nazwiska już wykorzystana. */
  profileNameLocked?: boolean;
  /**
   * Nazwa biura / agencji — wypełniana tylko gdy `role === 'AGENT'`.
   * Backend zwraca przy rejestracji oraz w `GET /api/mobile/v1/user/me`.
   * Dla osób prywatnych zawsze `null`.
   */
  companyName?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isRadarActive: boolean; // 🔥 Nowość
  setRadarActive: (isActive: boolean) => Promise<void>; // 🔥 Nowość
  login: (email: string, pass: string) => Promise<boolean>;
  register: (
    email: string,
    pass: string,
    fName: string,
    lName: string,
    phone: string,
    role: string,
    /**
     * Dla `role === 'AGENT'` — nazwa biura/agencji. Backend powinien
     * zapisać to w nowym polu `companyName` w tabeli `users` (patrz:
     * `deploy/BACKEND_AGENT_REGISTRATION_API.md`). Dla innych ról
     * przekazujemy `null` / pomijamy.
     */
    companyName?: string | null,
  ) => Promise<boolean>;
  loginWithPasskey: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  updateAvatar: (base64Image: string) => Promise<void>;
  /** Trwałe usunięcie: `DELETE /api/mobile/v1/user/me` z hasłem; nagłówki Bearer + x-access-token / auth-token. */
  deleteAccount: (password: string) => Promise<{ ok: boolean; error?: string }>;
  /** Imię/nazwisko (opcjonalnie, jeśli nie zablokowane), telefon (opcjonalnie, jeśli niezweryfikowany). */
  updateProfileBasics: (payload: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** Krok 1 zmiany e-mail: wyślij kod na nowy adres (wymaga endpointu na backendzie). */
  requestProfileEmailChange: (newEmail: string) => Promise<{ ok: boolean; error?: string }>;
  /** Krok 2: potwierdź kod — dopiero wtedy e-mail ma się zmienić na serwerze. */
  confirmProfileEmailChange: (newEmail: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Weryfikacja **bieżącego** adresu e-mail (po rejestracji, gdy `emailVerified=false`).
   * Wysyła 6-cyfrowy kod na obecny e-mail usera.
   */
  sendCurrentEmailVerification: () => Promise<{ ok: boolean; error?: string }>;
  /** Potwierdzenie kodu z e-maila — po sukcesie `emailVerified=true`. */
  confirmCurrentEmailVerification: (code: string) => Promise<{ ok: boolean; error?: string }>;
}

const normalizeUser = (apiUser: any) => {
  if (!apiUser) return null;
  
  const fullDisplayName = apiUser.name || apiUser.contactName || 'Użytkownik';
  const nameParts = fullDisplayName.split(' ');
  
  return {
    ...apiUser,
    firstName: nameParts[0] || 'Użytkownik',
    lastName: nameParts.slice(1).join(' ') || '',
    phone: formatPhone(apiUser.phone || apiUser.contactPhone),
    avatar: apiUser.image || apiUser.avatar || null,
    /**
     * Weryfikacja numeru telefonu — tylko jawne flagi SMS. Stary ogólny
     * `isVerified` w nowym backendzie oznacza weryfikację e-maila, więc
     * nie traktujemy go jako sygnału dla telefonu.
     */
    isVerifiedPhone:
      apiUser.phoneVerified === true ||
      apiUser.isVerifiedPhone === true ||
      apiUser.isPhoneVerified === true ||
      apiUser.verifiedPhone === true ||
      apiUser.phone_verified === true ||
      apiUser.smsVerified === true ||
      (typeof apiUser.phoneVerifiedAt === 'string' && apiUser.phoneVerifiedAt.trim() !== '') ||
      false,
    /**
     * Weryfikacja e-maila — backend interpretuje `isVerified === true` (bez
     * jawnego `emailVerifiedAt`) również jako e-mail potwierdzony, dlatego
     * traktujemy ten stary flag jako sygnał. Wyjątek: gdy backend jawnie
     * zwrócił `emailVerified: false` — wtedy szanujemy „jawne nie”.
     */
    isEmailVerified:
      apiUser.emailVerified === true ||
      apiUser.isEmailVerified === true ||
      (apiUser.emailVerifiedAt != null && String(apiUser.emailVerifiedAt).trim() !== '') ||
      (apiUser.isVerified === true && apiUser.emailVerified !== false && apiUser.isEmailVerified !== false) ||
      false,
    emailVerifiedAt:
      typeof apiUser.emailVerifiedAt === 'string' && apiUser.emailVerifiedAt.trim() !== ''
        ? apiUser.emailVerifiedAt
        : null,
    pendingEmail:
      typeof apiUser.pendingEmail === 'string' && apiUser.pendingEmail.trim() !== ''
        ? apiUser.pendingEmail.trim()
        : null,
    profileNameLocked:
      apiUser.profileNameLocked === true ||
      apiUser.identityNameLocked === true ||
      false,
  };
};

/**
 * Lokalne klucze przechowujące fakt „ten user przeszedł SMS verify / email verify”.
 * Backend bywa źle skonfigurowany (np. `GET /me` nie zwraca `phoneVerified`),
 * więc trzymamy też trwałe potwierdzenie po stronie apki, żeby nie tracić statusu
 * po refreshach. Klucz jest per-user.
 */
const phoneVerifiedKey = (userId: number | string) => `@estateos_phone_verified_${userId}`;
const emailVerifiedKey = (userId: number | string) => `@estateos_email_verified_${userId}`;

export const persistLocalPhoneVerified = async (userId: number | string, value: boolean) => {
  try {
    if (value) await AsyncStorage.setItem(phoneVerifiedKey(userId), '1');
    else await AsyncStorage.removeItem(phoneVerifiedKey(userId));
  } catch {}
};
export const persistLocalEmailVerified = async (userId: number | string, value: boolean) => {
  try {
    if (value) await AsyncStorage.setItem(emailVerifiedKey(userId), '1');
    else await AsyncStorage.removeItem(emailVerifiedKey(userId));
  } catch {}
};

const loadLocalVerificationFlags = async (userId: number | string) => {
  try {
    const [p, e] = await Promise.all([
      AsyncStorage.getItem(phoneVerifiedKey(userId)),
      AsyncStorage.getItem(emailVerifiedKey(userId)),
    ]);
    return { phone: p === '1', email: e === '1' };
  } catch {
    return { phone: false, email: false };
  }
};

/**
 * Zachowuje flagi weryfikacji (telefon / e-mail), jeśli backend nie zwrócił
 * jawnej informacji w nowej odpowiedzi. To rozwiązuje sytuację, w której np.
 * potwierdzenie kodu e-mail zwraca usera bez `phoneVerified` — wcześniej
 * apka tracila status SMS po confirm e-maila.
 */
const preserveVerificationFlags = (next: any, prev: any | null | undefined, rawApi: any) => {
  if (!next) return next;
  const merged = { ...next };
  const apiHasPhoneFlag =
    rawApi?.phoneVerified !== undefined ||
    rawApi?.isVerifiedPhone !== undefined ||
    rawApi?.isPhoneVerified !== undefined ||
    rawApi?.verifiedPhone !== undefined ||
    rawApi?.phone_verified !== undefined ||
    rawApi?.smsVerified !== undefined ||
    rawApi?.phoneVerifiedAt !== undefined;
  if (!apiHasPhoneFlag && prev?.isVerifiedPhone === true) {
    merged.isVerifiedPhone = true;
  }
  const apiHasEmailFlag =
    rawApi?.emailVerified !== undefined ||
    rawApi?.isEmailVerified !== undefined ||
    rawApi?.emailVerifiedAt !== undefined;
  if (!apiHasEmailFlag && prev?.isEmailVerified === true) {
    merged.isEmailVerified = true;
    if (!merged.emailVerifiedAt && prev?.emailVerifiedAt) {
      merged.emailVerifiedAt = prev.emailVerifiedAt;
    }
  }
  return merged;
};

/**
 * Dokleja lokalnie zapisany „kiedyś przeszedł weryfikację” do obiektu usera.
 * Stosuje się gdy backend zwraca `phoneVerified` jako `undefined` / `false`,
 * ale apka pamięta, że user przeszedł SMS verify. To gwarantuje, że status
 * nie znika po refreshach / restartach apki.
 */
const hydrateWithLocalFlags = async (user: any | null) => {
  if (!user?.id) return user;
  const flags = await loadLocalVerificationFlags(user.id);
  const next = { ...user };
  if (flags.phone && !user.isVerifiedPhone) next.isVerifiedPhone = true;
  if (flags.email && !user.isEmailVerified) {
    next.isEmailVerified = true;
    if (!next.emailVerifiedAt) next.emailVerifiedAt = new Date().toISOString();
  }
  // Konto administratora (zarząd EstateOS™) jest traktowane jako w pełni zweryfikowane —
  // nie wymagamy SMS-a ani e-maila do działania, bo admin testuje i zarządza platformą.
  // Lokalnie utrwalamy flagi, żeby status nie znikał po refreshach i restartach.
  if (String(user?.role || '').toUpperCase() === 'ADMIN') {
    if (!next.isVerifiedPhone) next.isVerifiedPhone = true;
    if (!next.isEmailVerified) {
      next.isEmailVerified = true;
      if (!next.emailVerifiedAt) next.emailVerifiedAt = new Date().toISOString();
    }
    // fire-and-forget — utrwalenie nie blokuje hydratacji.
    void persistLocalPhoneVerified(user.id, true);
    void persistLocalEmailVerified(user.id, true);
  }
  return next;
};

const normalizeToken = (rawToken: string | null | undefined) => {
  if (!rawToken) return null;
  const trimmed = String(rawToken).trim();
  if (!trimmed) return null;
  return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,
  isRadarActive: false, // Domyślnie wyłączony

  // 🔥 NOWA FUNKCJA ZARZĄDZAJĄCA STANEM RADARU
  setRadarActive: async (isActive: boolean) => {
    set({ isRadarActive: isActive });
    try {
      await AsyncStorage.setItem('@estateos_radar_active', isActive ? '1' : '0');
      // Nie wysyłamy tutaj „gołego” snapshotu (enabled-only), bo to potrafiło
      // nadpisywać Live Activity na wartości domyślne (np. Warszawa).
      // Pełną konfigurację wysyła RadarHomeScreen.
      if (!isActive) {
        await stopRadarLiveActivity();
      }
    } catch (e) {
      if (__DEV__) console.warn('Error saving radar state', e);
    }
  },

  login: async (email: string, pass: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/mobile/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await response.json().catch(() => ({} as any));
      if (!response.ok) throw new Error(data.error || 'Błąd logowania');
      
      const normUser = await hydrateWithLocalFlags(normalizeUser(data.user));
      const normalizedToken = normalizeToken(data.token);
      if (!normalizedToken) throw new Error('Nie otrzymano poprawnego tokena logowania');
      await AsyncStorage.setItem('mobile_token', normalizedToken);
      await AsyncStorage.setItem('user_data', JSON.stringify(normUser));
      set({ user: normUser, token: normalizedToken, isLoading: false });
      await get().refreshUser();
      return true;
    } catch (err: any) {
      const raw = String(err?.message || '').trim();
      const lower = raw.toLowerCase();

      let normalizedMessage: string;
      if (/network request failed|failed to fetch|timeout|timed out|przekroczono limit czasu|abort/i.test(lower)) {
        normalizedMessage =
          'Brak połączenia z serwerem EstateOS™. Sprawdź internet i spróbuj ponownie.';
      } else if (/invalid credentials|wrong password|incorrect password|niepoprawne has\u0142o|z\u0142e has\u0142o|wrong email or password|nieprawid\u0142owe dane/i.test(lower)) {
        normalizedMessage = 'Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie.';
      } else if (/user not found|nie znaleziono u\u017cytkownika|no such user|account not found|brak konta|nie istnieje/i.test(lower)) {
        normalizedMessage = 'Nie znaleziono konta z tym adresem e-mail. Sprawdź pisownię lub załóż nowe konto.';
      } else if (/email[\s_-]?not[\s_-]?verified|niezweryfikowany e?-?mail|account not activated|nie aktywowano/i.test(lower)) {
        normalizedMessage = 'Konto nie zostało jeszcze potwierdzone. Sprawdź skrzynkę i kliknij link weryfikacyjny.';
      } else if (/locked|blocked|zablokowane|suspended|zawieszone/i.test(lower)) {
        normalizedMessage = 'Konto jest tymczasowo zablokowane. Skontaktuj się z pomocą EstateOS™.';
      } else if (/too many (requests|attempts)|rate limit|zbyt wiele pr\u00f3b/i.test(lower)) {
        normalizedMessage = 'Zbyt wiele prób logowania. Odczekaj chwilę i spróbuj ponownie.';
      } else if (/\b5\d{2}\b|server error|internal error|b\u0142\u0105d serwera/i.test(lower)) {
        normalizedMessage = 'Chwilowy problem po stronie serwera. Spróbuj ponownie za chwilę.';
      } else if (/\b4\d{2}\b/.test(lower) && !raw) {
        normalizedMessage = 'Nieprawidłowe dane logowania. Sprawdź e-mail i hasło.';
      } else {
        normalizedMessage = raw || 'Nie udało się zalogować. Sprawdź dane i spróbuj ponownie.';
      }

      set({ error: normalizedMessage, isLoading: false });
      return false;
    }
  },

  register: async (email, pass, fName, lName, phone, role, companyName = null) => {
    set({ isLoading: true, error: null });
    try {
      // Kontrakt z backendem: dla role === 'AGENT' wysyłamy dodatkowo
      // `companyName` (string, wymagane przez backend dla tej roli).
      // Dla pozostałych ról pole jest pomijane — backend powinien
      // zwalidować po stronie serwera, że AGENT ma niepuste companyName.
      const payload: Record<string, unknown> = {
        email,
        password: pass,
        name: `${fName} ${lName}`,
        phone,
        role,
      };
      if (role === 'AGENT' && companyName && companyName.trim().length > 0) {
        payload.companyName = companyName.trim();
      }
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Błąd rejestracji');
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  updateAvatar: async (base64Image: string) => {
    const { user, token } = get();
    if (!user) return;
    const updatedUser = { ...user, avatar: base64Image };
    set({ user: updatedUser });
    await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
    
    try {
      await fetch(`${API_URL}/api/mobile/v1/user/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ image: base64Image, userId: user.id })
      });
    } catch (e) {
      if (__DEV__) console.warn('Avatar sync error', e);
    }
  },

  // 🔥 PRAWDZIWE LOGOWANIE PASSKEY 🔥
  loginWithPasskey: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await PasskeyService.login();
      
      if (data && data.token) {
        const normUser = await hydrateWithLocalFlags(normalizeUser(data.user));
        const normalizedToken = normalizeToken(data.token);
        if (!normalizedToken) throw new Error('Nie otrzymano poprawnego tokena passkey');
        await AsyncStorage.setItem('mobile_token', normalizedToken);
        await AsyncStorage.setItem('user_data', JSON.stringify(normUser));
        set({ user: normUser, token: normalizedToken, isLoading: false });
        await get().refreshUser();
        return true; 
      }
      
      set({ isLoading: false });
      return false;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  refreshUser: async () => {
    const { token, user } = get();
    if (!token || !user?.id) return;
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/auth`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data?.user) {
        const refreshed = await hydrateWithLocalFlags(
          preserveVerificationFlags(normalizeUser(data.user), user, data.user)
        );
        set({ user: refreshed });
        await AsyncStorage.setItem('user_data', JSON.stringify(refreshed));
      }
    } catch (e) {
      if (__DEV__) console.warn('Refresh user error', e);
    }
  },

  logout: async () => {
    const { user: prevUser } = get();
    if (prevUser?.id != null) {
      await persistLocalPhoneVerified(prevUser.id, false);
      await persistLocalEmailVerified(prevUser.id, false);
    }
    await AsyncStorage.removeItem('mobile_token');
    await AsyncStorage.removeItem('user_data');
    await AsyncStorage.removeItem('@estateos_radar_active'); // Czyścimy radar
    await stopRadarLiveActivity();
    set({ user: null, token: null, isRadarActive: false });
  },

  deleteAccount: async (password: string) => {
    const { token, user } = get();
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken || !user?.id) {
      return { ok: false, error: 'Brak aktywnej sesji.' };
    }
    const pwd = String(password || '').trim();
    if (!pwd) {
      return { ok: false, error: 'Hasło jest wymagane.' };
    }

    /** Kontrakt: DELETE /api/mobile/v1/user/me — Bearer + opcjonalnie x-access-token / auth-token */
    const authHeaders = {
      Authorization: `Bearer ${normalizedToken}`,
      'x-access-token': normalizedToken,
      'auth-token': normalizedToken,
    };

    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/user/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      const serverMsg =
        (typeof data.error === 'string' && data.error.trim()) ||
        (typeof data.message === 'string' && data.message.trim()) ||
        '';

      if (!res.ok) {
        if (res.status === 400) {
          return { ok: false, error: serverMsg || 'Brakuje hasła lub nieprawidłowe żądanie.' };
        }
        if (res.status === 401) {
          return {
            ok: false,
            error: serverMsg || 'Nieprawidłowe hasło albo sesja wygasła. Zaloguj się ponownie.',
          };
        }
        if (res.status === 403) {
          return {
            ok: false,
            error:
              serverMsg ||
              'To konto nie ma hasła w systemie (np. tylko Passkey) albo jest kontem administratora — ustaw hasło albo skontaktuj się z pomocą EstateOS.',
          };
        }
        if (res.status === 429) {
          return { ok: false, error: serverMsg || 'Zbyt wiele prób. Spróbuj ponownie za chwilę.' };
        }
        if (res.status === 404 || res.status === 501) {
          return {
            ok: false,
            error: serverMsg || 'Usuwanie konta jest niedostępne. Skontaktuj się z pomocą EstateOS.',
          };
        }
        return { ok: false, error: serverMsg || `Serwer odrzucił żądanie (${res.status}).` };
      }

      if (data && typeof data === 'object' && data.success === false) {
        return { ok: false, error: serverMsg || 'Operacja nie powiodła się.' };
      }

      try {
        await PasskeyService.revoke(normalizedToken, String(user.id));
      } catch {
        /* best-effort */
      }
      await AsyncStorage.removeItem(`@passkey_${user.id}`);
      await AsyncStorage.removeItem('@estateos_favorites');
      await get().logout();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Brak połączenia z serwerem. Spróbuj ponownie.' };
    }
  },

  updateProfileBasics: async ({ firstName, lastName, phone }) => {
    const { token, user } = get();
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken || !user?.id) {
      return { ok: false, error: 'Brak aktywnej sesji.' };
    }
    if (user.isVerifiedPhone && phone !== undefined) {
      return { ok: false, error: 'Zweryfikowanego numeru telefonu nie można zmienić w aplikacji.' };
    }
    const authHeaders = {
      Authorization: `Bearer ${normalizedToken}`,
      'x-access-token': normalizedToken,
      'auth-token': normalizedToken,
    };
    const body: Record<string, string> = {};
    if (firstName !== undefined && lastName !== undefined) {
      const fn = String(firstName || '').trim();
      const ln = String(lastName || '').trim();
      const name = `${fn} ${ln}`.trim();
      body.name = name;
      body.firstName = fn;
      body.lastName = ln;
    }
    let phoneIsChanging = false;
    if (phone !== undefined && !user.isVerifiedPhone) {
      const parsed = parsePhoneNumberFromString(String(phone).trim());
      if (!parsed?.isValid()) {
        return { ok: false, error: 'Podaj prawidłowy numer telefonu (z kodem kraju).' };
      }
      if (!ALLOWED_PHONE_COUNTRY_SET.has(String(parsed.country))) {
        return { ok: false, error: 'Ten kraj nie jest dostępny przy numerze telefonu w aplikacji.' };
      }
      const e164 = parsed.number;
      body.phone = e164;
      body.contactPhone = e164;
      let prevE164: string | null = null;
      const prevParsed = parsePhoneNumberFromString(String(user.phone || '').trim());
      if (prevParsed?.isValid()) prevE164 = prevParsed.number;
      else {
        const d = String(user.phone || '').replace(/\D/g, '');
        const nine = d.slice(-9);
        if (/^\d{9}$/.test(nine)) {
          const pl = parsePhoneNumberFromString(nine, 'PL');
          if (pl?.isValid()) prevE164 = pl.number;
        }
      }
      if (prevE164 !== e164) phoneIsChanging = true;
    }
    if (Object.keys(body).length === 0) {
      return { ok: false, error: 'Brak zmian do zapisu.' };
    }
    try {
      const doFetch = (method: string, url: string) =>
        fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(body),
        });

      let res = await doFetch('PATCH', `${API_URL}/api/mobile/v1/user/me`);
      if (res.status === 404 || res.status === 405) {
        res = await doFetch('PATCH', `${API_URL}/api/mobile/v1/user/profile`);
      }
      if (res.status === 404 || res.status === 405) {
        res = await doFetch('PUT', `${API_URL}/api/mobile/v1/user/me`);
      }
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      const serverMsg =
        (typeof data.error === 'string' && data.error.trim()) ||
        (typeof data.message === 'string' && data.message.trim()) ||
        '';
      if (!res.ok) {
        return {
          ok: false,
          error: serverMsg || `Serwer odrzucił zapis (${res.status}).`,
        };
      }
      // Jeśli numer został podmieniony — wyczyść lokalny ślad weryfikacji SMS
      // (nowy numer wymaga ponownego SMS verify).
      if (phoneIsChanging && user?.id != null) {
        await persistLocalPhoneVerified(user.id, false);
      }
      if (data && typeof data === 'object' && (data as any).user) {
        // Po zmianie numeru NIE traktujemy poprzedniego stanu telefonu jako prawdziwego.
        const prevForMerge = phoneIsChanging ? { ...get().user, isVerifiedPhone: false } : get().user;
        const refreshed = await hydrateWithLocalFlags(
          preserveVerificationFlags(normalizeUser((data as any).user), prevForMerge, (data as any).user)
        );
        // Jeśli numer się zmienił, a backend nie zwrócił jawnie flagi telefonu — wymuszamy false.
        if (phoneIsChanging) refreshed.isVerifiedPhone = Boolean((data as any).user?.phoneVerified);
        set({ user: refreshed });
        await AsyncStorage.setItem('user_data', JSON.stringify(refreshed));
      } else {
        await get().refreshUser();
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Brak połączenia z serwerem. Spróbuj ponownie.' };
    }
  },

  requestProfileEmailChange: async (newEmail: string) => {
    const normalizedToken = normalizeToken(get().token);
    if (!normalizedToken) return { ok: false, error: 'Brak aktywnej sesji.' };
    const email = String(newEmail || '').trim().toLowerCase();
    if (!email.includes('@')) return { ok: false, error: 'Podaj poprawny adres e-mail.' };
    const authHeaders = {
      Authorization: `Bearer ${normalizedToken}`,
      'x-access-token': normalizedToken,
      'auth-token': normalizedToken,
    };
    const attempts: [string, Record<string, string>][] = [
      [`${API_URL}/api/mobile/v1/user/me/email-change/request`, { newEmail: email }],
      [`${API_URL}/api/mobile/v1/user/me/email-change`, { action: 'request', newEmail: email }],
      [`${API_URL}/api/mobile/v1/auth/change-email`, { email }],
    ];
    try {
      for (const [url, body] of attempts) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(body),
        });
        if (res.status === 404 || res.status === 405) continue;
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        const serverMsg =
          (typeof data.error === 'string' && data.error.trim()) ||
          (typeof data.message === 'string' && data.message.trim()) ||
          '';
        if (!res.ok) {
          return { ok: false, error: serverMsg || `Serwer odrzucił żądanie (${res.status}).` };
        }
        return { ok: true };
      }
      return {
        ok: false,
        error:
          'Wysłanie kodu nie powiodło się — backend musi udostępnić endpoint zmiany e-mail (np. POST /api/mobile/v1/user/me/email-change/request).',
      };
    } catch {
      return { ok: false, error: 'Brak połączenia z serwerem. Spróbuj ponownie.' };
    }
  },

  confirmProfileEmailChange: async (newEmail: string, code: string) => {
    const normalizedToken = normalizeToken(get().token);
    if (!normalizedToken) return { ok: false, error: 'Brak aktywnej sesji.' };
    const email = String(newEmail || '').trim().toLowerCase();
    const c = String(code || '').trim();
    if (!email.includes('@') || c.length < 4) {
      return { ok: false, error: 'Podaj nowy e-mail i kod z wiadomości.' };
    }
    const authHeaders = {
      Authorization: `Bearer ${normalizedToken}`,
      'x-access-token': normalizedToken,
      'auth-token': normalizedToken,
    };
    const attempts: [string, Record<string, string>][] = [
      [`${API_URL}/api/mobile/v1/user/me/email-change/confirm`, { newEmail: email, code: c }],
      [`${API_URL}/api/mobile/v1/user/me/email-change`, { action: 'confirm', newEmail: email, code: c }],
      [`${API_URL}/api/mobile/v1/auth/change-email/verify`, { email, code: c }],
    ];
    try {
      for (const [url, body] of attempts) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(body),
        });
        if (res.status === 404 || res.status === 405) continue;
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        const serverMsg =
          (typeof data.error === 'string' && data.error.trim()) ||
          (typeof data.message === 'string' && data.message.trim()) ||
          '';
        if (!res.ok) {
          return { ok: false, error: serverMsg || `Serwer odrzucił potwierdzenie (${res.status}).` };
        }
        // sukces — zapisz lokalny ślad weryfikacji e-maila
        const uid = get().user?.id;
        if (uid != null) await persistLocalEmailVerified(uid, true);

        if (data && typeof data === 'object' && (data as any).user) {
          const refreshed = await hydrateWithLocalFlags(
            preserveVerificationFlags(normalizeUser((data as any).user), get().user, (data as any).user)
          );
          set({ user: refreshed });
          await AsyncStorage.setItem('user_data', JSON.stringify(refreshed));
        } else {
          await get().refreshUser();
        }
        return { ok: true };
      }
      return {
        ok: false,
        error:
          'Potwierdzenie nie powiodło się — potrzebny jest endpoint (np. POST /api/mobile/v1/user/me/email-change/confirm).',
      };
    } catch {
      return { ok: false, error: 'Brak połączenia z serwerem. Spróbuj ponownie.' };
    }
  },

  /**
   * Wysyła kod weryfikacyjny na **bieżący** adres e-mail (np. po rejestracji).
   * Próbuje kolejno kilku konwencji nazwowych — pierwsza nie-404 wygrywa.
   */
  sendCurrentEmailVerification: async () => {
    const { user, token } = get();
    const normalizedToken = normalizeToken(token);
    if (!user || !normalizedToken) return { ok: false, error: 'Brak aktywnej sesji.' };
    const currentEmail = String(user.email || '').trim().toLowerCase();
    if (!currentEmail.includes('@')) return { ok: false, error: 'Brak adresu e-mail w profilu.' };
    const authHeaders = {
      Authorization: `Bearer ${normalizedToken}`,
      'x-access-token': normalizedToken,
      'auth-token': normalizedToken,
    };
    const attempts: [string, Record<string, unknown>][] = [
      [`${API_URL}/api/mobile/v1/user/me/email-verify/send`, {}],
      [`${API_URL}/api/mobile/v1/user/me/email-verify`, { action: 'send' }],
      [`${API_URL}/api/mobile/v1/auth/email/verify/send`, { email: currentEmail }],
      [`${API_URL}/api/auth/email/verify/send`, { email: currentEmail }],
    ];
    try {
      for (const [url, body] of attempts) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(body),
        });
        if (res.status === 404 || res.status === 405) continue;
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        const serverMsg =
          (typeof (data as any).error === 'string' && (data as any).error.trim()) ||
          (typeof (data as any).message === 'string' && (data as any).message.trim()) ||
          '';
        if (!res.ok) {
          // Backend mówi że e-mail jest już potwierdzony — odśwież lokalnie i zwróć ok.
          const alreadyVerified =
            res.status === 400 &&
            /potwierdz|verifi|already.*verif/i.test(serverMsg);
          if (alreadyVerified) {
            const { user: u } = get();
            if (u) {
              await persistLocalEmailVerified(u.id, true);
              const next = { ...u, isEmailVerified: true, emailVerifiedAt: u.emailVerifiedAt || new Date().toISOString() };
              set({ user: next });
              await AsyncStorage.setItem('user_data', JSON.stringify(next));
            }
            await get().refreshUser();
            return { ok: false, error: 'E-mail jest już potwierdzony.', alreadyVerified: true } as any;
          }
          return { ok: false, error: serverMsg || `Serwer odrzucił wysyłkę kodu (${res.status}).` };
        }
        return { ok: true };
      }
      return {
        ok: false,
        error:
          'Brak endpointu na backendzie (np. POST /api/mobile/v1/user/me/email-verify/send). Patrz: deploy/BACKEND_AGENT_PROFILE_EDIT_API.md.',
      };
    } catch {
      return { ok: false, error: 'Brak połączenia z serwerem. Spróbuj ponownie.' };
    }
  },

  /** Potwierdza 6-cyfrowy kod wysłany na bieżący e-mail i ustawia `emailVerified=true`. */
  confirmCurrentEmailVerification: async (code: string) => {
    const { user, token } = get();
    const normalizedToken = normalizeToken(token);
    if (!user || !normalizedToken) return { ok: false, error: 'Brak aktywnej sesji.' };
    const c = String(code || '').trim();
    if (c.length < 4) return { ok: false, error: 'Wpisz kod z wiadomości.' };
    const authHeaders = {
      Authorization: `Bearer ${normalizedToken}`,
      'x-access-token': normalizedToken,
      'auth-token': normalizedToken,
    };
    const attempts: [string, Record<string, unknown>][] = [
      [`${API_URL}/api/mobile/v1/user/me/email-verify/confirm`, { code: c }],
      [`${API_URL}/api/mobile/v1/user/me/email-verify`, { action: 'confirm', code: c }],
      [`${API_URL}/api/mobile/v1/auth/email/verify/confirm`, { code: c }],
      [`${API_URL}/api/auth/email/verify/confirm`, { code: c, email: String(user.email || '').toLowerCase() }],
    ];
    try {
      for (const [url, body] of attempts) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(body),
        });
        if (res.status === 404 || res.status === 405) continue;
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        const serverMsg =
          (typeof (data as any).error === 'string' && (data as any).error.trim()) ||
          (typeof (data as any).message === 'string' && (data as any).message.trim()) ||
          '';
        if (!res.ok) {
          const alreadyVerified =
            res.status === 400 &&
            /potwierdz|verifi|already.*verif/i.test(serverMsg);
          if (alreadyVerified) {
            const { user: u } = get();
            if (u) {
              await persistLocalEmailVerified(u.id, true);
              const next = { ...u, isEmailVerified: true, emailVerifiedAt: u.emailVerifiedAt || new Date().toISOString() };
              set({ user: next });
              await AsyncStorage.setItem('user_data', JSON.stringify(next));
            }
            await get().refreshUser();
            return { ok: true };
          }
          return { ok: false, error: serverMsg || `Serwer odrzucił potwierdzenie (${res.status}).` };
        }
        // sukces — zapisz lokalny ślad weryfikacji e-maila (na wypadek gdyby backend gubił flagę później)
        const uid = get().user?.id;
        if (uid != null) await persistLocalEmailVerified(uid, true);

        if (data && typeof data === 'object' && (data as any).user) {
          const refreshed = await hydrateWithLocalFlags(
            preserveVerificationFlags(normalizeUser((data as any).user), get().user, (data as any).user)
          );
          set({ user: refreshed });
          await AsyncStorage.setItem('user_data', JSON.stringify(refreshed));
        } else {
          await get().refreshUser();
        }
        return { ok: true };
      }
      return {
        ok: false,
        error:
          'Brak endpointu na backendzie (np. POST /api/mobile/v1/user/me/email-verify/confirm). Patrz: deploy/BACKEND_AGENT_PROFILE_EDIT_API.md.',
      };
    } catch {
      return { ok: false, error: 'Brak połączenia z serwerem. Spróbuj ponownie.' };
    }
  },

  restoreSession: async () => {
    try {
      const token = normalizeToken(await AsyncStorage.getItem('mobile_token'));
      const userData = await AsyncStorage.getItem('user_data');
      const radarState = await AsyncStorage.getItem('@estateos_radar_active');
      
      if (token && userData) {
        const baseUser = normalizeUser(JSON.parse(userData));
        const hydrated = await hydrateWithLocalFlags(baseUser);
        set({ 
          token, 
          user: hydrated,
          isRadarActive: radarState === '1'
        });
        // Uwaga: nie wysyłamy tutaj enabled-only, żeby nie resetować miasta/filtrów.
        if (radarState !== '1') {
          await stopRadarLiveActivity();
        }
        await get().refreshUser();
      }
    } catch (e) {
      if (__DEV__) console.warn('Restore session error', e);
    }
  }
}));
