import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { approveOutbox, cancelOutbox, getOutboxItem, listPendingOutbox } from '@/lib/crm/clientOutbox';

export const dynamic = 'force-dynamic';

/** Kolejka „Do wysłania”: lista albo jedna wiadomość z pełnym podglądem. */
export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (Number.isFinite(id) && id > 0) {
    const item = await getOutboxItem(agencyUserId, id);
    if (!item) return NextResponse.json({ error: 'Nie znaleziono wiadomości.' }, { status: 404 });
    return NextResponse.json({ success: true, item });
  }
  const items = await listPendingOutbox(agencyUserId);
  return NextResponse.json({ success: true, items });
}

/** Wyślij (opcjonalnie: „od teraz automatycznie”) albo anuluj. */
export async function POST(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Brak wiadomości.' }, { status: 400 });
  }
  const action = String(body.action || '');
  if (action === 'approve') {
    const result = await approveOutbox({ agencyUserId, id, autoFromNow: body.autoFromNow === true });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ success: true, ...result });
  }
  if (action === 'cancel') {
    const result = await cancelOutbox({ agencyUserId, id });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
}
