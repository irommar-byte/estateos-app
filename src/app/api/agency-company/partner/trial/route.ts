import { NextResponse } from 'next/server';
import { grantPartnerProTrial } from '@/lib/partnerStripeGrant';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function POST(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }

  try {
    const result = await grantPartnerProTrial(userId);
    if (result.alreadyUsed) {
      return NextResponse.json(
        { success: false, message: 'Okres próbny Partner Pro został już wykorzystany.' },
        { status: 409 },
      );
    }
    return NextResponse.json({
      success: true,
      message: 'Aktywowano darmowy okres próbny Partner Pro na 30 dni.',
      creditsAdded: result.creditsAdded,
      companyId: result.companyId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Nie udało się aktywować okresu próbnego.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
