export type CarSortKey = "newest" | "price-asc" | "price-desc" | "year-desc" | "mileage-asc";

export const CAR_SORT_OPTIONS: Array<{ key: CarSortKey; label: string }> = [
  { key: "newest", label: "Najnowsze" },
  { key: "price-asc", label: "Cena rosnąco" },
  { key: "price-desc", label: "Cena malejąco" },
  { key: "year-desc", label: "Najnowszy rocznik" },
  { key: "mileage-asc", label: "Najmniejszy przebieg" },
];

export function formatCarPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "Cena na zapytanie";
  return `${new Intl.NumberFormat("pl-PL").format(price)} PLN`;
}

export function formatMileage(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "—";
  return `${new Intl.NumberFormat("pl-PL").format(km)} km`;
}

export function carImageSrc(imageUrl?: string | null): string {
  const trimmed = String(imageUrl || "").trim();
  if (!trimmed) {
    return "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80";
  }
  return trimmed;
}

export function sortCarListings<T extends { pricePln: number; year: number; mileageKm: number; createdAt?: string }>(
  rows: T[],
  sort: CarSortKey,
): T[] {
  const copy = [...rows];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.pricePln - b.pricePln);
    case "price-desc":
      return copy.sort((a, b) => b.pricePln - a.pricePln);
    case "year-desc":
      return copy.sort((a, b) => b.year - a.year);
    case "mileage-asc":
      return copy.sort((a, b) => a.mileageKm - b.mileageKm);
    case "newest":
    default:
      return copy.sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
  }
}

export function buildCarInquiryMessage(input: {
  carTitle: string;
  make: string;
  model: string;
  year: number;
  pricePln: number;
  city: string;
  viewingPreference: string;
  userMessage: string;
  phone?: string;
  carUrl: string;
}): string {
  const lines = [
    "Zapytanie o ogłoszenie EstateOS™Car",
    "",
    `Pojazd: ${input.carTitle}`,
    `${input.make} ${input.model} · ${input.year}`,
    `Cena: ${formatCarPrice(input.pricePln)}`,
    `Lokalizacja: ${input.city}`,
    `Link: ${input.carUrl}`,
    "",
    `Preferowany termin oględzin: ${input.viewingPreference}`,
  ];
  if (input.phone?.trim()) {
    lines.push(`Telefon kontaktowy: ${input.phone.trim()}`);
  }
  lines.push("", "Wiadomość:", input.userMessage.trim());
  return lines.join("\n");
}
