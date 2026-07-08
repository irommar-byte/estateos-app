import { MOBILE_USER_SELECT, shapeMobileUser } from '@/lib/mobileUserShape';
import { prisma } from '@/lib/prisma';

type PairStatus = 'pending' | 'approved';

type PairEntry = {
  pairCode: string;
  mode: 'password' | 'passkey';
  status: PairStatus;
  createdAt: number;
  expiresAt: number;
  token?: string;
  user?: Record<string, unknown>;
};

declare global {
  // eslint-disable-next-line no-var
  var estateosTvPairStore: Map<string, PairEntry> | undefined;
}

if (!global.estateosTvPairStore) {
  global.estateosTvPairStore = new Map<string, PairEntry>();
}

const store = global.estateosTvPairStore;

const PAIR_TTL_MS = 10 * 60 * 1000;

function nowMs() {
  return Date.now();
}

export function generatePairCode(len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function normalizePairCode(input: unknown): string {
  return String(input || '').trim().toUpperCase();
}

export function setTvPairStart(pairCodeRaw: unknown, mode: 'password' | 'passkey') {
  let pairCode = normalizePairCode(pairCodeRaw);
  if (!pairCode) pairCode = generatePairCode();

  const createdAt = nowMs();
  const entry: PairEntry = {
    pairCode,
    mode,
    status: 'pending',
    createdAt,
    expiresAt: createdAt + PAIR_TTL_MS,
  };
  store.set(pairCode, entry);
  return entry;
}

export function getTvPair(pairCodeRaw: unknown): PairEntry | null {
  const pairCode = normalizePairCode(pairCodeRaw);
  if (!pairCode) return null;
  const entry = store.get(pairCode);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs()) {
    store.delete(pairCode);
    return null;
  }
  return entry;
}

export async function approveTvPair(pairCodeRaw: unknown, token: string, userId: number) {
  const entry = getTvPair(pairCodeRaw);
  if (!entry) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: MOBILE_USER_SELECT,
  });
  if (!user) return null;

  const approved: PairEntry = {
    ...entry,
    status: 'approved',
    token,
    user: shapeMobileUser(user) as unknown as Record<string, unknown>,
  };
  store.set(entry.pairCode, approved);
  return approved;
}

export function consumeTvPairApproved(pairCodeRaw: unknown): PairEntry | null {
  const entry = getTvPair(pairCodeRaw);
  if (!entry) return null;
  if (entry.status !== 'approved' || !entry.token || !entry.user) return entry;
  store.delete(entry.pairCode);
  return entry;
}

export function sweepTvPairStore() {
  const now = nowMs();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}
