import { NextResponse } from 'next/server';
import { findCarById } from '@/lib/carsStorage';
import { buildVehicleHistoryReport } from '@/lib/carVehicleChecks';
import { maskVehicleHistoryReport } from '@/lib/carVehicleDocPrivacy';
import { resolveUploaderUserId } from '@/lib/upload/resolveUploader';

export async function POST(req: Request) {
  try {
    const userId = await resolveUploaderUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Musisz być zalogowany, aby sprawdzić historię pojazdu.' }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const carId = Number(body?.carId || 0);
    let vin = String(body?.vin || '');
    let registrationNumber = String(body?.registrationNumber || '');
    let firstRegistrationDate = String(body?.firstRegistrationDate || '');
    let restrictVehicleDocs = false;

    if (Number.isFinite(carId) && carId > 0) {
      const listing = await findCarById(carId);
      if (!listing) {
        return NextResponse.json({ error: 'Ogłoszenie nie istnieje.' }, { status: 404 });
      }
      vin = listing.vin;
      registrationNumber = listing.registrationNumber;
      firstRegistrationDate = listing.firstRegistrationDate;
      restrictVehicleDocs = listing.restrictVehicleDocs;
    }

    const report = await buildVehicleHistoryReport({
      vin,
      registrationNumber,
      firstRegistrationDate,
    });

    const safeReport = restrictVehicleDocs
      ? maskVehicleHistoryReport(report, { vin, registrationNumber, firstRegistrationDate })
      : report;

    return NextResponse.json({ success: true, report: safeReport }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się pobrać historii pojazdu.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
