/** Kolory nadwozia — wspólna lista dla formularzy i katalogu. */
export const CAR_EXTERIOR_COLORS = [
  "Biały",
  "Czarny",
  "Srebrny",
  "Szary",
  "Grafitowy",
  "Niebieski",
  "Czerwony",
  "Zielony",
  "Brązowy",
  "Beżowy",
  "Żółty",
  "Pomarańczowy",
  "Fioletowy",
  "Inny",
] as const;

export type CarExteriorColor = (typeof CAR_EXTERIOR_COLORS)[number];

export function normalizeCarExteriorColor(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  const match = CAR_EXTERIOR_COLORS.find((c) => c.toLowerCase() === value.toLowerCase());
  return match || value.slice(0, 80);
}
