import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import {
  getAdminAgencyClientDetail,
  permanentlyDeleteAgencyClient,
  previewAdminClientPurge,
  restoreAgencyClient,
} from '@/lib/adminAgencyClients';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Brak dostępu.' }, { status: 403 });
  const clientId = Number((await ctx.params).id);
  const client = await getAdminAgencyClientDetail(clientId);
  if (!client) return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
  return NextResponse.json({ success: true, client });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Brak dostępu.' }, { status: 403 });
  const clientId = Number((await ctx.params).id);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  if (action === 'restore') {
    const ok = await restoreAgencyClient({ clientId });
    if (!ok) return NextResponse.json({ error: 'Klient nie jest w archiwum.' }, { status: 409 });
    return NextResponse.json({ success: true });
  }

  if (action === 'purge_preview') {
    const preview = await previewAdminClientPurge(clientId);
    if (!preview) return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
    return NextResponse.json({ success: true, preview });
  }

  if (action === 'purge') {
    if (body.confirm !== `DELETE-${clientId}`) {
      return NextResponse.json(
        { error: `Potwierdź usunięcie wpisując DELETE-${clientId}.` },
        { status: 400 },
      );
    }
    try {
      const preview = await permanentlyDeleteAgencyClient(clientId);
      return NextResponse.json({ success: true, preview });
    } catch {
      return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
    }
  }

  return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
}
