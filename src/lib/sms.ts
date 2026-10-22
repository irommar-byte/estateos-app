import { normalizePhoneForSms } from '@/lib/phoneE164';

/**
 * SMSPlanet — ten sam dostawca dla kodów weryfikacyjnych konta i wiadomości CRM.
 * Dane dostępowe wyłącznie ze zmiennych środowiskowych (nigdy w repozytorium):
 *   SMSPLANET_KEY, SMSPLANET_PASSWORD, opcjonalnie SMSPLANET_FROM (domyślnie „EstateOS”).
 */
function smsPlanetCredentials(): { key: string; password: string; from: string } | null {
  const key = String(process.env.SMSPLANET_KEY || '').trim();
  const password = String(process.env.SMSPLANET_PASSWORD || '').trim();
  if (!key || !password) return null;
  return { key, password, from: String(process.env.SMSPLANET_FROM || 'EstateOS').trim() || 'EstateOS' };
}

export type SmsSendResult = { ok: boolean; raw: string; error?: string };

/** Wysyła SMS i zwraca jawny wynik (bez rzucania wyjątku). */
export async function sendSmsChecked(phone: string, message: string): Promise<SmsSendResult> {
  const creds = smsPlanetCredentials();
  if (!creds) {
    console.error('[sms] Brak SMSPLANET_KEY / SMSPLANET_PASSWORD w środowisku — SMS nie wysłany.');
    return { ok: false, raw: '', error: 'SMS nie jest skonfigurowany na serwerze.' };
  }
  const cleanPhone = normalizePhoneForSms(phone);
  const params = new URLSearchParams();
  params.append('key', creds.key);
  params.append('password', creds.password);
  params.append('to', cleanPhone);
  params.append('msg', message);
  params.append('from', creds.from);

  try {
    const res = await fetch('https://api2.smsplanet.pl/sms', { method: 'POST', body: params });
    const raw = await res.text();
    let apiError: string | null = null;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed.errorMsg || parsed.errorCode) apiError = String(parsed.errorMsg || parsed.errorCode);
    } catch {
      // Odpowiedź nie-JSON — oceniamy tylko po statusie HTTP.
    }
    if (!res.ok || apiError) {
      console.error('[sms] SMSPlanet odrzucił wysyłkę:', res.status, apiError || raw.slice(0, 200));
      return { ok: false, raw, error: apiError || `HTTP ${res.status}` };
    }
    return { ok: true, raw };
  } catch (error) {
    console.error('[sms] Błąd połączenia z SMSPlanet:', error);
    return { ok: false, raw: '', error: error instanceof Error ? error.message : String(error) };
  }
}

/** Zgodność wsteczna: dotychczasowi wywołujący dostają surową odpowiedź jako tekst. */
export async function sendSMS(phone: string, message: string) {
  const result = await sendSmsChecked(phone, message);
  return result.raw || result.error || '';
}
