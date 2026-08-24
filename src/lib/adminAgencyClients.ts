import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { restoreAgencyClient } from '@/lib/crm/clientArchive';
import { AGENCY_UPLOAD_BASE_FS } from '@/lib/upload/agencyBrandingUpload';

export type AdminClientListItem = {
  id: number;
  status: string;
  type: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  pesel: string | null;
  agencyUserId: number;
  agencyName: string | null;
  agencyEmail: string | null;
  linkedOfferId: number | null;
  linkedUserId: number | null;
  hasAcquisition: boolean;
  activityCount: number;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
};

export async function listAdminAgencyClients(params: {
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  q?: string;
  take?: number;
}): Promise<AdminClientListItem[]> {
  const status = params.status || 'ALL';
  const q = String(params.q || '').trim();
  const rows = await prisma.agencyClient.findMany({
    where: {
      ...(status === 'ALL' ? {} : { status }),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
              { pesel: { contains: q } },
              { notes: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(params.take || 200, 500),
    include: {
      agencyUser: { select: { id: true, name: true, email: true } },
      acquisition: { select: { id: true } },
      _count: { select: { activities: true, matches: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    type: row.type,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    pesel: row.pesel,
    agencyUserId: row.agencyUserId,
    agencyName: row.agencyUser.name,
    agencyEmail: row.agencyUser.email,
    linkedOfferId: row.linkedOfferId,
    linkedUserId: row.linkedUserId,
    hasAcquisition: Boolean(row.acquisition),
    activityCount: row._count.activities,
    matchCount: row._count.matches,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getAdminAgencyClientDetail(clientId: number) {
  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    include: {
      agencyUser: { select: { id: true, name: true, email: true, phone: true } },
      linkedUser: { select: { id: true, email: true, name: true, lastLoginAt: true } },
      linkedOffer: {
        select: {
          id: true,
          title: true,
          status: true,
          price: true,
          city: true,
          officeReviewStatus: true,
        },
      },
      acquisition: {
        select: {
          id: true,
          status: true,
          signedAt: true,
          signerName: true,
          documentHash: true,
          agreementSnapshot: true,
          formData: true,
        },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: {
          id: true,
          kind: true,
          title: true,
          body: true,
          createdAt: true,
          metadata: true,
        },
      },
      matches: {
        orderBy: { score: 'desc' },
        take: 10,
        include: { offer: { select: { id: true, title: true, city: true, price: true, status: true } } },
      },
      deskCases: { select: { id: true, pipelineStage: true, source: true }, take: 10 },
      _count: {
        select: {
          activities: true,
          matches: true,
          portalPushSubscriptions: true,
          deskCases: true,
        },
      },
    },
  });
  if (!client) return null;
  return client;
}

export async function previewAdminClientPurge(clientId: number) {
  const client = await getAdminAgencyClientDetail(clientId);
  if (!client) return null;
  const linkedUser = client.linkedUser;
  let linkedUserSafeToDelete = false;
  if (linkedUser?.email?.endsWith('@portal.estateos.internal')) {
    const otherClients = await prisma.agencyClient.count({
      where: { linkedUserId: linkedUser.id, id: { not: clientId } },
    });
    const offers = await prisma.offer.count({ where: { userId: linkedUser.id } });
    linkedUserSafeToDelete = otherClients === 0 && offers === 0;
  }
  return {
    clientId,
    status: client.status,
    name: `${client.firstName} ${client.lastName}`.trim(),
    counts: client._count,
    hasAcquisition: Boolean(client.acquisition),
    linkedOfferId: client.linkedOfferId,
    linkedUser: linkedUser
      ? {
          id: linkedUser.id,
          email: linkedUser.email,
          safeToDeleteStub: linkedUserSafeToDelete,
        }
      : null,
    paperFiles: extractPaperUrls(client.acquisition?.formData),
  };
}

function extractPaperUrls(formData: unknown): string[] {
  if (!formData || typeof formData !== 'object') return [];
  const papers = (formData as { paperContracts?: Array<{ url?: string }> }).paperContracts;
  if (!Array.isArray(papers)) return [];
  return papers.map((p) => String(p.url || '')).filter(Boolean);
}

export async function permanentlyDeleteAgencyClient(clientId: number) {
  const preview = await previewAdminClientPurge(clientId);
  if (!preview) throw new Error('CLIENT_NOT_FOUND');

  await prisma.agencyClient.delete({ where: { id: clientId } });

  if (preview.linkedUser?.safeToDeleteStub) {
    await prisma.user.delete({ where: { id: preview.linkedUser.id } }).catch(() => {});
  }

  for (const url of preview.paperFiles) {
    const fileName = url.split('/').pop();
    if (!fileName) continue;
    const full = path.join(AGENCY_UPLOAD_BASE_FS, fileName);
    await fs.unlink(full).catch(() => {});
  }

  // Portal attachment directory if present
  const portalDir = path.join(AGENCY_UPLOAD_BASE_FS, `portal-${clientId}`);
  await fs.rm(portalDir, { recursive: true, force: true }).catch(() => {});

  return preview;
}

export { restoreAgencyClient };
