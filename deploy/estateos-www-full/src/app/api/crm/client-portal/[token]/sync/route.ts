import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { touchPortalLinkedPresence } from '@/lib/crm/portalPresence';
import { buildPortalSyncVersion } from '@/lib/crm/portalSyncVersion';

type RouteCtx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    select: {
      id: true,
      updatedAt: true,
      linkedUserId: true,
      acquisition: { select: { updatedAt: true } },
      linkedOffer: { select: { updatedAt: true } },
    },
  });
  if (!client) {
    return NextResponse.json({ error: 'Nie znaleziono panelu klienta.' }, { status: 404 });
  }
  await touchPortalLinkedPresence(client.linkedUserId);

  const [match, activity] = await Promise.all([
    prisma.agencyClientMatch.findFirst({
      where: { clientId: client.id },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.agencyClientActivity.findFirst({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  const version = buildPortalSyncVersion([
    client.updatedAt,
    client.acquisition?.updatedAt,
    client.linkedOffer?.updatedAt,
    match?.updatedAt,
    activity?.createdAt,
  ]);

  return NextResponse.json(
    { success: true, version },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}
