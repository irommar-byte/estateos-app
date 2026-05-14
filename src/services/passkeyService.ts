import { Passkey } from 'react-native-passkey';
import { Alert } from 'react-native';
import { API_URL as API_ORIGIN } from '../config/network';

const API_URL = `${API_ORIGIN.replace(/\/$/, '')}/api/passkey`;
const API_URL_MOBILE = `${API_ORIGIN.replace(/\/$/, '')}/api/mobile/v1/passkeys`;

// Timeout dla słabych sieci
const fetchWithTimeout = async (resource: string, options: any = {}) => {
  const { timeout = 15000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, { ...fetchOptions, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') throw new Error("Przekroczono limit czasu połączenia. Sprawdź internet.");
    throw error;
  }
};

// Bezpieczne wykrywanie anulowania na iOS i Androidzie
const isUserCancel = (error: any) => {
  const msg = String(error?.message || '').toLowerCase();
  return /cancel|cancelled|canceled|anulow|user canceled|user cancelled/i.test(msg);
};

// „Brak klucza" / „no credentials" / "Brak credential id" (PL natywne) — wszystko, co znaczy „nie ma czego użyć".
const isNoCredentialsError = (error: any) => {
  const msg = String(error?.message || '').toLowerCase();
  return /no credentials? were returned|no credential|credentials were returned|credential id|credential[\s_-]?not[\s_-]?found|brak credential|brak klucza|no passkey|passkey not found|nie znaleziono klucza/i.test(
    msg,
  );
};

const isRpIdMismatchError = (error: any) => {
  const msg = String(error?.message || '').toLowerCase();
  return /rp[\s_-]?id|relying party|domain mismatch|origin mismatch|niezgodno\u015b\u0107 domeny/i.test(msg);
};

// Telefon nie ma skonfigurowanej biometrii systemowej (Face ID/Touch ID off, brak PIN-u itp.).
const isBiometryNotEnrolledError = (error: any) => {
  const msg = String(error?.message || '').toLowerCase();
  return /not enrolled|biometry not available|biometric not enrolled|biometrics not available|face id (not|nie)|touch id (not|nie)|brak konfiguracji|passcode (not|nie) set/i.test(
    msg,
  );
};

// Brak sieci / timeout / serwer.
const isNetworkError = (error: any) => {
  const msg = String(error?.message || '').toLowerCase();
  return /network request failed|failed to fetch|timeout|timed out|przekroczono limit czasu|brak po\u0142\u0105czenia|abort/i.test(
    msg,
  );
};

const isServerError = (error: any) => {
  const msg = String(error?.message || '');
  return /\b5\d{2}\b|\[api\].*(failed|error)/i.test(msg);
};

// Częsty iOS-owy fallback z natywnego Passkey API (bez szczegółów).
const isGenericUnknownPasskeyError = (error: any) => {
  const msg = String(error?.message || '').toLowerCase().trim();
  return (
    msg === 'an unknown error occurred' ||
    msg === 'unknown error' ||
    msg.includes('unknown error occurred')
  );
};

const isPasskeyConfigMissingError = (error: any) => {
  const msg = String(error?.message || '').toLowerCase();
  return /icloud|keychain|credential provider|security domain|not available for this account/i.test(msg);
};

const stringifyErrorMeta = (error: any) => {
  try {
    const meta = {
      name: error?.name,
      code: error?.code,
      domain: error?.domain,
      message: error?.message,
    };
    return JSON.stringify(meta);
  } catch {
    return String(error?.message || error);
  }
};

const parseJsonSafely = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

/** Ten sam sens co `normalizeToken` w auth store — nagłówek zawsze `Bearer <jwt>`. */
const normalizeAuthToken = (raw: string | null | undefined) => {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  return t.toLowerCase().startsWith('bearer ') ? t.slice(7).trim() : t;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 404 „nie ma passkey” przy revoke = idempotentny sukces (już wyłączone). */
const isPasskeyNotRegisteredRevoke = (response: Response, data: any) => {
  if (response.status !== 404) return false;
  const blob = `${data?.error_code || ''} ${data?.error || ''} ${data?.message || ''}`.toLowerCase();
  return /passkey_not_registered|not_registered|nie\s+ma|nothing\s+to|not\s+found/i.test(blob);
};

/**
 * Nie uznawaj za sukces samotnego `200` + `{}` z „no-op” routingu — wtedy legacy status
 * nadal widzi aktywny klucz, a użytkownik widzi błąd po weryfikacji.
 */
const isRevokeResponseSuccess = (response: Response, data: any) => {
  if (!response.ok) return false;
  if (response.status === 204) return true;
  if (isPasskeyNotRegisteredRevoke(response, data)) return true;
  if (data?.success === true || data?.ok === true) return true;
  if (data?.success === false || data?.ok === false) return false;
  if (typeof data?.hasPasskey === 'boolean' && data.hasPasskey === false) return true;
  if (typeof data?.removed === 'number' && data.removed >= 1) return true;
  if (typeof data?.deletedCount === 'number' && data.deletedCount >= 1) return true;
  if (response.status === 200 && Object.keys(data || {}).length === 0) return false;
  return false;
};

const postJson = async (url: string, payload?: Record<string, any>, headers?: Record<string, string>) => {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await parseJsonSafely(response);
  return { response, data };
};

const tryLoginStartEndpoints = async () => {
  const candidates = [
    { url: `${API_URL}/login/start`, payload: undefined as any },
    { url: `${API_URL_MOBILE}/auth-options`, payload: undefined as any },
    { url: `${API_URL_MOBILE}/auth-options`, payload: { email: null } },
  ];

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const { response, data } = await postJson(candidate.url, candidate.payload);
      if (response.ok && data?.publicKey && data?.sessionId) {
        return { publicKey: data.publicKey, sessionId: data.sessionId };
      }
      lastError = new Error(data?.error || `[API] Login start failed (${response.status})`);
    } catch (e: any) {
      lastError = e;
    }
  }
  throw lastError || new Error('[API] Login start failed');
};

