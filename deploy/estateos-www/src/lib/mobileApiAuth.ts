import { verifyMobileToken } from '@/lib/jwtMobile';

export function mobileBearerUserId(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  const raw = String(auth || '').replace(/^Bearer\s+/i, '').trim();
  if (!raw) return null;
  const payload = verifyMobileToken(raw) as Record<string, unknown> | null;
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

export async function readJson(req: Request): Promise<any> {
  return req.json().catch(() => ({}));
}
