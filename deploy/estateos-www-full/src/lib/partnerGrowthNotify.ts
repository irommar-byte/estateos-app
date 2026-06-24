import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/notification.service';
import {
  buildPartnerFreeWelcomeEmailHtml,
  buildPartnerFreeWelcomeEmailSubject,
  buildPartnerGrowthEmailHtml,
  buildPartnerGrowthEmailSubject,
  sendTransactionalEmail,
} from '@/lib/email/transactional';
import type { PartnerGrowthInsight } from '@/lib/partnerGrowth';
import { growthEmailBuckets, growthTouchKey } from '@/lib/partnerGrowth';

export async function deliverPartnerGrowthTouch(params: {
  userId: number;
  userEmail: string;
  userName?: string | null;
  companyId: number;
  companyName: string;
  insight: PartnerGrowthInsight;
  daysRemaining?: number | null;
  sendEmail?: boolean;
  emailBucket?: string;
}): Promise<{ notified: boolean; emailed: boolean }> {
  const bucket =
    params.emailBucket ??
    growthEmailBuckets(params.insight, params.daysRemaining ?? null)[0] ??
    params.insight.kind;
  const idempotencyKey = growthTouchKey({
    kind: params.insight.kind,
    companyId: params.companyId,
    userId: params.userId,
    bucket,
  });

  let notified = false;
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.insight.title,
        body: params.insight.body,
        type: 'SYSTEM_ALERT',
        priority: params.insight.severity === 'urgent' ? 'HIGH' : 'NORMAL',
        targetType: 'USER',
        targetId: String(params.companyId),
        idempotencyKey,
      },
    });
    notified = true;
  } catch (e) {
    const dup =
      e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002';
    if (!dup) throw e;
  }

  if (notified) {
    try {
      await notificationService.sendPushToUser(params.userId, {
        title: params.insight.title,
        body: params.insight.body,
        data: {
          kind: 'partner_growth',
          companyId: String(params.companyId),
          href: params.insight.ctaHref,
        },
      });
    } catch {
      /* push optional */
    }
  }

  let emailed = false;
  if (params.sendEmail !== false && params.insight.emailSubject && notified) {
    emailed = await sendTransactionalEmail({
      to: params.userEmail,
      subject: buildPartnerGrowthEmailSubject({
        subject: params.insight.emailSubject,
        companyName: params.companyName,
      }),
      html: buildPartnerGrowthEmailHtml({
        userName: params.userName,
        companyName: params.companyName,
        insight: params.insight,
      }),
    });
  }

  return { notified, emailed };
}

export async function deliverPartnerFreeWelcome(params: {
  userId: number;
  userEmail: string;
  userName?: string | null;
  companyId: number;
  companyName: string;
  credits: number;
}): Promise<void> {
  const idempotencyKey = growthTouchKey({
    kind: 'welcome',
    companyId: params.companyId,
    userId: params.userId,
    bucket: 'day0',
  });

  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        title: 'Partner Free jest aktywny',
        body: `${params.credits} kredytów i Concierge na 90 dni — opublikuj pierwszą ofertę.`,
        type: 'SYSTEM_ALERT',
        priority: 'HIGH',
        targetType: 'USER',
        targetId: String(params.companyId),
        idempotencyKey,
      },
    });
  } catch (e) {
    const dup =
      e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002';
    if (!dup) throw e;
  }

  try {
    await notificationService.sendPushToUser(params.userId, {
      title: 'Partner Free aktywny',
      body: 'Dodaj pierwszą ofertę — katalog i Concierge już działają.',
      data: { kind: 'partner_welcome', href: '/dodaj-oferte' },
    });
  } catch {
    /* push optional */
  }

  await sendTransactionalEmail({
    to: params.userEmail,
    subject: buildPartnerFreeWelcomeEmailSubject({ companyName: params.companyName }),
    html: buildPartnerFreeWelcomeEmailHtml({
      userName: params.userName,
      companyName: params.companyName,
      credits: params.credits,
    }),
  });
}
