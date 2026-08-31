import { prisma } from '@/lib/prisma';
import { parseMobileUserIdFromAuthHeader } from '@/lib/mobileAuthUserId';
import { ensureAgencyClientLinkedUser } from '@/lib/crm/linkedUser';
import { Platform } from '@prisma/client';

const PLACEHOLDER_EMAIL_RE = /@portal\.estateos\.internal$/i;
const PORTAL_TOKEN_RE = /^[a-f0-9]{32,64}$/i;

export function normalizePortalEmail(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export function isPlaceholderPortalEmail(email: string): boolean {
  return PLACEHOLDER_EMAIL_RE.test(email);
}

export function maskEmail(value: string | null | undefined): string | null {
  const email = normalizePortalEmail(value);
  if (!email || !email.includes('@') || isPlaceholderPortalEmail(email)) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return null;
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function extractPortalTokenFromUrl(raw: string): string | null {
  const cleaned = String(raw || '').trim();
  if (!cleaned) return null;
  const pathMatch = cleaned.match(/(?:^|[/:])klient\/([a-f0-9]{32,64})(?:[/?#]|$)/i);
  if (pathMatch?.[1]) return pathMatch[1].toLowerCase();
  try {
    const normalized = cleaned.includes('://') ? cleaned : `https://estateos.pl/${cleaned.replace(/^\//, '')}`;
    const url = new URL(normalized);
    if (url.protocol === 'estateos:' && String(url.hostname || '').toLowerCase() === 'klient') {
      const seg = url.pathname.replace(/^\//, '').split('/')[0] || '';
      if (PORTAL_TOKEN_RE.test(seg)) return seg.toLowerCase();
    }
    const fromPath = url.pathname.match(/\/klient\/([a-f0-9]{32,64})/i);
    if (fromPath?.[1]) return fromPath[1].toLowerCase();
    const fromQuery = String(url.searchParams.get('portalToken') || url.searchParams.get('portal') || '');
    if (PORTAL_TOKEN_RE.test(fromQuery)) return fromQuery.toLowerCase();
  } catch {
    /* ignore */
  }
  return null;
}

export type PortalLinkDecision =
  | { action: 'ok' }
  | { action: 'set' }
  | { action: 'reassign'; fromUserId: number }
  | { action: 'mismatch'; reason: string }
  | { action: 'missing_email'; reason: string };

export function decidePortalAccountLink(params: {
  clientEmail: string | null | undefined;
  clientLinkedUserId: number | null | undefined;
  userId: number;
  userEmail: string | null | undefined;
}): PortalLinkDecision {
  const userEmail = normalizePortalEmail(params.userEmail);
  const clientEmail = normalizePortalEmail(params.clientEmail);
  if (!userEmail || isPlaceholderPortalEmail(userEmail)) {
    return { action: 'missing_email', reason: 'Zaloguj się kontem z e-mailem, ten sam co w CRM.' };
  }
  if (!clientEmail || isPlaceholderPortalEmail(clientEmail)) {
    return { action: 'missing_email', reason: 'W CRM nie ma e-maila klienta — agent musi go uzupełnić.' };
  }
  if (clientEmail !== userEmail) {
    return {
      action: 'mismatch',
      reason: 'To konto ma inny e-mail niż w CRM. Użyj Passkey / logowania na adres z maila od agenta.',
    };
  }
  const linked = Number(params.clientLinkedUserId || 0);
  if (linked === params.userId) return { action: 'ok' };
  if (linked > 0) return { action: 'reassign', fromUserId: linked };
  return { action: 'set' };
}

export type PortalAccountStatus = 'linked' | 'ready' | 'wrong_account' | 'anonymous';

export function resolvePortalAccountStatus(params: {
  clientEmail: string | null | undefined;
  clientLinkedUserId: number | null | undefined;
  sessionUserId: number | null;
  sessionUserEmail: string | null | undefined;
}): {
  status: PortalAccountStatus;
  emailMasked: string | null;
  sessionEmailMasked: string | null;
  linked: boolean;
  linkedToYou: boolean;
} {
  const emailMasked = maskEmail(params.clientEmail);
  const linkedUserId = Number(params.clientLinkedUserId || 0) || null;

  if (!params.sessionUserId) {
    return {
      status: 'anonymous',
      emailMasked,
      sessionEmailMasked: null,
      linked: Boolean(linkedUserId),
      linkedToYou: false,
    };
  }

  const sessionEmailMasked = maskEmail(params.sessionUserEmail);
  const decision = decidePortalAccountLink({
    clientEmail: params.clientEmail,
    clientLinkedUserId: linkedUserId,
    userId: params.sessionUserId,
    userEmail: params.sessionUserEmail,
  });

  if (decision.action === 'mismatch') {
    return {
      status: 'wrong_account',
      emailMasked,
      sessionEmailMasked,
      linked: Boolean(linkedUserId),
      linkedToYou: false,
    };
  }

  if (decision.action === 'ok') {
    return {
      status: 'linked',
      emailMasked,
      sessionEmailMasked,
      linked: true,
      linkedToYou: true,
    };
  }

  if (decision.action === 'missing_email') {
    const clientEmail = normalizePortalEmail(params.clientEmail);
    if (!clientEmail || isPlaceholderPortalEmail(clientEmail)) {
      return {
        status: 'anonymous',
        emailMasked,
        sessionEmailMasked,
        linked: Boolean(linkedUserId),
        linkedToYou: linkedUserId === params.sessionUserId,
      };
    }
  }

  return {
    status: 'ready',
    emailMasked,
    sessionEmailMasked,
    linked: Boolean(linkedUserId),
    linkedToYou: false,
  };
}

export function bearerUserIdFromRequest(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  const access = req.headers.get('x-access-token');
  const authToken = req.headers.get('auth-token');
  return (
    parseMobileUserIdFromAuthHeader(auth) ||
    parseMobileUserIdFromAuthHeader(access ? (access.startsWith('Bearer ') ? access : `Bearer ${access}`) : null) ||
    parseMobileUserIdFromAuthHeader(authToken ? (authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`) : null)
  );
}

async function migratePortalDevices(fromUserId: number, toUserId: number) {
  if (fromUserId === toUserId) return;
  const devices = await prisma.device.findMany({
    where: { userId: fromUserId, isActive: true },
    select: {
      id: true,
      expoPushToken: true,
      platform: true,
      deviceModel: true,
      appVersion: true,
    },
  });
  for (const device of devices) {
    await prisma.device.upsert({
      where: { userId_expoPushToken: { userId: toUserId, expoPushToken: device.expoPushToken } },
      update: {
        isActive: true,
        platform: device.platform,
        deviceModel: device.deviceModel,
        appVersion: device.appVersion,
        lastSyncedAt: new Date(),
      },
      create: {
        userId: toUserId,
        expoPushToken: device.expoPushToken,
        platform: device.platform,
        deviceModel: device.deviceModel,
        appVersion: device.appVersion,
        isActive: true,
      },
    });
    await prisma.device.update({
      where: { id: device.id },
      data: { isActive: false },
    });
  }
}

export async function linkPortalAccount(params: {
  portalToken: string;
  userId: number;
}): Promise<{ ok: true; linkedUserId: number } | { ok: false; status: number; error: string }> {
  const token = String(params.portalToken || '').trim();
  if (!PORTAL_TOKEN_RE.test(token)) {
    return { ok: false, status: 400, error: 'Nieprawidłowy token panelu.' };
  }

  const [client, user] = await Promise.all([
    prisma.agencyClient.findFirst({
      where: { portalToken: token, status: 'ACTIVE' },
      select: { id: true, email: true, linkedUserId: true },
    }),
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, email: true },
    }),
  ]);

  if (!client) return { ok: false, status: 404, error: 'Panel niedostępny.' };
  if (!user) return { ok: false, status: 401, error: 'Nie znaleziono konta.' };

  const decision = decidePortalAccountLink({
    clientEmail: client.email,
    clientLinkedUserId: client.linkedUserId,
    userId: user.id,
    userEmail: user.email,
  });

  if (decision.action === 'mismatch' || decision.action === 'missing_email') {
    return { ok: false, status: 409, error: decision.reason };
  }

  if (decision.action === 'ok') {
    return { ok: true, linkedUserId: user.id };
  }

  if (decision.action === 'reassign') {
    await migratePortalDevices(decision.fromUserId, user.id);
  }

  await prisma.agencyClient.update({
    where: { id: client.id },
    data: { linkedUserId: user.id },
  });

  return { ok: true, linkedUserId: user.id };
}

export type LinkedPortalSummary = {
  portalToken: string;
  clientName: string;
  agencyName: string;
  type: string;
};

export async function listAndLinkPortalsForUser(userId: number): Promise<LinkedPortalSummary[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) return [];

  const email = normalizePortalEmail(user.email);

  if (email && !isPlaceholderPortalEmail(email)) {
    const byEmail = await prisma.agencyClient.findMany({
      where: {
        status: 'ACTIVE',
        portalToken: { not: null },
        email,
        NOT: { linkedUserId: userId },
      },
      select: { id: true, email: true, linkedUserId: true, portalToken: true },
    });
    for (const row of byEmail) {
      const decision = decidePortalAccountLink({
        clientEmail: row.email,
        clientLinkedUserId: row.linkedUserId,
        userId: user.id,
        userEmail: user.email,
      });
      if (decision.action === 'set' || decision.action === 'reassign' || decision.action === 'ok') {
        if (decision.action === 'reassign') {
          await migratePortalDevices(decision.fromUserId, user.id);
        }
        if (decision.action !== 'ok') {
          await prisma.agencyClient.update({
            where: { id: row.id },
            data: { linkedUserId: user.id },
          });
        }
      }
    }
  }

  const linked = await prisma.agencyClient.findMany({
    where: {
      status: 'ACTIVE',
      portalToken: { not: null },
      linkedUserId: userId,
    },
    select: {
      portalToken: true,
      firstName: true,
      lastName: true,
      type: true,
      agencyUser: { select: { name: true, companyName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return linked
    .filter((row) => row.portalToken)
    .map((row) => ({
      portalToken: String(row.portalToken),
      clientName: `${row.firstName} ${row.lastName}`.trim(),
      agencyName: row.agencyUser.companyName?.trim() || row.agencyUser.name || 'EstateOS',
      type: row.type,
    }));
}

function parseDevicePlatform(raw: unknown): Platform {
  const value = String(raw || '').trim().toUpperCase();
  if (value === 'ANDROID') return Platform.ANDROID;
  if (value === 'WEB') return Platform.WEB;
  return Platform.IOS;
}

export async function registerPortalDevice(params: {
  portalToken: string;
  expoPushToken: string;
  platform?: string;
  deviceModel?: string;
  appVersion?: string;
}): Promise<{ ok: true; linkedUserId: number } | { ok: false; status: number; error: string }> {
  const token = String(params.portalToken || '').trim();
  const expoPushToken = String(params.expoPushToken || '').replace(/\s+/g, '').trim();
  if (!PORTAL_TOKEN_RE.test(token)) {
    return { ok: false, status: 400, error: 'Nieprawidłowy token panelu.' };
  }
  if (!expoPushToken) {
    return { ok: false, status: 400, error: 'Brak tokenu powiadomień.' };
  }

  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      linkedUserId: true,
    },
  });
  if (!client) return { ok: false, status: 404, error: 'Panel niedostępny.' };

  let linkedUserId = client.linkedUserId;
  if (!linkedUserId) {
    linkedUserId = await ensureAgencyClientLinkedUser({
      email: client.email,
      phone: client.phone,
      name: `${client.firstName} ${client.lastName}`.trim() || 'Klient CRM',
    });
    if (linkedUserId) {
      await prisma.agencyClient.update({
        where: { id: client.id },
        data: { linkedUserId },
      });
    }
  }
  if (!linkedUserId) {
    return { ok: false, status: 409, error: 'Nie można powiązać urządzenia — brak e-maila lub telefonu w CRM.' };
  }

  const platform = parseDevicePlatform(params.platform);
  const deviceModel = String(params.deviceModel || 'Unknown').slice(0, 120);
  const appVersion = String(params.appVersion || '1.0').slice(0, 32);

  await prisma.$transaction(async (tx) => {
    await tx.device.updateMany({
      where: { expoPushToken, userId: { not: linkedUserId } },
      data: { isActive: false },
    });
    await tx.device.upsert({
      where: { userId_expoPushToken: { userId: linkedUserId, expoPushToken } },
      update: {
        isActive: true,
        platform,
        deviceModel,
        appVersion,
        lastSyncedAt: new Date(),
      },
      create: {
        userId: linkedUserId,
        expoPushToken,
        platform,
        deviceModel,
        appVersion,
        isActive: true,
      },
    });
  });

  return { ok: true, linkedUserId };
}
