import { prisma } from '@/lib/prisma';
import { ensurePageVisitLogTable } from '@/lib/pageVisitLogTable';

export type AdminUserPageViewRow = {
  path: string;
  deviceType: string;
  at: string;
};

export type AdminUserContactPeerRow = {
  userId: number;
  name: string | null;
  email: string | null;
  lastAt: string;
};

export type AdminUserAgencyClientRow = {
  id: number;
  name: string;
  type: string;
  status: string;
  email: string | null;
  phone: string | null;
};

export type AdminUserActivityBundle = {
  contactThreads: number;
  contactMessagesSent: number;
  dealsAsBuyer: number;
  dealsAsSeller: number;
  appointmentsTotal: number;
  agencyClientsManaged: number;
  pageViews7d: number;
  recentPageViews: AdminUserPageViewRow[];
  recentContacts: AdminUserContactPeerRow[];
  recentAgencyClients: AdminUserAgencyClientRow[];
};

export async function loadAdminUserActivity(userId: number): Promise<AdminUserActivityBundle> {
  await ensurePageVisitLogTable();

  const [
    contactThreads,
    contactMessagesSent,
    dealsAsBuyer,
    dealsAsSeller,
    appointmentsTotal,
    agencyClientsManaged,
    pageViews7dRow,
    recentPageViewsRaw,
    recentThreadsRaw,
    recentClientsRaw,
  ] = await Promise.all([
    prisma.contactThread.count({
      where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
    }),
    prisma.contactMessage.count({ where: { senderId: userId } }),
    prisma.deal.count({ where: { buyerId: userId } }),
    prisma.deal.count({ where: { sellerId: userId } }),
    prisma.appointment.count({ where: { proposedById: userId } }),
    prisma.agencyClient.count({ where: { agencyUserId: userId } }),
    prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `
        SELECT COUNT(*) AS cnt
        FROM PageVisitLog
        WHERE userId = ?
          AND createdAt >= DATE_SUB(NOW(3), INTERVAL 7 DAY)
      `,
      userId,
    ),
    prisma.$queryRawUnsafe<
      Array<{ path: string; deviceType: string; createdAt: Date }>
    >(
      `
        SELECT path, deviceType, createdAt
        FROM PageVisitLog
        WHERE userId = ?
        ORDER BY createdAt DESC
        LIMIT 40
      `,
      userId,
    ),
    prisma.contactThread.findMany({
      where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
      orderBy: { updatedAt: 'desc' },
      take: 12,
      include: {
        userLow: { select: { id: true, name: true, email: true } },
        userHigh: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.agencyClient.findMany({
      where: { agencyUserId: userId },
      orderBy: { updatedAt: 'desc' },
      take: 15,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        type: true,
        status: true,
        email: true,
        phone: true,
      },
    }),
  ]);

  const recentPageViews: AdminUserPageViewRow[] = recentPageViewsRaw.map((row) => ({
    path: String(row.path || '/'),
    deviceType: String(row.deviceType || 'unknown'),
    at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  }));

  const recentContacts: AdminUserContactPeerRow[] = recentThreadsRaw.map((thread) => {
    const peer = thread.userLowId === userId ? thread.userHigh : thread.userLow;
    return {
      userId: peer.id,
      name: peer.name,
      email: peer.email,
      lastAt: thread.updatedAt.toISOString(),
    };
  });

  const recentAgencyClients: AdminUserAgencyClientRow[] = recentClientsRaw.map((client) => ({
    id: client.id,
    name: `${client.firstName} ${client.lastName}`.trim(),
    type: client.type,
    status: client.status,
    email: client.email,
    phone: client.phone,
  }));

  return {
    contactThreads,
    contactMessagesSent,
    dealsAsBuyer,
    dealsAsSeller,
    appointmentsTotal,
    agencyClientsManaged,
    pageViews7d: Number(pageViews7dRow[0]?.cnt ?? 0),
    recentPageViews,
    recentContacts,
    recentAgencyClients,
  };
}
