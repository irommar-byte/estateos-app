import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import { getPasskeyRpId } from '@/lib/env.server';

/** Niektóre klienty iOS oczekują jawnego `rp.id` / `rpId` obok standardowego JSON WebAuthn. */
export function formatPasskeyRegistrationOptionsForClient(
  options: PublicKeyCredentialCreationOptionsJSON,
  extra?: Record<string, unknown>
) {
  const rpId = getPasskeyRpId();
  const rp = options.rp ?? { id: rpId, name: 'EstateOS' };
  return {
    ...options,
    rp: { id: rp.id || rpId, name: rp.name || 'EstateOS' },
    rpId: rp.id || rpId,
    publicKey: options,
    ...extra,
  };
}

export function passkeyAlreadyRegisteredPayload(userId: number, email: string) {
  const rpId = getPasskeyRpId();
  return {
    success: true,
    hasPasskey: true,
    alreadyRegistered: true,
    skipRegistration: true,
    userId,
    email,
    rp: { id: rpId, name: 'EstateOS' },
    rpId,
    sessionId: String(userId),
  };
}
