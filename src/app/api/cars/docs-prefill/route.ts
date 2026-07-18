import { NextResponse } from "next/server";
import { buildCarFormPrefillFromDocs } from "@/lib/carVehicleChecks";
import { listMissingListingFields } from "@/lib/polishRegistrationDocument.shared";
import { resolveUploaderUserId } from "@/lib/upload/resolveUploader";

export async function POST(req: Request) {
  try {
    const userId = await resolveUploaderUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Musisz być zalogowany, aby uzupełnić formularz z CEPIK." },
        { status: 401 },
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const vin = String(body?.vin || "").trim();
    const registrationNumber = String(body?.registrationNumber || "").trim();
    const firstRegistrationDate = String(body?.firstRegistrationDate || "").trim();

    if (!vin || !registrationNumber || !firstRegistrationDate) {
      return NextResponse.json(
        { error: "Podaj VIN, numer rejestracyjny i datę pierwszej rejestracji." },
        { status: 400 },
      );
    }

    const { prefill, report } = await buildCarFormPrefillFromDocs({
      vin,
      registrationNumber,
      firstRegistrationDate,
    });

    if (!prefill.make && !prefill.model) {
      return NextResponse.json(
        { error: "CEPIK nie zwrócił marki/modelu dla tych danych." },
        { status: 404 },
      );
    }

    const missingFields = listMissingListingFields(prefill, false);
    return NextResponse.json({ success: true, prefill, missingFields, report }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się uzupełnić formularza z VIN.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