const tryLoginFinishEndpoints = async (payload: Record<string, any>) => {
  const candidates = [`${API_URL}/login/finish`, `${API_URL_MOBILE}/auth-verify`];
  let lastError: Error | null = null;
  for (const url of candidates) {
    try {
      const { response, data } = await postJson(url, payload);
      if (response.ok && data?.token) {
        return data;
      }
      lastError = new Error(data?.error || `[API] Login failed (${response.status})`);
    } catch (e: any) {
      lastError = e;
    }
  }
  throw lastError || new Error('[API] Login failed');
};

const tryRegisterStartEndpoints = async (token: string, userId: string, email: string) => {
  const candidates = [
    { url: `${API_URL}/register/start`, payload: { userId, email } },
    { url: `${API_URL_MOBILE}/register-options`, payload: { userId, email } },
  ];

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const { response, data } = await postJson(candidate.url, candidate.payload, {
        Authorization: `Bearer ${normalizeAuthToken(token)}`,
      });
      if (response.ok && data?.publicKey) return data.publicKey;
      lastError = new Error(data?.error || `[API] Register start failed (${response.status})`);
    } catch (e: any) {
      lastError = e;
    }
  }
  throw lastError || new Error('[API] Register start failed');
};

const tryRegisterFinishEndpoints = async (
  token: string,
  userId: string,
  credential: Record<string, any>,
) => {
  const jwt = normalizeAuthToken(token);
  const authHeaders = jwt ? ({ Authorization: `Bearer ${jwt}` } as Record<string, string>) : {};
  const candidates = [
    { url: `${API_URL}/register/finish`, payload: { userId, credential } },
    { url: `${API_URL_MOBILE}/register-verify`, payload: { userId, credential } },
  ];

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const { response, data } = await postJson(candidate.url, candidate.payload, authHeaders);
      if (response.ok && data?.success !== false) return true;
      lastError = new Error(data?.error || `[API] Register finish failed (${response.status})`);
    } catch (e: any) {
      lastError = e;
    }
  }
  throw lastError || new Error('[API] Register finish failed');
};

