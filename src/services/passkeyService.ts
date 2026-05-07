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
  return /cancel|cancelled|canceled/i.test(msg);
};

const isNoCredentialsError = (error: any) => {
  const msg = String(error?.message || '').toLowerCase();
  return /no credentials were returned|no credential|credentials were returned/i.test(msg);
};

const isRpIdMismatchError = (error: any) => {
  const msg = String(error?.message || '').toLowerCase();
  return /rp id|relying party|domain mismatch|origin/i.test(msg);
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
      if (!isUserCancel(e)) {
        console.error("🔑 [Passkey Register Error]:", e?.message);
        Alert.alert("Błąd Rejestracji", e?.message || "Nie udało się dodać klucza.");
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
      if (!isUserCancel(e)) {
        console.error("🔓 [Passkey Login Error]:", e?.message);
        if (isNoCredentialsError(e)) {
          Alert.alert(
            "Brak klucza Passkey",
            "Na tym urządzeniu nie znaleziono zapisanego klucza dla tego konta. Zaloguj się hasłem i włącz Passkey ponownie w profilu."
          );
        } else if (isRpIdMismatchError(e)) {
          Alert.alert(
            "Błąd konfiguracji Passkey",
            "Wykryto niezgodność domeny Passkey (RP ID). Sprawdź konfigurację serwera i aplikacji dla estateos.pl."
          );
        } else {
          Alert.alert("Błąd Logowania", e?.message || "Logowanie biometryczne nie powiodło się.");
        }
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
