import {
  clearPasskeyLoginChallenge,
  clearPasskeyRegisterChallenge,
  getPasskeyLoginChallenge,
  getPasskeyRegisterChallenge,
  savePasskeyLoginChallenge,
  savePasskeyRegisterChallenge,
} from '@/lib/passkeyChallengeDb';

declare global {
  var mobilePasskeyChallenges: Map<string, string> | undefined;
}

if (!global.mobilePasskeyChallenges) {
  global.mobilePasskeyChallenges = new Map();
}

export const mobilePasskeyChallenges = global.mobilePasskeyChallenges;

export async function setRegisterPasskeyChallenge(
  sessionId: string,
  userId: number,
  challenge: string
) {
  mobilePasskeyChallenges.set(sessionId, challenge);
  mobilePasskeyChallenges.set(`user:${userId}`, challenge);
  await savePasskeyRegisterChallenge(userId, challenge);
}

export async function getRegisterPasskeyChallenge(
  sessionId: string | null,
  userId: number | null
): Promise<string | null> {
  if (sessionId) {
    const bySession = mobilePasskeyChallenges.get(sessionId);
    if (bySession) return bySession;
  }
  if (userId) {
    const inMemory = mobilePasskeyChallenges.get(`user:${userId}`);
    if (inMemory) return inMemory;
    return getPasskeyRegisterChallenge(userId);
  }
  return null;
}

export async function clearRegisterPasskeyChallenge(sessionId: string | null, userId: number | null) {
  if (sessionId) mobilePasskeyChallenges.delete(sessionId);
  if (userId) {
    mobilePasskeyChallenges.delete(`user:${userId}`);
    await clearPasskeyRegisterChallenge(userId);
  }
}

export async function setLoginPasskeyChallenge(sessionId: string, challenge: string) {
  mobilePasskeyChallenges.set(sessionId, challenge);
  await savePasskeyLoginChallenge(sessionId, challenge);
}

export async function getLoginPasskeyChallenge(sessionId: string): Promise<string | null> {
  const inMemory = mobilePasskeyChallenges.get(sessionId);
  if (inMemory) return inMemory;
  return getPasskeyLoginChallenge(sessionId);
}

export async function clearLoginPasskeyChallenge(sessionId: string) {
  mobilePasskeyChallenges.delete(sessionId);
  await clearPasskeyLoginChallenge(sessionId);
}

/** @deprecated use setRegisterPasskeyChallenge */
export const setPasskeyChallenge = setRegisterPasskeyChallenge;
/** @deprecated use getRegisterPasskeyChallenge */
export const getPasskeyChallenge = getRegisterPasskeyChallenge;
/** @deprecated use clearRegisterPasskeyChallenge */
export const clearPasskeyChallenge = clearRegisterPasskeyChallenge;
