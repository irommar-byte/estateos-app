import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/core/notification.core';
import { notifyAdminPhotoSessionPending } from '@/lib/adminAttentionPush';
import { prisma } from '@/lib/prisma';
import {
  extractBearerToken,
  parseUserIdFromMobileJwt,
  requireMobileAdmin,
} from '@/lib/mobileAdminAuth';

const STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'] as const;
type SessionStatus = (typeof STATUSES)[number];
type WaitingOn = 'ADMIN' | 'USER' | null;
type EventAction = 'PROPOSED' | 'COUNTERED' | 'ACCEPTED' | 'DECLINED';

const PHOTO_SESSION_ADMIN_USER_ID = 3;

function normalizeStatus(raw: unknown): SessionStatus | 'ALL' {
  const value = String(raw || 'PENDING').trim().toUpperCase();
  if (value === 'ALL') return 'ALL';
  return STATUSES.includes(value as SessionStatus) ? (value as SessionStatus) : 'PENDING';
}

async function currentUserId(req: Request) {
  const token = extractBearerToken(req);
  if (!token) return null;
  return parseUserIdFromMobileJwt(token);
}

async function isUserInvestorPro(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPro: true, planType: true, proExpiresAt: true },
  });
  if (!user) return false;
  if (user.isPro) return true;
  const plan = String(user.planType || '').toUpperCase();
  if (plan === 'PRO' || plan === 'INVESTOR') return true;
  if (user.proExpiresAt && user.proExpiresAt.getTime() > Date.now()) return true;
  return false;
}

async function hasUsedProFreeOnAccount(userId: number) {
  const row = await prisma.photoSessionRequest.findFirst({
    where: {
      userId,
      isProFree: true,
      status: { in: ['PENDING', 'ACCEPTED'] },
    },
    select: { id: true },
  });
  return Boolean(row);
}

function formatWhen(date: Date | null | undefined) {
  if (!date) return '—';
  return date.toLocaleString('pl-PL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function serializeEvent(row: any) {
  return {
    id: row.id,
    requestId: row.requestId,
    actorUserId: row.actorUserId,
    action: row.action,
    proposedAt: row.proposedAt ? row.proposedAt.toISOString() : null,
    note: row.note,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
  };
}

function serializeRequest(row: any, user?: { name?: string | null; phone?: string | null; email?: string | null }) {
  const events = Array.isArray(row.events) ? row.events.map(serializeEvent) : [];
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    waitingOn: row.waitingOn || null,
    proposedAt: row.proposedAt?.toISOString?.() || row.proposedAt,
    note: row.note,
    propertyLabel: row.propertyLabel,
    propertyType: row.propertyType,
    transactionType: row.transactionType,
    isProFree: Boolean(row.isProFree),
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
    requesterName: user?.name || null,
    requesterPhone: user?.phone || null,
    requesterEmail: user?.email || null,
    events,
  };
}

async function appendEvent(params: {
  requestId: number;
  actorUserId: number;
  action: EventAction;
  proposedAt?: Date | null;
  note?: string | null;
}) {
  return prisma.photoSessionEvent.create({
    data: {
      requestId: params.requestId,
      actorUserId: params.actorUserId,
      action: params.action,
      proposedAt: params.proposedAt ?? null,
      note: params.note ?? null,
    },
  });
}

async function loadRequestWithEvents(id: number) {
  return prisma.photoSessionRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, phone: true, email: true } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function createPhotoSessionRequest(req: Request) {
  const userId = await currentUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Nieprawidłowe dane' }, { status: 400 });
  }

  const proposedAtRaw = String(body?.proposedAt || '').trim();
  const proposedAt = proposedAtRaw ? new Date(proposedAtRaw) : null;
  if (!proposedAt || !Number.isFinite(proposedAt.getTime())) {
    return NextResponse.json({ success: false, message: 'Wybierz poprawny termin' }, { status: 400 });
  }
  if (proposedAt.getTime() <= Date.now()) {
    return NextResponse.json({ success: false, message: 'Termin musi być w przyszłości' }, { status: 400 });
  }

  const propertyLabel = String(body?.propertyLabel || '').trim() || null;
  const propertyType = String(body?.propertyType || '').trim() || null;
  const transactionType = String(body?.transactionType || '').trim() || null;
  const note = String(body?.note || '').trim() || null;
  const investorPro = await isUserInvestorPro(userId);
  const proAlreadyUsed = investorPro ? await hasUsedProFreeOnAccount(userId) : false;
  const isProFree = investorPro && !proAlreadyUsed;

  const duplicatePending = await prisma.photoSessionRequest.findFirst({
    where: {
      userId,
      status: 'PENDING',
    },
    select: { id: true },
  });
  if (duplicatePending) {
    return NextResponse.json({
      success: false,
      message: 'Masz już aktywną propozycję sesji — odpowiedz w negocjacjach lub poczekaj na decyzję admina.',
      requestId: duplicatePending.id,
    }, { status: 409 });
  }

  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, phone: true, email: true },
  });

  const row = await prisma.photoSessionRequest.create({
    data: {
      userId,
      proposedAt,
      note,
      propertyLabel,
      propertyType,
      transactionType,
      isProFree,
      status: 'PENDING',
      waitingOn: 'ADMIN',
    },
  });

  await appendEvent({
    requestId: row.id,
    actorUserId: userId,
    action: 'PROPOSED',
    proposedAt,
    note,
  });

  notifyAdminPhotoSessionPending(row.id, requester?.name || requester?.email || null, proposedAt, propertyLabel);

  const full = await loadRequestWithEvents(row.id);
  return NextResponse.json({
    success: true,
    request: serializeRequest(full, requester || undefined),
  });
}

