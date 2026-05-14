import { isoBase64URL } from '@simplewebauthn/server/helpers';

/**
 * DB rows may mix base64url (WebAuthn default), standard base64, or hex.
 * SimpleWebAuthn v13+ requires excludeCredentials[].id to be valid base64url or it throws.
 */
export function normalizeCredentialIdToBase64URL(raw: string): string {
  const id = String(raw ?? '').trim();
  if (!id) {
    throw new Error('Pusty credentialID');
  }
  if (isoBase64URL.isBase64URL(id)) {
    return isoBase64URL.trimPadding(id);
  }
  if (isoBase64URL.isBase64(id)) {
    const buf = isoBase64URL.toBuffer(id, 'base64');
    return isoBase64URL.fromBuffer(buf, 'base64url');
  }
  if (/^[0-9a-fA-F]+$/.test(id) && id.length % 2 === 0) {
    const buf = Buffer.from(id, 'hex');
    return isoBase64URL.fromBuffer(buf, 'base64url');
  }
  throw new Error('Nieobsługiwane kodowanie credentialID');
}

function toWebAuthnPublicKeyBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(value.byteLength);
  out.set(value);
  return out as Uint8Array<ArrayBuffer>;
}

export function credentialPublicKeyToUint8Array(stored: string): Uint8Array<ArrayBuffer> {
  const s = String(stored ?? '').trim();
  if (!s) return new Uint8Array() as Uint8Array<ArrayBuffer>;
  try {
    if (isoBase64URL.isBase64URL(s)) {
      return toWebAuthnPublicKeyBytes(isoBase64URL.toBuffer(s, 'base64url'));
    }
  } catch {
    // fall through
  }
  try {
    if (isoBase64URL.isBase64(s)) {
      return toWebAuthnPublicKeyBytes(isoBase64URL.toBuffer(s, 'base64'));
    }
  } catch {
    // fall through
  }
  return toWebAuthnPublicKeyBytes(new Uint8Array(Buffer.from(s, 'base64')));
}

/** Store COSE public key bytes as base64url for consistency with WebAuthn helpers. */
export function encodeCredentialPublicKeyForDb(publicKey: Uint8Array | Buffer): string {
  return isoBase64URL.fromBuffer(Buffer.from(publicKey), 'base64url');
}
