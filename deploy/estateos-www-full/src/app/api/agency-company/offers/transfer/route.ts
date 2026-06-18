import { NextResponse } from 'next/server';
import { transferMemberOffers, requireActiveAgencyAdmin } from '@/lib/agencyCompany';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function POST(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const fromUserId = Number(body.fromUserId);
  const toUserId = Number(body.toUserId);
  const offerIds = Array.isArray(body.offerIds)
    ? body.offerIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
    : [];

  if (!Number.isFinite(fromUserId) || !Number.isFinite(toUserId)) {
    return NextResponse.json({ success: false, message: 'Wybierz agentów źródłowego i docelowego.' }, { status: 400 });
  }

  try {
    const admin = await requireActiveAgencyAdmin(userId);
    if (!admin) {
      return NextResponse.json({ success: false, message: 'Brak uprawnień.' }, { status: 403 });
    }

    const result = await transferMemberOffers({
      companyId: admin.companyId,
      adminUserId: userId,
      fromUserId,
      toUserId,
      offerIds,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Operacja nie powiodła się.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
