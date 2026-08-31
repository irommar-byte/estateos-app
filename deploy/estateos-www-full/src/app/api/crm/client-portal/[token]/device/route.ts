import { NextResponse } from 'next/server';
import { registerPortalDevice } from '@/lib/crm/portalAccountLink';

type RouteCtx = { params: Promise<{ token: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const result = await registerPortalDevice({
    portalToken: token,
    expoPushToken: String(body?.expoPushToken || ''),
    platform: String(body?.platform || ''),
    deviceModel: String(body?.deviceModel || ''),
    appVersion: String(body?.appVersion || ''),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true, linkedUserId: result.linkedUserId });
}
