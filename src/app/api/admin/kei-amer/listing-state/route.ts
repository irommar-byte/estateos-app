import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { revokeKeiListingOutreach, setKeiListingIgnored } from '@/lib/keiAmerListingState';
import { clearKeiListingsCache } from '@/lib/keiAmerClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Ręczne decyzje o ogłoszeniu KEI:
 * - revoke_outreach: zaproszenie nie zostało wysłane → ogłoszenie wraca do puli,
 * - ignore / unignore: trwale pomijaj (np. biuro udające właściciela) albo przywróć.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const portalUrl = String(body.portalUrl || '').trim();
  const action = String(body.action || '');
  if (!/^https?:\/\//i.test(portalUrl)) {
    return NextResponse.json({ ok: false, error: 'Brak poprawnego linku ogłoszenia.' }, { status: 400 });
  }
  if (action === 'revoke_outreach') await revokeKeiListingOutreach(portalUrl);
  else if (action === 'ignore') await setKeiListingIgnored(portalUrl, true, String(body.keiId || '') || undefined);
  else if (action === 'unignore') await setKeiListingIgnored(portalUrl, false);
  else return NextResponse.json({ ok: false, error: 'Nieznana akcja.' }, { status: 400 });
  clearKeiListingsCache();
  return NextResponse.json({ ok: true });
}
