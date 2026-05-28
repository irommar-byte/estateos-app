import type { AddOfferDictionary } from "@/i18n/addOfferDictionary";
import { formatOfferLocationLine } from "@/lib/offerLocationDisplay";

export type SummaryRow = { label: string; value: string };
export type SummarySection = { title: string; rows: SummaryRow[] };

function row(label: string, value: unknown): SummaryRow | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return { label, value: text };
}

function formatLocationType(raw: unknown): string {
  const v = String(raw || "").toLowerCase();
  if (v === "exact") return "Dokładna — ulica i numer";
  if (v === "approx" || v === "approximate") return "Przybliżona — tylko obszar dzielnicy";
  return String(raw || "");
}

function formatCommission(raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!text) return "Bez prowizji (0%)";
  return `${text.replace(",", ".")}%`;
}

function formatYesNo(raw: unknown): string {
  if (raw === true) return "Tak";
  if (raw === false) return "Nie";
  return "";
}

export function buildAddOfferSummarySections(input: {
  ao: AddOfferDictionary;
  data: Record<string, unknown>;
  descriptionText: string;
  propertyTypeLabel?: string;
  conditionLabel?: string;
}): SummarySection[] {
  const { ao, data, descriptionText, propertyTypeLabel, conditionLabel } = input;
  const isRent = data.transactionType === "RENT";

  const offerRows = [
    row("Rodzaj transakcji", isRent ? ao.rent : ao.sell),
    row("Typ nieruchomości", propertyTypeLabel || data.propertyType),
    row("Stan wykończenia", conditionLabel || data.condition),
    row("Tytuł ogłoszenia", data.title),
    row("Opis", descriptionText),
  ].filter(Boolean) as SummaryRow[];

  const locationLine = formatOfferLocationLine({
    address: data.address,
    street: data.street,
    city: data.city,
    district: data.district,
  });

  const locationRows = [
    row("Lokalizacja", locationLine),
    row("Widoczność na mapie", formatLocationType(data.locationType)),
    row("Ulica i numer", data.street || data.address),
    row("Miasto", data.city),
    row("Dzielnica", data.district),
    row("Nr mieszkania", data.apartmentNumber),
    row("Księga wieczysta (KW)", data.landRegistryNumber),
    data.lat != null && data.lng != null
      ? row("Współrzędne", `${data.lat}, ${data.lng}`)
      : null,
  ].filter(Boolean) as SummaryRow[];

  const paramsRows = [
    row("Cena", data.price ? `${data.price} ${data.priceCurrency || "PLN"}` : ""),
    row("Metraż", data.area ? `${data.area} m²` : ""),
    row("Liczba pokoi", data.rooms),
    row("Piętro", data.floor),
    row("Rok budowy", data.buildYear),
    row("Powierzchnia działki", data.plotArea ? `${data.plotArea} m²` : ""),
    row("Ogrzewanie", data.heating),
    row("Umeblowanie", formatYesNo(data.isFurnished)),
    row("Prowizja agenta", formatCommission(data.agentCommissionPercent)),
    row("Czynsz administracyjny", data.rent ? `${data.rent} PLN` : ""),
  ].filter(Boolean) as SummaryRow[];

  const rentRows = isRent
    ? ([
        row("Opłaty dodatkowe (admin)", data.rentAdminFee),
        row("Kaucja", data.deposit),
        row("Minimalny okres najmu", data.rentMinPeriod),
        row("Dostępne od", data.rentAvailableFrom),
        row("Rodzaj najmu", data.rentType),
        row("Zwierzęta", formatYesNo(data.petsAllowed)),
      ].filter(Boolean) as SummaryRow[])
    : [];

  const amenities =
    Array.isArray(data.amenities) && data.amenities.length > 0
      ? (data.amenities as string[]).join(", ")
      : "";

  const contactRows = [
    row("Rodzaj ogłoszeniodawcy", data.advertiserType === "agency" ? "Agencja / biuro" : "Osoba prywatna"),
    row("Nazwa agencji", data.agencyName),
    row("Osoba kontaktowa", data.contactName),
    row("Telefon", data.contactPhone),
    row("E-mail", data.email),
  ].filter(Boolean) as SummaryRow[];

  const sections: SummarySection[] = [
    { title: "Oferta", rows: offerRows },
    { title: "Lokalizacja", rows: locationRows },
    { title: "Parametry i finanse", rows: paramsRows },
  ];

  if (rentRows.length > 0) {
    sections.push({ title: "Warunki najmu", rows: rentRows });
  }

  if (amenities) {
    sections.push({
      title: "Udogodnienia",
      rows: [{ label: "Wybrane", value: amenities }],
    });
  }

  if (contactRows.length > 0) {
    sections.push({ title: "Kontakt", rows: contactRows });
  }

  return sections.filter((section) => section.rows.length > 0);
}
