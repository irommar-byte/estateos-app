type Db = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

export type LegalStatusOverride = {
  legalCheckStatus: 'PENDING' | 'REJECTED' | 'VERIFIED';
  isLegalSafeVerified: boolean;
};

function toPublicStatus(status: unknown): LegalStatusOverride['legalCheckStatus'] | null {
  const value = String(status || '').toUpperCase();
  if (value === 'APPROVED' || value === 'VERIFIED') return 'VERIFIED';
  if (value === 'REJECTED') return 'REJECTED';
  if (value === 'PENDING') return 'PENDING';
  return null;
}

export async function legalStatusOverridesForOffers(db: Db, offerIds: number[]) {
  const ids = Array.from(new Set(offerIds.filter((id) => Number.isFinite(id) && id > 0)));
  const map = new Map<number, LegalStatusOverride>();
  if (!ids.length) return map;

  try {
    const rows = await db.$queryRawUnsafe<any[]>(
      `
        SELECT offerId, status
        FROM LegalVerificationRequest
        WHERE offerId IN (${ids.map(() => '?').join(',')})
        ORDER BY offerId ASC, updatedAt DESC, createdAt DESC, id DESC
      `,
      ...ids
    );

    for (const row of rows) {
      const offerId = Number(row.offerId);
      if (map.has(offerId)) continue;
      const legalCheckStatus = toPublicStatus(row.status);
      if (!legalCheckStatus) continue;
      map.set(offerId, {
        legalCheckStatus,
        isLegalSafeVerified: legalCheckStatus === 'VERIFIED',
      });
    }
  } catch {
    // Older deployments may not have the queue table yet. Existing description marker fallback still works.
  }

  return map;
}

export function applyLegalStatusOverride<T extends Record<string, any>>(
  offer: T,
  overrides: Map<number, LegalStatusOverride>
) {
  const override = overrides.get(Number(offer.id));
  return override ? { ...offer, ...override } : offer;
}
