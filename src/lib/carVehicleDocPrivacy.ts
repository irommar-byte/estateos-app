import type { CarListingRecord } from "@/lib/carsStorage";
import type { VehicleHistoryReport } from "@/lib/carVehicleChecks";

export const VEHICLE_DOC_VISIBLE_CHARS = 2;

export function maskRestrictedVehicleValue(value: string, visibleChars = VEHICLE_DOC_VISIBLE_CHARS): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length <= visibleChars) return raw;
  return raw.slice(0, visibleChars) + "*".repeat(raw.length - visibleChars);
}

function secretVariants(value: string): string[] {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const variants = new Set<string>([raw]);
  const compact = raw.replace(/\s+/g, "");
  if (compact) variants.add(compact);
  const spacedPlate = raw.replace(/([A-Z])(\d)/g, "$1 $2").replace(/(\d)([A-Z])/g, "$1 $2");
  if (spacedPlate) variants.add(spacedPlate);
  return [...variants].filter((item) => item.length > VEHICLE_DOC_VISIBLE_CHARS);
}

export function maskSensitiveText(
  text: string,
  secrets: { vin?: string; registrationNumber?: string; firstRegistrationDate?: string },
): string {
  let result = String(text || "");
  const allSecrets = [
    ...secretVariants(secrets.vin || ""),
    ...secretVariants(secrets.registrationNumber || ""),
    ...secretVariants(secrets.firstRegistrationDate || ""),
  ];
  for (const secret of allSecrets) {
    const masked = maskRestrictedVehicleValue(secret);
    if (result.includes(secret)) {
      result = result.split(secret).join(masked);
    }
  }
  return result;
}

const SENSITIVE_ROW_LABELS = /vin|numer rejestr|rejestrac|tablic|pierwsz(a|ej) rejestrac/i;

export function maskVehicleHistoryReport(
  report: VehicleHistoryReport,
  secrets: { vin?: string; registrationNumber?: string; firstRegistrationDate?: string },
): VehicleHistoryReport {
  return {
    ...report,
    vin: maskRestrictedVehicleValue(secrets.vin || report.vin),
    registrationNumber: maskRestrictedVehicleValue(secrets.registrationNumber || report.registrationNumber),
    firstRegistrationDate: maskRestrictedVehicleValue(
      secrets.firstRegistrationDate || report.firstRegistrationDate,
    ),
    summary: maskSensitiveText(report.summary, secrets),
    sections: report.sections.map((section) => ({
      ...section,
      rows: section.rows.map((row) => ({
        ...row,
        value: SENSITIVE_ROW_LABELS.test(row.label)
          ? maskRestrictedVehicleValue(row.value)
          : maskSensitiveText(row.value, secrets),
      })),
    })),
  };
}

export function shouldMaskCarVehicleDocs(
  listing: Pick<CarListingRecord, "restrictVehicleDocs">,
): boolean {
  return Boolean(listing.restrictVehicleDocs);
}

export function maskCarListingVehicleDocs<T extends Pick<CarListingRecord, "vin" | "registrationNumber" | "firstRegistrationDate">>(
  listing: T,
): T {
  return {
    ...listing,
    vin: maskRestrictedVehicleValue(listing.vin),
    registrationNumber: maskRestrictedVehicleValue(listing.registrationNumber),
    firstRegistrationDate: maskRestrictedVehicleValue(listing.firstRegistrationDate),
  };
}

export function sanitizeCarListingForViewer<T extends CarListingRecord>(
  listing: T,
  viewerUserId?: number | null,
): T {
  if (!shouldMaskCarVehicleDocs(listing)) return listing;
  if (
    viewerUserId != null &&
    listing.userId != null &&
    Number(viewerUserId) === Number(listing.userId)
  ) {
    return listing;
  }
  return maskCarListingVehicleDocs(listing);
}
