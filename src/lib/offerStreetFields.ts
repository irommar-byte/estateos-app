import { extractTrailingHouseNumber } from "@/lib/mapboxGeocodeClient";

/** Rozdziela „Inżynierska 10” → ulica + numer (zgodnie z Mapbox / serwerem). */
export function splitStreetAndBuildingNumber(combined: unknown): {
  streetName: string;
  buildingNumber: string;
} {
  const raw = String(combined ?? "").trim();
  if (!raw) return { streetName: "", buildingNumber: "" };

  const buildingNumber = extractTrailingHouseNumber(raw);
  if (!buildingNumber) return { streetName: raw, buildingNumber: "" };

  const escaped = buildingNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const streetName = raw.replace(new RegExp(`\\s+${escaped}$`, "u"), "").trim();
  return { streetName: streetName || raw, buildingNumber };
}

/** Pola formularza edycji — numer z kolumny lub z końca ulicy. */
export function resolveStreetFieldsForForm(input: {
  street?: unknown;
  address?: unknown;
  buildingNumber?: unknown;
}): { streetName: string; buildingNumber: string } {
  const explicitNumber = String(input.buildingNumber ?? "").trim();
  const combined = String(input.street || input.address || "").trim();

  if (!combined) {
    return { streetName: "", buildingNumber: explicitNumber };
  }

  const split = splitStreetAndBuildingNumber(combined);
  if (explicitNumber) {
    const withoutDup =
      split.buildingNumber && split.buildingNumber === explicitNumber
        ? split.streetName
        : split.streetName;
    return { streetName: withoutDup, buildingNumber: explicitNumber };
  }

  return split;
}

/** Zapis oferty: ulica bez numeru w polu street, numer w buildingNumber. */
export function streetFieldsForOfferStorage(
  streetName: unknown,
  buildingNumber: unknown,
  isExactLocation: boolean,
): { street: string; buildingNumber: string } {
  const name = String(streetName ?? "").trim();
  const number = String(buildingNumber ?? "").trim();
  if (!isExactLocation) {
    return { street: name, buildingNumber: "" };
  }
  return { street: name, buildingNumber: number };
}
