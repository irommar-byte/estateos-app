import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/network';

const ENABLED_KEY = 'estateos_intelligence_enabled';
const DECIDED_KEY = 'estateos_intelligence_decided_v1';
const SNOOZE_KEY = 'estateos_intelligence_enable_snooze_until_v1';
const API_PATH = `${API_URL}/api/discovery/intelligence-preference`;

export const INTELLIGENCE_ENABLE_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

export type IntelligencePreference = {
  enabled: boolean;
  decided: boolean;
};

async function writeLocal(enabled: boolean, decided: boolean): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [ENABLED_KEY, enabled ? '1' : '0'],
      [DECIDED_KEY, decided ? '1' : '0'],
    ]);
  } catch {
    /* quiet */
  }
}

export async function readLocalIntelligencePreference(): Promise<IntelligencePreference> {
  try {
    const pairs = await AsyncStorage.multiGet([ENABLED_KEY, DECIDED_KEY]);
    const map = Object.fromEntries(pairs);
    const enabledRaw = map[ENABLED_KEY];
    const decidedRaw = map[DECIDED_KEY];
    const enabled = enabledRaw === '1';
    // Only an explicit decide (profile toggle / enable CTA) counts — never infer from enabled=0
    // after a "later" tap, or the enable sheet never returns.
    const decided = decidedRaw === '1';
    return { enabled, decided };
  } catch {
    return { enabled: false, decided: false };
  }
}

export async function snoozeIntelligenceEnablePrompt(
  ms = INTELLIGENCE_ENABLE_SNOOZE_MS,
  now = Date.now(),
): Promise<number> {
  const until = now + ms;
  try {
    await AsyncStorage.setItem(SNOOZE_KEY, String(until));
  } catch {
    /* quiet */
  }
  return until;
}

export async function isIntelligenceEnablePromptSnoozed(now = Date.now()): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_KEY);
    const until = Number(raw);
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

export function isSnoozeTimestampActive(raw: string | null | undefined, now = Date.now()): boolean {
  const until = Number(raw);
  return Number.isFinite(until) && until > now;
}

export async function fetchIntelligencePreference(
  token: string | null | undefined,
): Promise<IntelligencePreference | null> {
  if (!token) return null;
  try {
    const res = await fetch(API_PATH, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    if (res.status === 401 || !res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      enabled?: boolean;
      decided?: boolean;
    };
    if (!data?.success) return null;
    const pref = { enabled: data.enabled === true, decided: data.decided === true };
    await writeLocal(pref.enabled, pref.decided);
    return pref;
  } catch {
    return null;
  }
}

export async function setIntelligencePreference(
  token: string | null | undefined,
  enabled: boolean,
): Promise<IntelligencePreference> {
  const local: IntelligencePreference = { enabled, decided: true };
  await writeLocal(local.enabled, local.decided);
  if (!token) return local;
  try {
    const res = await fetch(API_PATH, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) return local;
    const data = (await res.json()) as {
      success?: boolean;
      enabled?: boolean;
      decided?: boolean;
    };
    if (!data?.success) return local;
    const pref = {
      enabled: data.enabled === true,
      decided: data.decided === true,
    };
    await writeLocal(pref.enabled, pref.decided);
    return pref;
  } catch {
    return local;
  }
}
