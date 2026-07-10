import { NextResponse } from 'next/server';
import { buildVehicleHistoryReport } from '@/lib/carVehicleChecks';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const report = await buildVehicleHistoryReport({
      vin: String(body?.vin || ''),
      registrationNumber: String(body?.registrationNumber || ''),
      firstRegistrationDate: String(body?.firstRegistrationDate || ''),
    });
    return NextResponse.json({ success: true, report }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się pobrać historii pojazdu.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
