import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_URL } from '../config/network';
import {
  buildDiscoveryEventPayload,
  parseDiscoveryFeedItems,
  parseDiscoveryFeedProfile,
  type DiscoveryEventPayload,
  type DiscoveryEventType,
  type DiscoveryFeedItem,
  type DiscoveryFeedProfile,
} from '../contracts/discoveryContracts';

const QUEUE_KEY = '@estateos_discovery_event_queue_v2';
const SESSION_KEY = '@estateos_discovery_session_v1';
const MAX_QUEUE = 160;

export type DiscoverySession = {
  id: string;
  startedAt: string;
};

export type DiscoveryFeedResponse = {
  items: DiscoveryFeedItem[];
  profile: DiscoveryFeedProfile | null;
  session: { id: string; tempoMode?: string } | null;
};

export type DiscoveryTrope = {
  id: string;
  offerId: number;
  status: 'SAVED' | 'SERIOUS' | 'VISITED';
  priority: boolean;
  visitOutcome: 'YES' | 'NO' | 'DIFFERENT' | null;
  offer: any | null;
};

function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}_${uuid}` : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

function headers(token: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getOrCreateDiscoverySession(): Promise<DiscoverySession> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DiscoverySession;
      if (parsed?.id && parsed?.startedAt) return parsed;
    }
  } catch {
    // Create a fresh, safe session below.
  }
  const session = { id: createId('ds'), startedAt: new Date().toISOString() };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function clearDiscoverySession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

async function readQueue(): Promise<DiscoveryEventPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: DiscoveryEventPayload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
}

export async function enqueueDiscoveryEvent(payload: DiscoveryEventPayload): Promise<void> {
  const queue = await readQueue();
  if (!queue.some((event) => event.idempotencyKey === payload.idempotencyKey)) queue.push(payload);
  await writeQueue(queue);
}

export async function postDiscoveryEvent(payload: DiscoveryEventPayload, token: string | null): Promise<boolean> {
  if (!token) {
    await enqueueDiscoveryEvent(payload);
    return false;
  }
  try {
    const response = await fetch(`${API_URL}/api/mobile/v1/discovery/events`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(payload),
    });
    if (response.ok) return true;
  } catch {
    // Queue below.
  }
  await enqueueDiscoveryEvent(payload);
  return false;
}

export async function trackDiscoveryEvent(params: {
  token: string | null;
  eventType: DiscoveryEventType;
  offerId?: number | null;
  sessionId?: string | null;
  photoIndex?: number | null;
  score?: number | null;
  reasonCode?: string | null;
  visitOutcome?: string | null;
  correctionTarget?: string | null;
  dwellMs?: number | null;
  decisionLatencyMs?: number | null;
}): Promise<DiscoveryEventPayload | null> {
  const session = params.sessionId ? null : await getOrCreateDiscoverySession();
  const payload = buildDiscoveryEventPayload({
    ...params,
    sessionId: params.sessionId ?? session?.id ?? null,
    platform: Platform.OS,
  });
  if (!payload) return null;
  await postDiscoveryEvent(payload, params.token);
  return payload;
}

export async function flushDiscoveryEventQueue(token: string | null): Promise<void> {
  if (!token) return;
  const queue = await readQueue();
  if (!queue.length) return;
  const pending: DiscoveryEventPayload[] = [];
  for (const payload of queue) {
    try {
      const response = await fetch(`${API_URL}/api/mobile/v1/discovery/events`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify(payload),
      });
      if (!response.ok) pending.push(payload);
    } catch {
      pending.push(payload);
    }
  }
  await writeQueue(pending);
}

export async function fetchDiscoveryFeed(token: string | null, sessionId?: string | null): Promise<DiscoveryFeedResponse> {
  if (!token) return { items: [], profile: null, session: null };
  const params = new URLSearchParams({ mode: 'for_you', limit: '40' });
  if (sessionId) params.set('sessionId', sessionId);
  const response = await fetch(`${API_URL}/api/mobile/v1/discovery/feed?${params.toString()}`, {
    headers: headers(token),
  });
  if (!response.ok) throw new Error(`DISCOVERY_FEED_${response.status}`);
  const json = await response.json().catch(() => ({}));
  return {
    items: parseDiscoveryFeedItems(json),
    profile: parseDiscoveryFeedProfile(json),
    session: json?.session?.id ? { id: String(json.session.id), tempoMode: String(json.session.tempoMode || '') } : null,
  };
}

export async function fetchDiscoveryTropes(token: string | null): Promise<DiscoveryTrope[]> {
  if (!token) return [];
  const response = await fetch(`${API_URL}/api/mobile/v1/discovery/tropes`, { headers: headers(token) });
  if (!response.ok) throw new Error(`DISCOVERY_TROPES_${response.status}`);
  const json = await response.json().catch(() => ({}));
  return Array.isArray(json?.items) ? json.items as DiscoveryTrope[] : [];
}

export async function mutateDiscoveryTrope(
  token: string | null,
  input: { offerId: number; action: 'SAVE' | 'PRIORITIZE' | 'UNPRIORITIZE' | 'REMOVE' | 'SERIOUS' },
): Promise<void> {
  if (!token) return;
  const response = await fetch(`${API_URL}/api/mobile/v1/discovery/tropes`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`DISCOVERY_TROPE_${response.status}`);
}

export async function submitDiscoveryVisitFeedback(
  token: string | null,
  input: { offerId: number; visitOutcome: 'YES' | 'NO' | 'DIFFERENT' },
): Promise<void> {
  if (!token) return;
  const response = await fetch(`${API_URL}/api/mobile/v1/discovery/tropes`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`DISCOVERY_VISIT_${response.status}`);
}
