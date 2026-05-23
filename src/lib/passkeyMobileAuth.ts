import jwt from 'jsonwebtoken';
import { verifyMobileToken } from '@/lib/jwtMobile';

export function parseUserIdFromBearer(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;

  let payload = verifyMobileToken(rawToken) as Record<string, unknown> | null;
  if (!payload) {
    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (secret) {
      try {
        payload = jwt.verify(rawToken, secret) as Record<string, unknown>;
      } catch {
        payload = jwt.decode(rawToken) as Record<string, unknown> | null;
      }
    } else {
      payload = jwt.decode(rawToken) as Record<string, unknown> | null;
    }
  }

  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}
