import jwt from 'jsonwebtoken';
import { verifyMobileToken } from '@/lib/jwtMobile';

export function parseMobileUserIdFromAuthHeader(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice('Bearer '.length).trim();
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice('Bearer '.length).trim() : rawToken;
  if (!token) return null;

  const verified = verifyMobileToken(token) as { id?: number; userId?: number; sub?: number } | null;
  const verifiedId = Number(verified?.id ?? verified?.userId ?? verified?.sub);
  if (Number.isFinite(verifiedId) && verifiedId > 0) return verifiedId;

  const decoded = jwt.decode(token) as { id?: number; userId?: number; sub?: number } | null;
  const decodedId = Number(decoded?.id ?? decoded?.userId ?? decoded?.sub);
  return Number.isFinite(decodedId) && decodedId > 0 ? decodedId : null;
}
