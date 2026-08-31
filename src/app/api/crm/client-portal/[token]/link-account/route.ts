import { NextResponse } from 'next/server';
import { bearerUserIdFromRequest, linkPortalAccount } from '@/lib/crm/portalAccountLink';

type RouteCtx = { params: Promise<{ token: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const userId = bearerUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'Zaloguj się w aplikacji, żeby powiązać panel.' }, { status: 401 });
  }
  const { token } = await ctx.params;
  const result = await linkPortalAccount({ portalToken: token, userId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true, linkedUserId: result.linkedUserId });
}
