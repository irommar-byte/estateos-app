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
export const rpID = getPasskeyRpId();
export const origin = getPasskeyOrigin();
