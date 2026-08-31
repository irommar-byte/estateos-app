import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_KEY = '@estateos_client_portal_token';
const LIST_KEY = '@estateos_client_portal_sessions';

export type StoredPortalSession = {
  token: string;
  clientName?: string;
  agencyName?: string;
};

function normalizeToken(value: string | null | undefined): string | null {
  const token = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{32,64}$/.test(token) ? token : null;
}

async function readSessions(): Promise<StoredPortalSession[]> {
  try {
    const raw = await AsyncStorage.getItem(LIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        token: normalizeToken(row?.token) || '',
        clientName: row?.clientName ? String(row.clientName) : undefined,
        agencyName: row?.agencyName ? String(row.agencyName) : undefined,
      }))
      .filter((row) => row.token);
  } catch {
    return [];
  }
}

async function writeSessions(sessions: StoredPortalSession[]) {
  const unique = new Map<string, StoredPortalSession>();
  for (const session of sessions) {
    if (session.token) unique.set(session.token, session);
  }
  await AsyncStorage.setItem(LIST_KEY, JSON.stringify([...unique.values()]));
}

export async function rememberPortalSession(session: StoredPortalSession): Promise<void> {
  const token = normalizeToken(session.token);
  if (!token) return;
  const next = { ...session, token };
  const existing = await readSessions();
  await writeSessions([next, ...existing.filter((row) => row.token !== token)]);
  await AsyncStorage.setItem(ACTIVE_KEY, token);
}

export async function getActivePortalToken(): Promise<string | null> {
  try {
    return normalizeToken(await AsyncStorage.getItem(ACTIVE_KEY));
  } catch {
    return null;
  }
}

export async function listPortalSessions(): Promise<StoredPortalSession[]> {
  return readSessions();
}

export async function listPortalTokens(): Promise<string[]> {
  const sessions = await readSessions();
  return sessions.map((row) => row.token);
}

export async function restorePortalSessionsFromServer(
  portals: Array<{ portalToken?: string; clientName?: string; agencyName?: string }>,
): Promise<string | null> {
  const normalized: StoredPortalSession[] = [];
  for (const portal of portals) {
    const token = normalizeToken(portal.portalToken);
    if (!token) continue;
    normalized.push({
      token,
      clientName: portal.clientName,
      agencyName: portal.agencyName,
    });
  }
  if (normalized.length === 0) return null;

  const active = normalized[0];
  const existing = await readSessions();
  const merged = new Map<string, StoredPortalSession>();
  for (const row of [...normalized, ...existing]) {
    if (row.token) merged.set(row.token, { ...merged.get(row.token), ...row });
  }
  await writeSessions([...merged.values()]);
  await AsyncStorage.setItem(ACTIVE_KEY, active.token);
  return active.token;
}
