import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';

export function extractMobileTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const xAccessToken = req.headers.get('x-access-token');
  const authToken = req.headers.get('auth-token');
  const raw = String(authHeader || xAccessToken || authToken || '').trim();
  if (!raw) return null;
  if (raw.startsWith('Bearer ')) return raw.slice('Bearer '.length).trim() || null;
  return raw;
}

export function parseMobileUserId(payload: unknown): number | null {
  const p = payload as Record<string, unknown> | null;
  if (!p) return null;
  const id = Number(p.id ?? p.userId ?? p.sub);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export type AuthorizeOk = { ok: true; userId: number };
export type AuthorizeFail = { ok: false; response: NextResponse };

export async function authorizeMobile(req: Request): Promise<AuthorizeOk | AuthorizeFail> {
  const token = extractMobileTokenFromRequest(req);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 }),
    };
  }
  const payload = verifyMobileToken(token);
  if (!payload) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Nieprawidłowy lub wygasły token' },
        { status: 401 }
      ),
    };
  }
  const userId = parseMobileUserId(payload);
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Nieprawidłowy token' }, { status: 401 }),
    };
  }
  return { ok: true, userId };
}
