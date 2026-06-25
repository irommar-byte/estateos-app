import { NextResponse } from 'next/server';
import { estimateRadarBuyersForListing } from '@/lib/portalOnboarding';
import { verifyPortalOnboardingInvite } from '@/lib/portalOnboardingInvite';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const invite = String(body?.invite ?? '').trim();

    if (!verifyPortalOnboardingInvite(invite)) {
      return NextResponse.json({ error: 'Invalid invite.' }, { status: 403 });
    }

    const city = String(body?.city ?? '').trim();
    if (!city) {
      return NextResponse.json({ error: 'City required.' }, { status: 400 });
    }

    const estimate = await estimateRadarBuyersForListing({
      city,
      district: String(body?.district ?? '').trim(),
      price: body?.price != null ? Number(body.price) : null,
      area: body?.area != null ? Number(body.area) : null,
      rooms: body?.rooms != null ? Number(body.rooms) : null,
      transactionType: body?.transactionType === 'RENT' ? 'RENT' : 'SALE',
      propertyType: String(body?.propertyType ?? 'FLAT'),
    });

    return NextResponse.json({ ok: true, estimate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Estimate failed.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
