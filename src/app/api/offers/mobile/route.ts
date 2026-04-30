import { NextResponse } from 'next/server';
import { createOffer } from '@/lib/services/offer.service';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const newOffer = await createOffer({
      ...data,
      status: 'PENDING',
    });

    return NextResponse.json({ success: true, offer: newOffer }, { status: 201 });
  } catch (error: any) {
    console.error('BŁĄD TWORZENIA:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
