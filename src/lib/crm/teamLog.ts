import { prisma } from '@/lib/prisma';

/**
 * Dziennik zespołu: każda akcja agenta zapisana na serwerze z godziną.
 * Kierownik biura widzi, co który agent danego dnia zrobił.
 * Zapis nigdy nie blokuje akcji — błąd dziennika jest tylko logowany.
 */
export type TeamEventInput = {
  userId: number;
  kind: string;
  title: string;
  body?: string | null;
  refType?: string | null;
  refId?: number | null;
};

async function companyIdFor(userId: number): Promise<number | null> {
  const member = await prisma.agencyCompanyMember.findUnique({ where: { userId }, select: { companyId: true } });
  if (member?.companyId) return member.companyId;
  const owned = await prisma.agencyCompany.findUnique({ where: { ownerUserId: userId }, select: { id: true } });
  return owned?.id ?? null;
}

export async function logTeamEvent(event: TeamEventInput): Promise<void> {
  try {
    const companyId = await companyIdFor(event.userId);
    await prisma.$executeRawUnsafe(
      `INSERT INTO AgencyTeamEvent (companyId, userId, kind, title, body, refType, refId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      companyId,
      event.userId,
      event.kind.slice(0, 48),
      event.title.slice(0, 255),
      event.body ? event.body.slice(0, 4000) : null,
      event.refType ?? null,
      event.refId ?? null,
    );
  } catch (error) {
    console.warn('[teamLog] skip', error instanceof Error ? error.message : error);
  }
}

export type TeamDayEvent = {
  id: number;
  at: string;
  userId: number;
  kind: string;
  title: string;
  body: string | null;
  refType: string | null;
  refId: number | null;
  source: 'log' | 'client';
};

/** Zdarzenia całego biura z jednego dnia: dziennik + aktywności z kart klientów. */
export async function listTeamDay(params: { companyId: number; day: Date }): Promise<{
  agents: Array<{ userId: number; name: string; role: string }>;
  events: TeamDayEvent[];
}> {
  const start = new Date(params.day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const company = await prisma.agencyCompany.findUnique({
    where: { id: params.companyId },
    select: {
      ownerUserId: true,
      owner: { select: { id: true, name: true } },
      members: { select: { userId: true, role: true, status: true, user: { select: { id: true, name: true } } } },
    },
  });
  if (!company) return { agents: [], events: [] };

  const agentMap = new Map<number, { userId: number; name: string; role: string }>();
  agentMap.set(company.ownerUserId, { userId: company.ownerUserId, name: company.owner?.name || 'Kierownik biura', role: 'ADMIN' });
  for (const m of company.members) {
    if (m.status !== 'ACTIVE' && m.userId !== company.ownerUserId) continue;
    agentMap.set(m.userId, { userId: m.userId, name: m.user?.name || `Agent #${m.userId}`, role: m.role });
  }
  const userIds = [...agentMap.keys()];

  const logged = (await prisma
    .$queryRawUnsafe<Array<{ id: bigint; userId: number; kind: string; title: string; body: string | null; refType: string | null; refId: number | null; createdAt: Date }>>(
      `SELECT id, userId, kind, title, body, refType, refId, createdAt FROM AgencyTeamEvent
       WHERE (companyId = ? OR userId IN (${userIds.map(() => '?').join(',')})) AND createdAt >= ? AND createdAt < ?
       ORDER BY createdAt DESC LIMIT 1500`,
      params.companyId,
      ...userIds,
      start,
      end,
    )
    .catch(() => [])) as Array<{ id: bigint; userId: number; kind: string; title: string; body: string | null; refType: string | null; refId: number | null; createdAt: Date }>;

  const activities = await prisma.agencyClientActivity.findMany({
    where: { agencyUserId: { in: userIds }, createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: 'desc' },
    take: 1500,
    select: { id: true, agencyUserId: true, kind: true, title: true, body: true, clientId: true, createdAt: true, client: { select: { firstName: true, lastName: true } } },
  });

  const events: TeamDayEvent[] = [
    ...logged.map((row) => ({
      id: Number(row.id),
      at: new Date(row.createdAt).toISOString(),
      userId: row.userId,
      kind: row.kind,
      title: row.title,
      body: row.body,
      refType: row.refType,
      refId: row.refId,
      source: 'log' as const,
    })),
    ...activities.map((row) => ({
      id: -row.id,
      at: row.createdAt.toISOString(),
      userId: row.agencyUserId,
      kind: row.kind,
      title: row.title || row.kind,
      body: [row.client ? `${row.client.firstName} ${row.client.lastName}`.trim() : null, row.body].filter(Boolean).join(' · ') || null,
      refType: 'client',
      refId: row.clientId,
      source: 'client' as const,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return { agents: [...agentMap.values()], events };
}
