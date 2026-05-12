import { Passkey } from 'react-native-passkey';
import { Alert } from 'react-native';

const API_URL = 'https://estateos.pl/api/passkey';
const API_URL_MOBILE = 'https://estateos.pl/api/mobile/v1/passkeys';

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

const parseJsonSafely = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
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
        Authorization: `Bearer ${token}`,
      });
      if (response.ok && data?.publicKey) return data.publicKey;
      lastError = new Error(data?.error || `[API] Register start failed (${response.status})`);
    } catch (e: any) {
      lastError = e;
    }
  }
  throw lastError || new Error('[API] Register start failed');
};

const tryRegisterFinishEndpoints = async (userId: string, credential: Record<string, any>) => {
  const candidates = [
    { url: `${API_URL}/register/finish`, payload: { userId, credential } },
    { url: `${API_URL_MOBILE}/register-verify`, payload: { userId, credential } },
  ];

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const { response, data } = await postJson(candidate.url, candidate.payload);
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
      const credential = await Passkey.create(publicKey);
      await tryRegisterFinishEndpoints(userId, credential as Record<string, any>);

      return true;

    } catch (e: any) {
      if (isUserCancel(e)) return false;
      // console.warn (nie console.error) — by nie pokazywać czerwonego dev-bannera dla znanych przypadków.
      console.warn("[Passkey] Register failed:", e?.message);
      if (isBiometryNotEnrolledError(e)) {
        Alert.alert(
          "Face ID/Touch ID wyłączone",
          "Aby dodać klucz Passkey, włącz biometrię w Ustawieniach iOS (Face ID / Touch ID) i ustaw kod dostępu, a następnie spróbuj ponownie.",
        );
      } else if (isRpIdMismatchError(e)) {
        Alert.alert(
          "Błąd konfiguracji",
          "Wykryto niezgodność domeny Passkey. To problem konfiguracji aplikacji — zaloguj się hasłem i zgłoś nam to przez Ustawienia → Pomoc.",
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

  revoke: async (token: string, userId: string) => {
    const endpoints = [
      `${API_URL}/revoke`,
      `${API_URL}/register/revoke`,
      `${API_URL}/delete`,
    ];

    let lastError: any = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId }),
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : {};

        if (response.ok && (data?.success !== false)) {
          return true;
        }

        lastError = new Error(data?.error || `Revoke failed (${response.status})`);
      } catch (e: any) {
        lastError = e;
      }
    }

    throw lastError || new Error('Nie udało się usunąć klucza passkey z serwera.');
  },
};
