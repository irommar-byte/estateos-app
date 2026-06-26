import crypto from 'crypto';
import { resolveSessionSecret } from '@/lib/sessionUtils';

const INVITE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export type PortalOnboardingInvitePayload = {
  typ: 'portal_onboarding';
  exp: number;
  by?: number;
};

function signPayload(payload: PortalOnboardingInvitePayload): string {
  const secret = resolveSessionSecret();
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function createPortalOnboardingInvite(adminUserId?: number): {
  token: string;
  expiresAt: string;
} {
  const payload: PortalOnboardingInvitePayload = {
    typ: 'portal_onboarding',
    exp: Date.now() + INVITE_TTL_MS,
    ...(adminUserId ? { by: adminUserId } : {}),
  };
  return {
    token: signPayload(payload),
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export function verifyPortalOnboardingInvite(token: string): PortalOnboardingInvitePayload | null {
  try {
    const raw = String(token || '').trim();
    if (!raw) return null;
    const parts = raw.split('.');
    if (parts.length !== 2) return null;

    const [data, signature] = parts;
    const secret = resolveSessionSecret();
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (signature !== expected) return null;

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as PortalOnboardingInvitePayload;
    if (payload.typ !== 'portal_onboarding') return null;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildPortalOnboardingUrl(baseOrigin: string, token: string): string {
  const origin = baseOrigin.replace(/\/$/, '');
  return `${origin}/dolacz?invite=${encodeURIComponent(token)}`;
}
