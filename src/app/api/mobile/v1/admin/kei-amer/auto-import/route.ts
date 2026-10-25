import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import {
  getKeiAutoImportConfig,
  KeiAutoImportValidationError,
  parseKeiAutoImportPatch,
  saveKeiAutoImportAndKick,
} from '@/lib/keiAutoImport';

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
  try {
    const { config, tick } = await saveKeiAutoImportAndKick(parseKeiAutoImportPatch(body, gate.adminId));
    return NextResponse.json({ ok: true, config, tick });
  } catch (error) {
    if (error instanceof KeiAutoImportValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 422 });
    }
    throw error;
  }
}
