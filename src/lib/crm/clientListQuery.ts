import { Prisma } from '@prisma/client';

export type ClientMatchAggRow = {
  clientId: number;
  matchCount: number | bigint | string;
  topScore: number | null;
  sentCount: number | bigint | string;
};

export type ClientActivityAggRow = {
  clientId: number;
  kind: string;
  metadata: unknown;
};

export function num(value: number | bigint | string | null | undefined): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function clientMatchStatsSql(clientIds: number[]): Prisma.Sql {
  return Prisma.sql`
    SELECT
      clientId,
      COUNT(*) AS matchCount,
      MAX(score) AS topScore,
      SUM(CASE WHEN notifiedAt IS NOT NULL THEN 1 ELSE 0 END) AS sentCount
    FROM AgencyClientMatch
    WHERE clientId IN (${Prisma.join(clientIds)})
    GROUP BY clientId
  `;
}

export function clientActivityLatestSql(clientIds: number[]): Prisma.Sql {
  return Prisma.sql`
    SELECT a.clientId, a.kind, a.metadata
    FROM AgencyClientActivity a
    INNER JOIN (
      SELECT clientId, kind, MAX(id) AS maxId
      FROM AgencyClientActivity
      WHERE clientId IN (${Prisma.join(clientIds)})
        AND kind IN ('ACQUISITION_MEETING', 'PRESENTATION_CONFIRMED')
      GROUP BY clientId, kind
    ) latest ON latest.maxId = a.id
  `;
}

export function indexMatchStats(rows: ClientMatchAggRow[]) {
  return new Map(
    rows.map((row) => [
      Number(row.clientId),
      { count: num(row.matchCount), top: row.topScore == null ? null : num(row.topScore), sent: num(row.sentCount) },
    ]),
  );
}

export function indexActivities(rows: ClientActivityAggRow[]) {
  const actsByClient = new Map<number, Array<{ kind: string; metadata: unknown }>>();
  for (const row of rows) {
    const clientId = Number(row.clientId);
    const list = actsByClient.get(clientId) || [];
    list.push({ kind: String(row.kind || ''), metadata: row.metadata });
    actsByClient.set(clientId, list);
  }
  return actsByClient;
}
