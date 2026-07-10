import { NextResponse } from 'next/server';
import { checkVehicleInsurance } from '@/lib/carVehicleChecks';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const result = await checkVehicleInsurance({
      registrationNumber: String(body?.registrationNumber || ''),
      insuranceValidUntil: String(body?.insuranceValidUntil || ''),
      vin: String(body?.vin || ''),
      firstRegistrationDate: String(body?.firstRegistrationDate || ''),
      checkDate: String(body?.checkDate || ''),
    });
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się sprawdzić ubezpieczenia.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
