import * as webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/core/notification.core';

type PortalPushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

function webPushConfig() {
  const publicKey = String(process.env.WEB_PUSH_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.WEB_PUSH_PRIVATE_KEY || '').trim();
  const subject = String(process.env.WEB_PUSH_SUBJECT || 'mailto:powiadomienia@estateos.pl').trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function getClientPortalWebPushPublicKey(): string | null {
  return webPushConfig()?.publicKey || null;
}

export async function sendClientPortalWebPush(
  clientId: number,
  payload: Omit<PortalPushPayload, 'url'> & { url?: string; native?: boolean },
) {
  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    select: {
      portalToken: true,
      linkedUserId: true,
      portalPushSubscriptions: {
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      },
    },
  });
  if (!client?.portalToken) {
    return { sent: 0, skipped: 'no_portal' as const };
  }

  const portalPath = `/klient/${encodeURIComponent(client.portalToken)}`;
  const portalUrl = payload.url || portalPath;
  const absolutePortalUrl = portalUrl.startsWith('http')
    ? portalUrl
    : `https://estateos.pl${portalUrl.startsWith('/') ? portalUrl : `/${portalUrl}`}`;

  if (payload.native !== false && client.linkedUserId) {
    await sendNotification({
      userId: client.linkedUserId,
      type: 'CRM_EVENT',
      title: payload.title,
      body: payload.body,
      data: {
        kind: 'CLIENT_PORTAL',
        portalToken: client.portalToken,
        deeplink: absolutePortalUrl,
        url: absolutePortalUrl,
        tag: payload.tag,
      },
    }).catch(() => {});
  }

  const config = webPushConfig();
  if (!config) return { sent: 0, skipped: 'not_configured' as const };
  if (client.portalPushSubscriptions.length === 0) {
    return { sent: 0, skipped: 'no_subscriptions' as const };
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: portalUrl,
    tag: payload.tag || `estateos-client-chat-${clientId}`,
  } satisfies PortalPushPayload);

  let sent = 0;
  await Promise.all(
    client.portalPushSubscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          body,
          {
            TTL: 24 * 60 * 60,
            urgency: 'high',
            topic: `crm-chat-${clientId}`.slice(0, 32),
          },
        );
        sent += 1;
        await prisma.clientPortalPushSubscription.update({
          where: { id: subscription.id },
          data: { lastUsedAt: new Date() },
        });
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await prisma.clientPortalPushSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
          return;
        }
        console.error('[CLIENT PORTAL WEB PUSH]', {
          clientId,
          subscriptionId: subscription.id,
          statusCode,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  return { sent };
}
