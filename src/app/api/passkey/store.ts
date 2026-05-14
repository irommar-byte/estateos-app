import { getPasskeyOrigin, getPasskeyRpId } from '@/lib/env.server';

declare global {
  var activeChallenges: Map<string, string> | undefined;
  var credentialsDB: Map<string, unknown> | undefined;
}

if (!global.activeChallenges) global.activeChallenges = new Map();
if (!global.credentialsDB) global.credentialsDB = new Map();

export const activeChallenges = global.activeChallenges;
export const credentialsDB = global.credentialsDB;

export const rpName = 'EstateOS';

/**
 * Resolve env-backed values at request time (not module import time),
 * so Next.js build can collect route metadata safely.
 */
export function getRpID(): string {
  return getPasskeyRpId();
}

export function getOrigin(): string {
  return getPasskeyOrigin();
}
