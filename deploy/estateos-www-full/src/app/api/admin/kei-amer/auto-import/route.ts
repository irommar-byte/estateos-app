import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getKeiAutoImportConfig, saveKeiAutoImportAndKick } from '@/lib/keiAutoImport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

function parsePatch(body: Record<string, unknown>, adminUserId: number) {
  return {
    adminUserId,
    enabled: body.enabled == null ? undefined : Boolean(body.enabled),
    intervalMinutes: body.intervalMinutes == null ? undefined : Number(body.intervalMinutes),
    count: body.count == null ? undefined : Number(body.count),
    targetUserId: body.targetUserId == null ? undefined : Number(body.targetUserId),
    agentCommissionPercent:
      body.agentCommissionPercent == null ? undefined : Number(body.agentCommissionPercent),
    propertyKind: body.propertyKind === 'house' ? 'house' : body.propertyKind === 'apartment' ? 'apartment' : undefined,
    transactionKind: body.transactionKind === 'rent' ? 'rent' : body.transactionKind === 'sale' ? 'sale' : undefined,
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }
  const config = await getKeiAutoImportConfig();
  return NextResponse.json({ ok: true, config });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { config, tick } = await saveKeiAutoImportAndKick(parsePatch(body, admin.id));
  return NextResponse.json({ ok: true, config, tick });
}
