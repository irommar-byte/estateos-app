import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { tickKeiAutoImport } from '@/lib/keiAutoImport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

/** „Uruchom cykl teraz” — z pominięciem godzin pracy, interwału i limitu dziennego (kolejka obowiązuje). */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }
  const tick = await tickKeiAutoImport({ force: true });
  const messages: Record<string, string> = {
    queued: `Cykl wystartował — ${tick.picked ?? 0} kandydatów w kolejce.`,
    disabled: 'Automatyczny import jest wyłączony — włącz go w ustawieniach.',
    job_running: 'Import już trwa — poczekaj, aż się skończy.',
    no_new_listings: 'Brak nowych ogłoszeń spełniających ustawienia.',
    no_admin: 'Zapisz najpierw ustawienia harmonogramu.',
  };
  return NextResponse.json({
    ok: tick.ran,
    tick,
    message: messages[tick.reason] || tick.reason,
  });
}
