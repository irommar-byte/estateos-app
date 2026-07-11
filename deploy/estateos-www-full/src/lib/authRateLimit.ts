import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp } from '@/lib/observability';

type AuthRateLimitOptions = {
  scope: string;
  identifier?: string | null;
  ipMax?: number;
  idMax?: number;
  windowMs?: number;
};

export function enforceAuthRateLimit(
  req: Request,
  { scope, identifier, ipMax = 20, idMax = 8, windowMs = 60_000 }: AuthRateLimitOptions,
): Response | null {
  const ip = getClientIp(req);
  const ipBucket = checkRateLimit(`${scope}:ip:${ip}`, ipMax, windowMs);
  if (!ipBucket.allowed) return rateLimitResponse(ipBucket.retryAfterSeconds);

  const idKey = String(identifier || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (idKey) {
    const idBucket = checkRateLimit(`${scope}:id:${idKey}`, idMax, windowMs);
    if (!idBucket.allowed) return rateLimitResponse(idBucket.retryAfterSeconds);
  }

  return null;
}
