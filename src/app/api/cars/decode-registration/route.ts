import { NextResponse } from "next/server";
import {
  decodeAztecFromImageBuffer,
  decodeAztecPayload,
  listMissingListingFields,
  mapToCarFormPrefill,
} from "@/lib/polishRegistrationDocument";
import { getWebFormData } from "@/lib/requestFormData";

const rateByIp = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

function checkRateLimit(ip: string) {
  const now = Date.now();
  const row = rateByIp.get(ip);
  if (!row || now > row.resetAt) {
    rateByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (row.count >= MAX_PER_WINDOW) return false;
  row.count += 1;
  return true;
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Zbyt wiele prób odczytu dowodu." }, { status: 429 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let aztecPayload = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await getWebFormData(req);
      const file = (formData.get("file") || formData.get("image")) as File | null;
      if (!file || typeof file.arrayBuffer !== "function") {
        return NextResponse.json({ error: "Wybierz zdjęcie dowodu rejestracyjnego." }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      aztecPayload = await decodeAztecFromImageBuffer(buffer);
    } else {
      const body = (await req.json()) as Record<string, unknown>;
      aztecPayload = String(body?.aztecPayload || body?.payload || "").trim();
      if (!aztecPayload) {
        return NextResponse.json({ error: "Brak danych kodu Aztec." }, { status: 400 });
      }
    }

    const parsed = decodeAztecPayload(aztecPayload);
    const prefill = mapToCarFormPrefill(parsed);
    const missingFields = listMissingListingFields(prefill, false);

    return NextResponse.json({
      success: true,
      parsed,
      prefill,
      missingFields,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udało się odczytać dowodu rejestracyjnego.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
