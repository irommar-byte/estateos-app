import { Passkey } from 'react-native-passkey';
import { Alert } from 'react-native';

const API_URL = 'https://estateos.pl/api/passkey';

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

export const PasskeyService = {
  register: async (token: string, userId: string, email: string) => {
    try {
      const supported = await Passkey.isSupported();
      if (!supported) {
        Alert.alert("Niedostępne", "Brak obsługi Passkey na tym urządzeniu.");
        return false;
      }

      const startRes = await fetchWithTimeout(`${API_URL}/register/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId, email })
      });

      const startData = await startRes.json();
      if (!startRes.ok || !startData?.publicKey) {
        throw new Error(startData?.error || "[API] Register start failed");
      }

      const credential = await Passkey.create(startData.publicKey);

      const finishRes = await fetchWithTimeout(`${API_URL}/register/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, credential })
      });

      const finishData = await finishRes.json();
      if (!finishRes.ok) {
        throw new Error(finishData?.error || "[API] Register finish failed");
      }

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

      const startRes = await fetchWithTimeout(`${API_URL}/login/start`, {
        method: 'POST'
      });

      const startData = await startRes.json();
      if (!startRes.ok || !startData?.publicKey || !startData?.sessionId) {
        throw new Error(startData?.error || "[API] Login start failed");
      }

      const assertion = await Passkey.get(startData.publicKey);

      const finishRes = await fetchWithTimeout(`${API_URL}/login/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...assertion, sessionId: startData.sessionId })
      });

      const finishData = await finishRes.json();

      if (!finishRes.ok || !finishData?.token) {
        throw new Error(finishData?.error || "[API] Login failed");
      }

      return finishData;

    } catch (e: any) {
      if (!isUserCancel(e)) {
        console.error("🔓 [Passkey Login Error]:", e?.message);
        Alert.alert("Błąd Logowania", e?.message || "Logowanie biometryczne nie powiodło się.");
      }
      return null;
    }
  }
};
