import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { listAiUsage, OPENAI_MODEL_DEFAULT } from '@/lib/openAiClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zużycie AI: dziś, 7 i 30 dni — wywołania, odsetek błędów i szacowany koszt. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }
  const rows = await listAiUsage(30);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date());
  const weekAgo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date(Date.now() - 6 * 86_400_000));
  const sum = (filter: (row: (typeof rows)[number]) => boolean) => {
    const picked = rows.filter(filter);
    return {
      calls: picked.reduce((a, r) => a + r.calls, 0),
      failures: picked.reduce((a, r) => a + r.failures, 0),
      costUsd: Number(picked.reduce((a, r) => a + r.costUsd, 0).toFixed(4)),
    };
  };
  const models = [...new Set(rows.filter((r) => r.calls > r.failures).map((r) => r.model))];
  return NextResponse.json({
    ok: true,
    defaultModel: process.env.OPENAI_DEFAULT_MODEL?.trim() || OPENAI_MODEL_DEFAULT,
    configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    today: sum((r) => r.day === today),
    week: sum((r) => r.day >= weekAgo),
    month: sum(() => true),
    models,
    byFeature: Object.values(
      rows.reduce<Record<string, { feature: string; calls: number; failures: number; costUsd: number }>>((acc, r) => {
        const row = (acc[r.feature] ||= { feature: r.feature, calls: 0, failures: 0, costUsd: 0 });
        row.calls += r.calls;
        row.failures += r.failures;
        row.costUsd = Number((row.costUsd + r.costUsd).toFixed(4));
        return acc;
      }, {}),
    ),
  });
}
