import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientPortalWebPushPublicKey } from '@/lib/crm/clientPortalWebPush';

type RouteCtx = { params: Promise<{ token: string }> };

async function resolveClient(token: string) {
  return prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    select: { id: true },
  });
}

function endpointHash(endpoint: string) {
  return createHash('sha256').update(endpoint).digest('hex');
}

function parseSubscription(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const keys = row.keys && typeof row.keys === 'object' ? (row.keys as Record<string, unknown>) : {};
  const endpoint = String(row.endpoint || '').trim();
  const p256dh = String(keys.p256dh || '').trim();
  const auth = String(keys.auth || '').trim();
  if (
    !endpoint.startsWith('https://') ||
    endpoint.length > 4096 ||
    !p256dh ||
    p256dh.length > 255 ||
    !auth ||
    auth.length > 255
  ) {
    return null;
  }
  return { endpoint, p256dh, auth };
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const client = await resolveClient(token);
  if (!client) {
    return NextResponse.json({ error: 'Nie znaleziono panelu klienta.' }, { status: 404 });
  }
  const publicKey = getClientPortalWebPushPublicKey();
  return NextResponse.json(
    { success: true, supported: Boolean(publicKey), publicKey },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const client = await resolveClient(token);
  if (!client) {
    return NextResponse.json({ error: 'Nie znaleziono panelu klienta.' }, { status: 404 });
  }
  if (!getClientPortalWebPushPublicKey()) {
    return NextResponse.json({ error: 'Powiadomienia Push nie są jeszcze skonfigurowane.' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const subscription = parseSubscription((body as { subscription?: unknown } | null)?.subscription);
  if (!subscription) {
    return NextResponse.json({ error: 'Nieprawidłowa subskrypcja powiadomień.' }, { status: 400 });
  }

  const hash = endpointHash(subscription.endpoint);
  await prisma.clientPortalPushSubscription.upsert({
    where: {
      clientId_endpointHash: {
        clientId: client.id,
        endpointHash: hash,
      },
    },
    create: {
      clientId: client.id,
      endpoint: subscription.endpoint,
      endpointHash: hash,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent: String(req.headers.get('user-agent') || '').slice(0, 512) || null,
    },
    update: {
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent: String(req.headers.get('user-agent') || '').slice(0, 512) || null,
      lastUsedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const client = await resolveClient(token);
  if (!client) {
    return NextResponse.json({ error: 'Nie znaleziono panelu klienta.' }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const endpoint = String((body as { endpoint?: unknown } | null)?.endpoint || '').trim();
  if (!endpoint) return NextResponse.json({ success: true });

  await prisma.clientPortalPushSubscription.deleteMany({
    where: { clientId: client.id, endpointHash: endpointHash(endpoint) },
  });
  return NextResponse.json({ success: true });
}
