import { NextResponse } from 'next/server';
import { findCarById } from '@/lib/carsStorage';
import { checkVehicleInsurance } from '@/lib/carVehicleChecks';
import { maskSensitiveText } from '@/lib/carVehicleDocPrivacy';
import { resolveUploaderUserId } from '@/lib/upload/resolveUploader';

export async function POST(req: Request) {
  try {
    const userId = await resolveUploaderUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Musisz być zalogowany, aby sprawdzić ubezpieczenie OC.' }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const carId = Number(body?.carId || 0);
    let vin = String(body?.vin || '');
    let registrationNumber = String(body?.registrationNumber || '');
    let firstRegistrationDate = String(body?.firstRegistrationDate || '');
    let insuranceValidUntil = String(body?.insuranceValidUntil || '');
    let restrictVehicleDocs = false;

    if (Number.isFinite(carId) && carId > 0) {
      const listing = await findCarById(carId);
      if (!listing) {
        return NextResponse.json({ error: 'Ogłoszenie nie istnieje.' }, { status: 404 });
      }
      vin = listing.vin;
      registrationNumber = listing.registrationNumber;
      firstRegistrationDate = listing.firstRegistrationDate;
      insuranceValidUntil = listing.insuranceValidUntil || insuranceValidUntil;
      restrictVehicleDocs = listing.restrictVehicleDocs;
    }

    const result = await checkVehicleInsurance({
      registrationNumber,
      insuranceValidUntil,
      vin,
      firstRegistrationDate,
      checkDate: String(body?.checkDate || ''),
    });

    if (!restrictVehicleDocs) {
      return NextResponse.json({ success: true, ...result }, { status: 200 });
    }

    const secrets = { vin, registrationNumber, firstRegistrationDate };
    return NextResponse.json(
      {
        success: true,
        ...result,
        message: maskSensitiveText(result.message, secrets),
        policyNumber: result.policyNumber ? maskSensitiveText(result.policyNumber, secrets) : result.policyNumber,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się sprawdzić ubezpieczenia.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
