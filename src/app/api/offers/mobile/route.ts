import { NextResponse } from 'next/server';
import { createOffer } from '@/lib/services/offer.service';
import {
  getOfferSchemaCompatibilityMessage,
  isOfferSchemaCompatibilityError,
} from '@/lib/offerSchemaErrors';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const newOffer = await createOffer({
      ...data,
      status: 'PENDING',
    });

    return NextResponse.json({ success: true, offer: newOffer }, { status: 201 });
  } catch (error: unknown) {
    if (isOfferSchemaCompatibilityError(error)) {
      return NextResponse.json(
        { success: false, error: getOfferSchemaCompatibilityMessage(), code: 'OFFER_SCHEMA_COMPATIBILITY' },
        { status: 503 }
      );
    }
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    console.error('BŁĄD TWORZENIA:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
