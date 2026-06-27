export function parseFloorPlanOverrides(raw: unknown): Record<string, boolean> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'boolean') out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function parseFloorPlanSelections(raw: unknown) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, { enabled: boolean; imageIndex: number }> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    const enabled = row.enabled === true;
    const imageIndex = Number(row.imageIndex);
    out[key] = {
      enabled,
      imageIndex: Number.isFinite(imageIndex) && imageIndex >= 0 ? Math.floor(imageIndex) : 0,
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function parseKeiExportBody(body: Record<string, unknown>) {
  const selections = Array.isArray(body?.selections)
    ? body.selections
        .map((row: Record<string, unknown>) => ({
          keiId: String(row?.keiId || ''),
          portalUrl: String(row?.portalUrl || ''),
          address: String(row?.address || '').trim() || undefined,
        }))
        .filter((row: { portalUrl: string }) => row.portalUrl)
    : undefined;

  const targetUserId = Number(body?.targetUserId);
  const agentCommissionPercent = Number(body?.agentCommissionPercent);
  const count = Number(body?.count);

  return {
    targetUserId: Number.isFinite(targetUserId) && targetUserId > 0 ? targetUserId : undefined,
    agentCommissionPercent:
      Number.isFinite(agentCommissionPercent) && agentCommissionPercent >= 0 ? agentCommissionPercent : undefined,
    count: Number.isFinite(count) && count > 0 ? count : undefined,
    propertyKind: body?.propertyKind === 'house' ? ('house' as const) : ('apartment' as const),
    transactionKind: body?.transactionKind === 'rent' ? ('rent' as const) : ('sale' as const),
    selections,
    floorPlanOverrides: parseFloorPlanOverrides(body?.floorPlanOverrides),
    floorPlanSelections: parseFloorPlanSelections(body?.floorPlanSelections),
  };
}
