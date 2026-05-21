import { NextResponse } from 'next/server';
import { getNbpEurPlnRate } from '@/lib/money/nbpEurPln';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const fx = await getNbpEurPlnRate();
    return NextResponse.json({
      success: true,
      rate: fx.rate,
      date: fx.date,
      source: fx.source,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Błąd pobierania kursu NBP';
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