export const PasskeyService = {
  register: async (token: string, userId: string, email: string) => {
    try {
      const supported = await Passkey.isSupported();
      if (!supported) {
        Alert.alert("Niedostępne", "Brak obsługi Passkey na tym urządzeniu.");
        return false;
      }

      const publicKey = await tryRegisterStartEndpoints(token, userId, email);
      const rpId = String(publicKey?.rp?.id || '').trim().toLowerCase();
      if (!rpId) {
        throw new Error('PASSKEY_RPID_MISSING');
      }
      // EstateOS produkcyjnie działa na estateos.pl (i subdomenach).
      if (!(rpId === 'estateos.pl' || rpId.endsWith('.estateos.pl'))) {
        throw new Error(`PASSKEY_RPID_INVALID:${rpId}`);
      }
      const credential = await Passkey.create(publicKey);
      await tryRegisterFinishEndpoints(token, userId, credential as Record<string, any>);

      return true;

    } catch (e: any) {
      if (isUserCancel(e)) return false;
      // console.warn (nie console.error) — by nie pokazywać czerwonego dev-bannera dla znanych przypadków.
      console.warn("[Passkey] Register failed:", e?.message, stringifyErrorMeta(e));
      if (isBiometryNotEnrolledError(e)) {
        Alert.alert(
          "Face ID/Touch ID wyłączone",
          "Aby dodać klucz Passkey, włącz biometrię w Ustawieniach iOS (Face ID / Touch ID) i ustaw kod dostępu, a następnie spróbuj ponownie.",
        );
      } else if (String(e?.message || '').startsWith('PASSKEY_RPID_MISSING')) {
        Alert.alert(
          "Błąd konfiguracji Passkey",
          "Serwer nie zwrócił rp.id dla Passkey. To wymaga poprawki po stronie backendu (register-options).",
        );
      } else if (String(e?.message || '').startsWith('PASSKEY_RPID_INVALID:')) {
        const current = String(e?.message || '').split(':')[1] || 'nieznane';
        Alert.alert(
          "Błąd konfiguracji domeny",
          `rp.id z serwera to „${current}”, a aplikacja EstateOS działa dla domeny estateos.pl. Wymagana korekta backendu Passkey.`,
        );
      } else if (isRpIdMismatchError(e)) {
        Alert.alert(
          "Błąd konfiguracji",
          "Wykryto niezgodność domeny Passkey. To problem konfiguracji aplikacji — zaloguj się hasłem i zgłoś nam to przez Ustawienia → Pomoc.",
        );
      } else if (isPasskeyConfigMissingError(e) || isGenericUnknownPasskeyError(e)) {
        Alert.alert(
          "Passkey chwilowo niedostępny",
          "iOS zwrócił ogólny błąd Passkey. Sprawdź: (1) włączony kod urządzenia, (2) Face ID/Touch ID, (3) iCloud Keychain w Ustawieniach Apple ID. Jeśli nadal nie działa, to backend Passkey wymaga weryfikacji rp.id i register-options.",
        );
      } else if (isNetworkError(e)) {
        Alert.alert(
          "Brak połączenia",
          "Nie udało się skontaktować z serwerem EstateOS™. Sprawdź internet i spróbuj ponownie.",
        );
      } else if (isServerError(e)) {
        Alert.alert(
          "Chwilowy problem serwera",
          "Po stronie serwera wystąpił błąd przy rejestracji klucza. Spróbuj ponownie za chwilę.",
        );
      } else {
        Alert.alert(
          "Nie udało się dodać klucza",
          "Spróbuj ponownie. Jeśli problem się powtarza, zaloguj się hasłem i włącz Passkey w profilu.",
        );
      }
      return false;
    }
  },

  login: async () => {
    try {
      const supported = await Passkey.isSupported();
      if (!supported) {
        Alert.alert("Niedostępne", "Brak obsługi Passkey na tym urządzeniu.");
        return null;
      }

      const start = await tryLoginStartEndpoints();
      const assertion = await Passkey.get(start.publicKey);
      return await tryLoginFinishEndpoints({ ...assertion, sessionId: start.sessionId });

    } catch (e: any) {
      if (isUserCancel(e)) return null;
      // console.warn (nie console.error) — by nie pokazywać czerwonego dev-bannera dla znanych przypadków.
      console.warn("[Passkey] Login failed:", e?.message);
      if (isNoCredentialsError(e)) {
        Alert.alert(
          "Brak zapisanego klucza",
          'Na tym urządzeniu nie znaleziono klucza Passkey dla Twojego konta. Zaloguj się e-mailem i hasłem, a następnie w „Profil → Bezpieczeństwo” włącz Passkey, by od razu logować się Face ID.',
        );
      } else if (isBiometryNotEnrolledError(e)) {
        Alert.alert(
          "Face ID/Touch ID wyłączone",
          "Włącz biometrię w Ustawieniach iOS (Face ID / Touch ID) i ustaw kod dostępu, aby logować się Passkey. Tymczasem możesz zalogować się e-mailem i hasłem.",
        );
      } else if (isRpIdMismatchError(e)) {
        Alert.alert(
          "Błąd konfiguracji Passkey",
          "Aplikacja i serwer nie zgadzają się co do domeny. Zaloguj się e-mailem i hasłem i zgłoś nam to przez Ustawienia → Pomoc.",
        );
      } else if (isNetworkError(e)) {
        Alert.alert(
          "Brak połączenia",
          "Nie udało się skontaktować z serwerem EstateOS™. Sprawdź internet i spróbuj ponownie.",
        );
      } else if (isServerError(e)) {
        Alert.alert(
          "Chwilowy problem serwera",
          "Logowanie Passkey jest tymczasowo niedostępne. Spróbuj e-mailem i hasłem albo ponów za chwilę.",
        );
      } else {
        Alert.alert(
          "Logowanie Face ID nie powiodło się",
          "Nie udało się potwierdzić tożsamości. Spróbuj ponownie albo zaloguj się e-mailem i hasłem.",
        );
      }
      return null;
    }
  },

  /**
   * Czy konto ma zarejestrowany passkey po stronie serwera (źródło prawdy dla przełącznika w profilu).
   * Zwraca `null`, gdy żaden endpoint statusu nie odpowiedział rozpoznawalnym JSON-em.
   */
  fetchHasPasskey: async (token: string | null | undefined, userId: string): Promise<boolean | null> => {
    const jwt = normalizeAuthToken(token);
    if (!jwt || !userId) return null;
    const headers = { Authorization: `Bearer ${jwt}` };

    const tryListUrl = async (url: string): Promise<boolean | null> => {
      try {
        const response = await fetchWithTimeout(url, { method: 'GET', headers });
        const data = await parseJsonSafely(response);
        if (!response.ok) return null;
        if (Array.isArray(data)) return data.length > 0;
        if (Array.isArray(data.passkeys)) return data.passkeys.length > 0;
        if (Array.isArray(data.credentials)) return data.credentials.length > 0;
        if (Array.isArray(data.data)) return data.data.length > 0;
        if (Array.isArray(data.items)) return data.items.length > 0;
      } catch {
        // next
      }
      return null;
    };

    for (const url of [`${API_URL_MOBILE}`, `${API_URL_MOBILE}/list`]) {
      const fromList = await tryListUrl(url);
      if (fromList !== null) return fromList;
    }

    const candidates = [
      `${API_URL_MOBILE}/status?userId=${encodeURIComponent(userId)}`,
      `${API_URL}/status?userId=${encodeURIComponent(userId)}`,
    ];
    for (const url of candidates) {
      try {
        const response = await fetchWithTimeout(url, { method: 'GET', headers });
        const data = await parseJsonSafely(response);
        if (!response.ok) continue;
        if (typeof data.hasPasskey === 'boolean') return data.hasPasskey;
        if (typeof data.has_passkey === 'boolean') return data.has_passkey;
        if (typeof data.registered === 'boolean') return data.registered;
        if (typeof data.enabled === 'boolean') return data.enabled;
        const nested = data?.data;
        if (nested && typeof nested.hasPasskey === 'boolean') return nested.hasPasskey;
      } catch {
        // next URL
      }
    }
    return null;
  },

  /**
   * Po `revoke` — kilka prób odczytu statusu (krótki lag replikacji / cache).
   * `gone` = na pewno brak; `still` = serwer nadal widzi klucz; `unknown` = brak czytelnej odpowiedzi.
   */
  confirmPasskeyRemoved: async (
    token: string | null | undefined,
    userId: string,
    attempts = 6,
    delayMs = 350,
  ): Promise<'gone' | 'still' | 'unknown'> => {
    let last: boolean | null = null;
    for (let i = 0; i < attempts; i++) {
      last = await PasskeyService.fetchHasPasskey(token, userId);
      if (last === false) return 'gone';
      if (i < attempts - 1) await sleep(delayMs);
    }
    if (last === true) return 'still';
    return 'unknown';
  },

  revoke: async (token: string, userId: string) => {
    const jwt = normalizeAuthToken(token);
    if (!jwt) {
      throw new Error('Brak aktywnej sesji — zaloguj się ponownie, aby zarządzać Passkey.');
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      'x-access-token': jwt,
      'auth-token': jwt,
    };
    const body = JSON.stringify({ userId });

    /**
     * Kanoniczny revoke: `POST /api/passkey/revoke` (BACKEND_AGENT 11e) — musi iść **przed**
     * heurystykami `.../passkeys/remove`, bo te często zwracają pusty 200 i **nie** czyszczą
     * rekordu widocznego dla `login/start` ani `/api/passkey/status`.
     */
    const candidates: { method: 'POST' | 'DELETE'; url: string; sendBody: boolean }[] = [
      { method: 'POST', url: `${API_URL}/revoke`, sendBody: true },
      { method: 'POST', url: `${API_URL}/register/revoke`, sendBody: true },
      { method: 'POST', url: `${API_URL}/delete`, sendBody: true },
      { method: 'POST', url: `${API_URL_MOBILE}/revoke`, sendBody: true },
      { method: 'POST', url: `${API_URL_MOBILE}/unregister`, sendBody: true },
      { method: 'POST', url: `${API_URL_MOBILE}/remove`, sendBody: false },
      { method: 'DELETE', url: `${API_URL_MOBILE}/remove`, sendBody: false },
      { method: 'DELETE', url: `${API_URL_MOBILE}`, sendBody: false },
    ];

    let lastError: any = null;

    for (const { method, url, sendBody } of candidates) {
      try {
        const response = await fetchWithTimeout(url, {
          method,
          headers,
          ...(sendBody ? { body } : {}),
        });
        const data = await parseJsonSafely(response);
        if (isRevokeResponseSuccess(response, data)) {
          return true;
        }
        lastError = new Error(
          (typeof data?.error === 'string' && data.error) ||
            (typeof data?.message === 'string' && data.message) ||
            `Revoke failed (${response.status})`,
        );
      } catch (e: any) {
        lastError = e;
      }
    }

    throw lastError || new Error('Nie udało się usunąć klucza passkey z serwera.');
  },
};
