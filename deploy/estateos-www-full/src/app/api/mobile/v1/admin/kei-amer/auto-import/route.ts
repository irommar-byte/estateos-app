import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { getKeiAutoImportConfig, saveKeiAutoImportConfig } from '@/lib/keiAutoImport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  const config = await getKeiAutoImportConfig();
  return NextResponse.json({ ok: true, config });
}

export async function PUT(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const config = await saveKeiAutoImportConfig({
    adminUserId: gate.adminId,
    enabled: body.enabled == null ? undefined : Boolean(body.enabled),
    intervalMinutes: body.intervalMinutes == null ? undefined : Number(body.intervalMinutes),
    count: body.count == null ? undefined : Number(body.count),
    targetUserId: body.targetUserId == null ? undefined : Number(body.targetUserId),
    agentCommissionPercent:
      body.agentCommissionPercent == null ? undefined : Number(body.agentCommissionPercent),
    propertyKind: body.propertyKind === 'house' ? 'house' : body.propertyKind === 'apartment' ? 'apartment' : undefined,
    transactionKind: body.transactionKind === 'rent' ? 'rent' : body.transactionKind === 'sale' ? 'sale' : undefined,
  });
  return NextResponse.json({ ok: true, config });
}
