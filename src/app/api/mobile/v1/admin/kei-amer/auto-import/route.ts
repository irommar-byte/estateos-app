import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { getKeiAutoImportConfig, parseKeiAutoImportPatch, saveKeiAutoImportAndKick } from '@/lib/keiAutoImport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

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
  const { config, tick } = await saveKeiAutoImportAndKick(parseKeiAutoImportPatch(body, gate.adminId));
  return NextResponse.json({ ok: true, config, tick });
}
