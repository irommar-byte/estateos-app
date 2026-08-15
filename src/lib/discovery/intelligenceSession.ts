/**
 * Session gates for sparse Intelligence auto-presents.
 * Mobile: AsyncStorage. WWW: sessionStorage (passed via adapters).
 */

import {
  INTEL_AUTO_PRESENT_BUDGET,
  INTEL_PROGRESS_DELTA,
  SESSION_AUTO_BUDGET_KEY,
  SESSION_MILESTONE_KEY,
  SESSION_PEEK_KEY,
  type PresentReason,
} from './intelligenceBrand';

export type SessionStorageLike = {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
};

async function readJsonArray(store: SessionStorageLike, key: string): Promise<number[]> {
  try {
    const raw = await store.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

async function writeJson(store: SessionStorageLike, key: string, value: unknown) {
  try {
    await store.setItem(key, JSON.stringify(value));
  } catch {
    /* quiet */
  }
}

export async function readMilestones(store: SessionStorageLike): Promise<number[]> {
  return readJsonArray(store, SESSION_MILESTONE_KEY);
}

export async function writeMilestones(store: SessionStorageLike, values: number[]) {
  await writeJson(store, SESSION_MILESTONE_KEY, values);
}

export async function hasDonePeek(store: SessionStorageLike): Promise<boolean> {
  try {
    return (await store.getItem(SESSION_PEEK_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markPeekDone(store: SessionStorageLike) {
  try {
    await store.setItem(SESSION_PEEK_KEY, '1');
  } catch {
    /* quiet */
  }
}

export async function readAutoBudget(store: SessionStorageLike): Promise<number> {
  try {
    const raw = await store.getItem(SESSION_AUTO_BUDGET_KEY);
    const n = raw != null ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function consumeAutoBudget(store: SessionStorageLike): Promise<boolean> {
  const used = await readAutoBudget(store);
  if (used >= INTEL_AUTO_PRESENT_BUDGET) return false;
  try {
    await store.setItem(SESSION_AUTO_BUDGET_KEY, String(used + 1));
  } catch {
    /* quiet */
  }
  return true;
}

export function isMeaningfulProgressDelta(prev: number | null, next: number): boolean {
  return typeof prev === 'number' && next >= prev + INTEL_PROGRESS_DELTA;
}

/**
 * Decide which auto-present (if any) to fire.
 * Caller must still check sheet-open + consumeAutoBudget before pinging the orb.
 */
export function pickAutoPresent(input: {
  prevProgress: number | null;
  nextProgress: number;
  prevContradiction: number | null;
  nextContradiction: number;
  milestoneGate: number | null;
  milestoneAlreadySeen: boolean;
}): Exclude<PresentReason, 'manual'> | null {
  const contraRising =
    typeof input.prevContradiction === 'number' &&
    input.prevContradiction < 0.55 &&
    input.nextContradiction >= 0.55;

  if (contraRising) return 'contradiction';

  if (input.milestoneGate != null && !input.milestoneAlreadySeen) {
    return 'milestone';
  }

  if (isMeaningfulProgressDelta(input.prevProgress, input.nextProgress)) {
    return 'progress';
  }

  return null;
}
