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

function parseSmartAddDecisions(raw: unknown): Record<string, Record<string, boolean>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, Record<string, boolean>> = {};
  for (const [url, decisions] of Object.entries(raw as Record<string, unknown>).slice(0, 80)) {
    if (!decisions || typeof decisions !== 'object') continue;
    const clean: Record<string, boolean> = {};
    for (const [field, value] of Object.entries(decisions as Record<string, unknown>)) {
      if (typeof value === 'boolean') clean[field.slice(0, 64)] = value;
    }
    if (Object.keys(clean).length) out[url] = clean;
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseKeiExportBody(body: Record<string, unknown>) {
  const selections = Array.isArray(body?.selections)
    ? body.selections
        .slice(0, 80)
        .map((row: Record<string, unknown>) => {
          const text = (value: unknown, max = 300) => {
            const out = String(value ?? '').trim().slice(0, max);
            return out || undefined;
          };
          const rooms = Number(row?.rooms);
          return {
            keiId: String(row?.keiId || '').trim().slice(0, 64),
            portalUrl: String(row?.portalUrl || '').trim().slice(0, 600),
            address: text(row?.address),
            phone: text(row?.phone, 32),
            district: text(row?.district, 96),
            street: text(row?.street, 160),
            rooms: Number.isFinite(rooms) && rooms > 0 && rooms <= 20 ? Math.floor(rooms) : undefined,
            listedAt: text(row?.listedAt, 40),
            directOwner: row?.directOwner === true || row?.directOwner === 1 || row?.directOwner === '1',
          };
        })
        .filter((row: { portalUrl: string }) => /^https?:\/\//i.test(row.portalUrl))
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
    smartAddEnabled: typeof body?.smartAddEnabled === 'boolean' ? body.smartAddEnabled : undefined,
    smartAddDecisionsByUrl: parseSmartAddDecisions(body?.smartAddDecisionsByUrl),
  };
}
