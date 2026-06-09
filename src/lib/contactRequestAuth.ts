import { getAuthedUserIdFromRequest } from '@/lib/sessionAuth';
import { parseMobileUserIdFromAuthHeader } from '@/lib/mobileAuthUserId';

/** Cookie sesji WWW lub Bearer JWT (mobile). */
export async function resolveContactUserId(req: Request): Promise<number | null> {
  const mobile = parseMobileUserIdFromAuthHeader(req.headers.get('authorization'));
  if (mobile) return mobile;
  return getAuthedUserIdFromRequest(req);
}
