import { NextResponse } from 'next/server';
import { getNbpEurPlnRate } from '@/lib/money/nbpEurPln';
import { attachCacheHeaders } from '@/lib/httpCache';

export async function GET() {
  try {
    const fx = await getNbpEurPlnRate();
    return attachCacheHeaders(
      NextResponse.json({
        success: true,
        rate: fx.rate,
        date: fx.date,
        source: fx.source,
      }),
      3600,
      86400,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Błąd pobierania kursu NBP';
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