export async function listMyPhotoSessionRequests(req: Request) {
  const userId = await currentUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
  }

  const rows = await prisma.photoSessionRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      user: { select: { name: true, phone: true, email: true } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });

  return NextResponse.json({
    success: true,
    items: rows.map((row) => serializeRequest(row, row.user)),
  });
}

export async function respondPhotoSessionRequest(req: Request, requestId: number) {
  const userId = await currentUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Nieprawidłowe dane' }, { status: 400 });
  }

  const action = String(body?.action || '').trim().toLowerCase();
  const existing = await loadRequestWithEvents(requestId);
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ success: false, message: 'Nie znaleziono zgłoszenia' }, { status: 404 });
  }
  if (existing.status !== 'PENDING') {
    return NextResponse.json({ success: false, message: 'To zgłoszenie zostało już rozpatrzone' }, { status: 400 });
  }
  if (existing.waitingOn !== 'USER') {
    return NextResponse.json({ success: false, message: 'To nie Twoja kolej — poczekaj na odpowiedź administratora.' }, { status: 400 });
  }

  if (action === 'accept') {
    const row = await prisma.photoSessionRequest.update({
      where: { id: requestId },
      data: {
        status: 'ACCEPTED',
        waitingOn: null,
        acceptedAt: new Date(),
        acceptedById: userId,
      },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    await appendEvent({ requestId, actorUserId: userId, action: 'ACCEPTED', proposedAt: row.proposedAt });
    notifyAdminPhotoSessionPending(requestId, row.user?.name, row.proposedAt, row.propertyLabel);
    return NextResponse.json({ success: true, request: serializeRequest(row, row.user) });
  }

  if (action === 'decline') {
    const row = await prisma.photoSessionRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', waitingOn: null },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    await appendEvent({
      requestId,
      actorUserId: userId,
      action: 'DECLINED',
      note: String(body?.note || '').trim() || null,
    });
    return NextResponse.json({ success: true, request: serializeRequest(row, row.user) });
  }

  if (action === 'counter') {
    const proposedAtRaw = String(body?.proposedAt || '').trim();
    const proposedAt = proposedAtRaw ? new Date(proposedAtRaw) : null;
    if (!proposedAt || !Number.isFinite(proposedAt.getTime())) {
      return NextResponse.json({ success: false, message: 'Wybierz poprawny termin' }, { status: 400 });
    }
    if (proposedAt.getTime() <= Date.now()) {
      return NextResponse.json({ success: false, message: 'Termin musi być w przyszłości' }, { status: 400 });
    }
    const note = String(body?.note || '').trim() || null;
    const row = await prisma.photoSessionRequest.update({
      where: { id: requestId },
      data: { proposedAt, waitingOn: 'ADMIN', note: note || existing.note },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    await appendEvent({ requestId, actorUserId: userId, action: 'COUNTERED', proposedAt, note });
    notifyAdminPhotoSessionPending(requestId, row.user?.name, proposedAt, row.propertyLabel);
    return NextResponse.json({ success: true, request: serializeRequest(row, row.user) });
  }

  return NextResponse.json({ success: false, message: 'Nieobsługiwana akcja' }, { status: 400 });
}

export async function getAdminPhotoSessionQueue(req: Request) {
  const auth = await requireMobileAdmin(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const status = normalizeStatus(url.searchParams.get('status'));

  const rows = await prisma.photoSessionRequest.findMany({
    where:
      status === 'ALL'
        ? undefined
        : status === 'PENDING'
          ? { status: 'PENDING' }
          : { status },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { name: true, phone: true, email: true } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });

  return NextResponse.json({
    success: true,
    items: rows.map((row) => serializeRequest(row, row.user)),
  });
}

async function notifyUserPhotoSessionUpdate(
  userId: number,
  requestId: number,
  title: string,
  body: string,
  extra?: Record<string, unknown>,
) {
  void sendNotification({
    userId,
    type: 'CRM_EVENT',
    title,
    body,
    data: {
      kind: 'photo_session',
      requestId: String(requestId),
      screen: 'Profil',
      route: 'Profil',
      openShop: true,
      openPhotoSessions: true,
      ...extra,
    },
    idempotencyKey: `photo_session:${requestId}:user:${userId}:${title}`,
  }).catch((err) => console.error('[PHOTO_SESSION] user notify failed', err));
}

export async function acceptAdminPhotoSessionRequest(req: Request) {
  const auth = await requireMobileAdmin(req);
  if (!auth.ok) return auth.response;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Nieprawidłowe dane' }, { status: 400 });
  }

  const action = String(body?.action || 'accept').trim().toLowerCase();
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ success: false, message: 'Brak ID zgłoszenia' }, { status: 400 });
  }

  const existing = await loadRequestWithEvents(id);
  if (!existing) {
    return NextResponse.json({ success: false, message: 'Nie znaleziono zgłoszenia' }, { status: 404 });
  }
  if (existing.status !== 'PENDING') {
    return NextResponse.json({ success: false, message: 'To zgłoszenie zostało już rozpatrzone' }, { status: 400 });
  }

  if (action === 'reject' || action === 'decline') {
    const adminNote = String(body?.adminNote || body?.note || '').trim() || null;
    const row = await prisma.photoSessionRequest.update({
      where: { id },
      data: { status: 'REJECTED', waitingOn: null, adminNote },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    await appendEvent({ requestId: id, actorUserId: auth.adminId, action: 'DECLINED', note: adminNote });
    await notifyUserPhotoSessionUpdate(
      row.userId,
      id,
      'Sesja zdjęciowa — odrzucona',
      adminNote ? `Administrator odrzucił propozycję: ${adminNote}` : 'Administrator odrzucił propozycję terminu.',
      { action: 'declined' },
    );
    return NextResponse.json({ success: true, request: serializeRequest(row, row.user) });
  }

  if (action === 'counter') {
    if (existing.waitingOn !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Poczekaj na odpowiedź klienta.' }, { status: 400 });
    }
    const proposedAtRaw = String(body?.proposedAt || '').trim();
    const proposedAt = proposedAtRaw ? new Date(proposedAtRaw) : null;
    if (!proposedAt || !Number.isFinite(proposedAt.getTime())) {
      return NextResponse.json({ success: false, message: 'Wybierz poprawny termin' }, { status: 400 });
    }
    if (proposedAt.getTime() <= Date.now()) {
      return NextResponse.json({ success: false, message: 'Termin musi być w przyszłości' }, { status: 400 });
    }
    const adminNote = String(body?.adminNote || body?.note || '').trim() || null;
    const row = await prisma.photoSessionRequest.update({
      where: { id },
      data: {
        proposedAt,
        waitingOn: 'USER',
        adminNote,
      },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    await appendEvent({ requestId: id, actorUserId: auth.adminId, action: 'COUNTERED', proposedAt, note: adminNote });
    await notifyUserPhotoSessionUpdate(
      row.userId,
      id,
      'Nowy termin sesji zdjęciowej',
      `Administrator proponuje inny termin: ${formatWhen(proposedAt)}.${adminNote ? ` ${adminNote}` : ''}`,
      { action: 'counter', proposedAt: proposedAt.toISOString() },
    );
    return NextResponse.json({ success: true, request: serializeRequest(row, row.user) });
  }

  if (action !== 'accept') {
    return NextResponse.json({ success: false, message: 'Nieobsługiwana akcja' }, { status: 400 });
  }

  if (existing.waitingOn !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Poczekaj na odpowiedź klienta.' }, { status: 400 });
  }

  const adminNote = String(body?.adminNote || '').trim() || null;
  const now = new Date();
  const row = await prisma.photoSessionRequest.update({
    where: { id },
    data: {
      status: 'ACCEPTED',
      waitingOn: null,
      acceptedAt: now,
      acceptedById: auth.adminId,
      adminNote,
    },
    include: {
      user: { select: { name: true, phone: true, email: true } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });

  await appendEvent({ requestId: id, actorUserId: auth.adminId, action: 'ACCEPTED', proposedAt: row.proposedAt, note: adminNote });

  const whenLabel = formatWhen(row.proposedAt);
  await notifyUserPhotoSessionUpdate(
    row.userId,
    id,
    'Sesja zdjęciowa potwierdzona',
    `Termin ${whenLabel} został zaakceptowany. Wszystko umówione — do zobaczenia na miejscu!`,
    { action: 'accepted', proposedAt: row.proposedAt.toISOString() },
  );

  return NextResponse.json({
    success: true,
    request: serializeRequest(row, row.user),
  });
}

export { PHOTO_SESSION_ADMIN_USER_ID };
