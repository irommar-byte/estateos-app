import type { AddOfferDictionary } from "@/i18n/addOfferDictionary";
import { formatOfferLocationLine } from "@/lib/offerLocationDisplay";

export type SummaryRow = { label: string; value: string };
export type SummarySection = { title: string; rows: SummaryRow[] };

function row(label: string, value: unknown): SummaryRow | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return { label, value: text };
}

function formatLocationType(ao: AddOfferDictionary, raw: unknown): string {
  const v = String(raw || "").toLowerCase();
  if (v === "exact") return ao.sumLocExact;
  if (v === "approx" || v === "approximate") return ao.sumLocApprox;
  return String(raw || "");
}

function formatCommission(ao: AddOfferDictionary, raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!text) return ao.sumCommissionZero;
  return `${text.replace(",", ".")}%`;
}

function formatYesNo(ao: AddOfferDictionary, raw: unknown): string {
  if (raw === true) return ao.yes;
  if (raw === false) return ao.no;
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
    row(ao.sumRowTransaction, isRent ? ao.rent : ao.sell),
    row(ao.sumRowPropertyType, propertyTypeLabel || data.propertyType),
    row(ao.sumRowCondition, conditionLabel || data.condition),
    row(ao.sumRowTitle, data.title),
    row(ao.sumRowDescription, descriptionText),
  ].filter(Boolean) as SummaryRow[];

  const locationLine = formatOfferLocationLine({
    address: data.address,
    street: data.street,
    city: data.city,
    district: data.district,
  });

  const locationRows = [
    row(ao.sumRowLocation, locationLine),
    row(ao.sumRowMapVisibility, formatLocationType(ao, data.locationType)),
    row(ao.sumRowStreet, data.street || data.address),
    row(ao.sumRowCity, data.city),
    row(ao.sumRowDistrict, data.district),
    row(ao.sumRowApartment, data.apartmentNumber),
    row(ao.sumRowLandRegistry, data.landRegistryNumber),
    data.lat != null && data.lng != null
      ? row(ao.sumRowCoordinates, `${data.lat}, ${data.lng}`)
      : null,
  ].filter(Boolean) as SummaryRow[];

  const paramsRows = [
    row(ao.sumRowPrice, data.price ? `${data.price} ${data.priceCurrency || "PLN"}` : ""),
    row(ao.sumRowArea, data.area ? `${data.area} m²` : ""),
    row(ao.sumRowRooms, data.rooms),
    row(ao.sumRowFloor, data.floor),
    row(ao.sumRowBuildYear, data.buildYear),
    row(ao.sumRowPlotArea, data.plotArea ? `${data.plotArea} m²` : ""),
    row(ao.sumRowHeating, data.heating),
    row(ao.sumRowFurnished, formatYesNo(ao, data.isFurnished)),
    row(ao.sumRowCommission, formatCommission(ao, data.agentCommissionPercent)),
    row(ao.sumRowAdminFee, data.rent ? `${data.rent} PLN` : ""),
  ].filter(Boolean) as SummaryRow[];

  const rentRows = isRent
    ? ([
        row(ao.sumRowRentAdmin, data.rentAdminFee),
        row(ao.sumRowDeposit, data.deposit),
        row(ao.sumRowMinPeriod, data.rentMinPeriod),
        row(ao.sumRowAvailableFrom, data.rentAvailableFrom),
        row(ao.sumRowRentType, data.rentType),
        row(ao.sumRowPets, formatYesNo(ao, data.petsAllowed)),
      ].filter(Boolean) as SummaryRow[])
    : [];

  const amenities =
    Array.isArray(data.amenities) && data.amenities.length > 0
      ? (data.amenities as string[]).join(", ")
      : "";

  const contactRows = [
    row(
      ao.sumRowAdvertiser,
      data.advertiserType === "agency" ? ao.sumAdvertiserAgency : ao.sumAdvertiserPrivate,
    ),
    row(ao.sumRowAgencyName, data.agencyName),
    row(ao.sumRowContactName, data.contactName),
    row(ao.sumRowPhone, data.contactPhone),
    row(ao.sumRowEmail, data.email),
  ].filter(Boolean) as SummaryRow[];

  const sections: SummarySection[] = [
    { title: ao.sumSecOffer, rows: offerRows },
    { title: ao.sumSecLocation, rows: locationRows },
    { title: ao.sumSecParams, rows: paramsRows },
  ];

  if (rentRows.length > 0) {
    sections.push({ title: ao.sumSecRent, rows: rentRows });
  }

  if (amenities) {
    sections.push({
      title: ao.sumSecAmenities,
      rows: [{ label: ao.sumSelected, value: amenities }],
    });
  }

  if (contactRows.length > 0) {
    sections.push({ title: ao.sumSecContact, rows: contactRows });
  }

  return sections.filter((section) => section.rows.length > 0);
}
