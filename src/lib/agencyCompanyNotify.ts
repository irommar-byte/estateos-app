import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/notification.service';

const PENDING_TITLE = 'Nowe zgłoszenie agenta';
const APPROVED_TITLE = 'Zatwierdzono zgłoszenie do biura';

export async function notifyCompanyAdminsOfPendingMember(params: {
  companyId: number;
  memberId: number;
  companyName: string;
  applicantName: string;
  applicantEmail: string;
}) {
  const admins = await prisma.agencyCompanyMember.findMany({
    where: { companyId: params.companyId, role: 'ADMIN', status: 'ACTIVE' },
    select: { userId: true },
  });

  const body = `${params.applicantName} (${params.applicantEmail}) chce dołączyć do biura ${params.companyName}.`;

  await Promise.all(
    admins.map(async (admin) => {
      try {
        await prisma.notification.create({
          data: {
            userId: admin.userId,
            title: PENDING_TITLE,
            body,
            type: 'SYSTEM_ALERT',
            priority: 'HIGH',
            targetType: 'USER',
            targetId: String(params.memberId),
            idempotencyKey: `agency-pending:${params.companyId}:${params.memberId}:${admin.userId}`,
          },
        });
      } catch (e) {
        const dup =
          e &&
          typeof e === 'object' &&
          'code' in e &&
          (e as { code?: string }).code === 'P2002';
        if (!dup) throw e;
      }

      try {
        await notificationService.sendPushToUser(admin.userId, {
          title: PENDING_TITLE,
          body,
          data: {
            kind: 'agency_pending_member',
            memberId: String(params.memberId),
            companyId: String(params.companyId),
          },
        });
      } catch {
        /* push optional */
      }
    }),
  );
}

export async function notifyMemberApproved(params: {
  userId: number;
  companyName: string;
}) {
  const body = `Możesz korzystać z CRM i publikować oferty w biurze ${params.companyName}.`;
  await prisma.notification.create({
    data: {
      userId: params.userId,
      title: APPROVED_TITLE,
      body,
      type: 'SYSTEM_ALERT',
      priority: 'HIGH',
    },
  });

  try {
    await notificationService.sendPushToUser(params.userId, {
      title: APPROVED_TITLE,
      body,
      data: { kind: 'agency_approved' },
    });
  } catch {
    /* push optional */
  }
}

export async function notifyOffersTransferred(params: {
  toUserId: number;
  fromUserName: string;
  count: number;
}) {
  const body = `${params.fromUserName} → Twoje konto: ${params.count} ogłoszeń.`;
  await prisma.notification.create({
    data: {
      userId: params.toUserId,
      title: 'Przypisano ogłoszenia',
      body,
      type: 'SYSTEM_ALERT',
    },
  });
}

export function isAgencyPendingNotification(n: { title?: string | null; targetType?: string | null }) {
  return n.title === PENDING_TITLE && n.targetType === 'USER';
}

export function agencyPendingApprovalLink() {
  return '/moje-konto/firma?pending=1#zgłoszenia';
}
