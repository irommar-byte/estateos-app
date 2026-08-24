import { COMMISSION_RATE_DEFAULT, snapCommissionRate } from "@/lib/leadTransferShared";

export function publicAssetUrl(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://estateos.pl"
  ).replace(/\/+$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

export type AcquisitionStatus =
  | "PREPARATION"
  | "IN_MEETING"
  | "TERMS_READY"
  | "SIGNED"
  | "CANCELLED";

export type AcquisitionFormData = {
  meeting: {
    startsAt: string;
    location: string;
    clientGoal: string;
    reasonForSale: string;
    targetTimeline: string;
  };
  ownership: {
    owners: string;
    ownershipBasis: string;
    landRegisterNumber: string;
    maritalStatus: string;
    mortgage: string;
    encumbrances: string;
    occupancy: string;
    legalNotes: string;
  };
  property: {
    address: string;
    city: string;
    district: string;
    lat: string;
    lng: string;
    propertyType: string;
    apartmentNumber: string;
    area: string;
    rooms: string;
    floor: string;
    totalFloors: string;
    yearBuilt: string;
    condition: string;
    monthlyFees: string;
    utilities: string;
    parking: string;
    storage: string;
    amenities: string;
    furnishing: string;
    advantages: string;
    defects: string;
    planImages: string;
    roomsJson: string;
    wholeScanJson: string;
  };
  strategy: {
    expectedPrice: string;
    minimumPrice: string;
    recommendedPrice: string;
    presentationRules: string;
    keysHandover: boolean;
    photoConsent: boolean;
    marketingConsent: boolean;
    portalConsent: boolean;
    socialMediaConsent: boolean;
  };
  cooperation: {
    agreementType: "EXCLUSIVE" | "OPEN";
    durationMonths: string;
    noticeDays: string;
    commissionType: "PERCENT" | "FIXED";
    commissionValue: string;
    commissionVatIncluded: boolean;
    commissionDue: string;
    additionalCosts: string;
    agentObligations: string;
    clientObligations: string;
  };
  documents: Record<string, boolean>;
  notes: string;
  paperContracts: Array<{
    url: string;
    name: string;
    uploadedAt: string;
  }>;
};

export type AcquisitionRecord = {
  id: number;
  clientId: number;
  status: AcquisitionStatus;
  currentStep: number;
  formData: AcquisitionFormData;
  agreementSnapshot: string | null;
  clientAcknowledgedAt: string | null;
  clientAcknowledgementName: string | null;
  signedAt: string | null;
  signerName: string | null;
  signerEmail: string | null;
  documentHash: string | null;
  copyEmailSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ACQUISITION_DOCUMENTS = [
  { id: "identity", label: "Dowód tożsamości właściciela / właścicieli" },
  { id: "ownership", label: "Dokument potwierdzający własność lub podstawę nabycia" },
  { id: "landRegister", label: "Numer księgi wieczystej lub wydruk KW" },
  { id: "floorPlan", label: "Rzut lokalu / dokumentacja techniczna" },
  { id: "fees", label: "Ostatni wymiar opłat administracyjnych" },
  { id: "utilities", label: "Rachunki lub informacje o kosztach mediów" },
  { id: "mortgage", label: "Zaświadczenie banku o saldzie kredytu (jeśli dotyczy)" },
  { id: "certificate", label: "Świadectwo charakterystyki energetycznej" },
  { id: "tax", label: "Dokumenty podatkowe istotne dla transakcji" },
  { id: "equipment", label: "Lista wyposażenia pozostającego w nieruchomości" },
  { id: "parkingDocs", label: "Dokumenty garażu / miejsca postojowego / komórki lokatorskiej" },
] as const;

export const ACQUISITION_STEPS = [
  { id: 1, title: "Spotkanie", subtitle: "Cel i horyzont sprzedaży — kartę wypełniasz na miejscu" },
  { id: 2, title: "Stan prawny", subtitle: "Własność, obciążenia i dokumenty" },
  { id: 3, title: "Nieruchomość", subtitle: "Parametry, stan i wyposażenie" },
  { id: 4, title: "Strategia", subtitle: "Cena, marketing i prezentacje" },
  { id: 5, title: "Współpraca", subtitle: "Zakres, prowizja i obowiązki" },
  { id: 6, title: "Podpis", subtitle: "Potwierdź wzór, zbierz podpis i wyślij kopię" },
  { id: 7, title: "Oferta pozyskana", subtitle: "Umowa zamknięta — od tej pory tylko podgląd" },
] as const;

export function isAcquisitionLocked(
  record?: { status?: string | null; signedAt?: string | Date | null } | null,
): boolean {
  return record?.status === "SIGNED" || Boolean(record?.signedAt);
}

export function clampAcquisitionStep(raw: unknown, locked = false): number {
  const n = Math.round(Number(raw) || 1);
  if (locked) return 7;
  return Math.min(6, Math.max(1, n));
}

export function createDefaultAcquisitionForm(
  client?: {
    firstName?: string | null;
    lastName?: string | null;
    sellerCity?: string | null;
    sellerDistrict?: string | null;
    sellerPrice?: number | null;
    sellerArea?: number | null;
    sellerRooms?: number | null;
    sellerDescription?: string | null;
  } | null,
): AcquisitionFormData {
  const address = [client?.sellerCity, client?.sellerDistrict].filter(Boolean).join(", ");
  return {
    meeting: {
      startsAt: "",
      location: address,
      clientGoal: "Sprzedaż nieruchomości",
      reasonForSale: "",
      targetTimeline: "",
    },
    ownership: {
      owners: [client?.firstName, client?.lastName].filter(Boolean).join(" "),
      ownershipBasis: "",
      landRegisterNumber: "",
      maritalStatus: "",
      mortgage: "",
      encumbrances: "",
      occupancy: "",
      legalNotes: "",
    },
    property: {
      address,
      city: client?.sellerCity || "",
      district: client?.sellerDistrict || "",
      lat: "",
      lng: "",
      propertyType: "Mieszkanie",
      apartmentNumber: "",
      area: client?.sellerArea ? String(client.sellerArea) : "",
      rooms: client?.sellerRooms ? String(client.sellerRooms) : "",
      floor: "",
      totalFloors: "",
      yearBuilt: "",
      condition: "",
      monthlyFees: "",
      utilities: "",
      parking: "",
      storage: "",
      amenities: "",
      furnishing: "",
      advantages: client?.sellerDescription || "",
      defects: "",
      planImages: "",
      roomsJson: "",
      wholeScanJson: "",
    },
    strategy: {
      expectedPrice: client?.sellerPrice ? String(client.sellerPrice) : "",
      minimumPrice: "",
      recommendedPrice: "",
      presentationRules: "",
      keysHandover: false,
      photoConsent: true,
      marketingConsent: true,
      portalConsent: true,
      socialMediaConsent: false,
    },
    cooperation: {
      agreementType: "EXCLUSIVE",
      durationMonths: "6",
      noticeDays: "30",
      commissionType: "PERCENT",
      commissionValue: COMMISSION_RATE_DEFAULT.toFixed(1),
      commissionVatIncluded: true,
      commissionDue: "W dniu zawarcia umowy sprzedaży",
      additionalCosts: "Brak dodatkowych kosztów bez uprzedniej zgody klienta.",
      agentObligations:
        "Weryfikacja dokumentów, przygotowanie oferty, sesja zdjęciowa, publikacja, obsługa zapytań, prezentacje, raportowanie, negocjacje i wsparcie do zawarcia umowy sprzedaży.",
      clientObligations:
        "Przekazanie prawdziwych i kompletnych informacji, udostępnienie dokumentów, umożliwienie prezentacji oraz informowanie o bezpośrednich zapytaniach dotyczących nieruchomości.",
    },
    documents: Object.fromEntries(ACQUISITION_DOCUMENTS.map((item) => [item.id, false])),
    notes: "",
    paperContracts: [],
  };
}

export function persistCommissionPercent(raw: unknown): string {
  const trimmed = String(raw ?? "").trim().replace("%", "").replace(",", ".");
  if (!trimmed || trimmed === "—" || trimmed === "-") {
    return COMMISSION_RATE_DEFAULT.toFixed(1);
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return COMMISSION_RATE_DEFAULT.toFixed(1);
  return snapCommissionRate(n).toFixed(1);
}

export function formatCommissionPercentLabel(raw: unknown): string {
  return persistCommissionPercent(raw).replace(".", ",");
}

export function isOpenEndedCooperation(
  cooperation: Pick<AcquisitionFormData["cooperation"], "agreementType" | "durationMonths">,
): boolean {
  if (cooperation.agreementType === "OPEN") return true;
  const months = Number(String(cooperation.durationMonths || "").replace(",", "."));
  return Number.isFinite(months) && months <= 0;
}

export function formatCooperationDuration(
  cooperation: Pick<AcquisitionFormData["cooperation"], "agreementType" | "durationMonths">,
): string {
  if (isOpenEndedCooperation(cooperation)) return "czas nieokreślony";
  const months = String(cooperation.durationMonths || "").trim();
  return months ? `${months} miesięcy` : "czas nieokreślony";
}

export function applyAgreementType(
  cooperation: AcquisitionFormData["cooperation"],
  agreementType: "EXCLUSIVE" | "OPEN",
): AcquisitionFormData["cooperation"] {
  if (agreementType === "OPEN") {
    return { ...cooperation, agreementType: "OPEN", durationMonths: "0" };
  }
  const months = Number(String(cooperation.durationMonths || "").replace(",", "."));
  return {
    ...cooperation,
    agreementType: "EXCLUSIVE",
    durationMonths: Number.isFinite(months) && months > 0 ? String(Math.round(months)) : "6",
  };
}

function normalizeCooperation(
  incoming: Partial<AcquisitionFormData["cooperation"]> | undefined,
  fallback: AcquisitionFormData["cooperation"],
): AcquisitionFormData["cooperation"] {
  const cooperation = { ...fallback, ...(incoming || {}) };
  const typed = applyAgreementType(
    cooperation,
    cooperation.agreementType === "OPEN" ? "OPEN" : "EXCLUSIVE",
  );
  if (typed.commissionType !== "FIXED") {
    typed.commissionType = "PERCENT";
    typed.commissionValue = persistCommissionPercent(typed.commissionValue);
  }
  return typed;
}

export function normalizeAcquisitionForm(
  raw: unknown,
  fallback: AcquisitionFormData,
): AcquisitionFormData {
  const incoming = raw && typeof raw === "object" ? (raw as Partial<AcquisitionFormData>) : {};
  return {
    ...fallback,
    ...incoming,
    meeting: { ...fallback.meeting, ...(incoming.meeting || {}) },
    ownership: { ...fallback.ownership, ...(incoming.ownership || {}) },
    property: { ...fallback.property, ...(incoming.property || {}) },
    strategy: { ...fallback.strategy, ...(incoming.strategy || {}) },
    cooperation: normalizeCooperation(incoming.cooperation, fallback.cooperation),
    documents: { ...fallback.documents, ...(incoming.documents || {}) },
    paperContracts: Array.isArray(incoming.paperContracts) ? incoming.paperContracts : fallback.paperContracts || [],
    notes: incoming.notes ?? fallback.notes,
  };
}

function line(label: string, value: unknown): string {
  const text = String(value ?? "").trim();
  return `${label}: ${text || "—"}`;
}

export function buildAcquisitionAgreementText(params: {
  reference: string;
  createdAt: string;
  agencyName: string;
  agentName: string;
  agentEmail?: string | null;
  agentPhone?: string | null;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientPesel?: string | null;
  form: AcquisitionFormData;
}): string {
  const { form } = params;
  const commission =
    form.cooperation.commissionType === "PERCENT"
      ? `${formatCommissionPercentLabel(form.cooperation.commissionValue)}% ${form.cooperation.commissionVatIncluded ? "brutto" : "netto + VAT"}`
      : `${form.cooperation.commissionValue || "—"} PLN ${form.cooperation.commissionVatIncluded ? "brutto" : "netto + VAT"}`;

  return [
    "UMOWA POŚREDNICTWA I KARTA POZYSKANIA NIERUCHOMOŚCI",
    `Numer referencyjny: ${params.reference}`,
    `Data przygotowania: ${params.createdAt}`,
    "",
    "1. STRONY",
    line("Pośrednik / firma", params.agencyName),
    line("Agent prowadzący", params.agentName),
    line("Kontakt agenta", [params.agentEmail, params.agentPhone].filter(Boolean).join(" · ")),
    line("Klient", params.clientName),
    line("PESEL", params.clientPesel),
    line("Kontakt klienta", [params.clientEmail, params.clientPhone].filter(Boolean).join(" · ")),
    "",
    "2. NIERUCHOMOŚĆ I OŚWIADCZENIA KLIENTA",
    line("Adres", form.property.address),
    line("Miasto", form.property.city),
    line("Dzielnica", form.property.district),
    line("Rodzaj", form.property.propertyType),
    line("Numer mieszkania (CRM)", form.property.apartmentNumber),
    line("Powierzchnia", form.property.area ? `${form.property.area} m²` : ""),
    line("Liczba pokoi", form.property.rooms),
    line("Przyległości", form.property.amenities),
    line("Garaż / parking", form.property.parking),
    line("Komórka / piwnica", form.property.storage),
    line("Właściciel / właściciele", form.ownership.owners),
    line("Podstawa własności", form.ownership.ownershipBasis),
    line("Księga wieczysta", form.ownership.landRegisterNumber),
    line("Hipoteka", form.ownership.mortgage),
    line("Obciążenia i prawa osób trzecich", form.ownership.encumbrances),
    line("Stan zajęcia lokalu", form.ownership.occupancy),
    "",
    "3. CEL I STRATEGIA SPRZEDAŻY",
    line("Cel klienta", form.meeting.clientGoal),
    line("Planowany termin", form.meeting.targetTimeline),
    line("Cena oczekiwana", form.strategy.expectedPrice ? `${form.strategy.expectedPrice} PLN` : ""),
    line("Cena rekomendowana", form.strategy.recommendedPrice ? `${form.strategy.recommendedPrice} PLN` : ""),
    line("Cena minimalna do rozmów", form.strategy.minimumPrice ? `${form.strategy.minimumPrice} PLN` : ""),
    line("Zasady prezentacji", form.strategy.presentationRules),
    "",
    "4. WARUNKI WSPÓŁPRACY",
    line("Rodzaj umowy", form.cooperation.agreementType === "EXCLUSIVE" ? "Na wyłączność" : "Otwarta"),
    line("Okres", formatCooperationDuration(form.cooperation)),
    line("Wypowiedzenie", `${form.cooperation.noticeDays || "—"} dni`),
    line("Wynagrodzenie pośrednika", commission),
    line("Termin płatności wynagrodzenia", form.cooperation.commissionDue),
    line("Dodatkowe koszty", form.cooperation.additionalCosts),
    "",
    "5. OBOWIĄZKI POŚREDNIKA",
    form.cooperation.agentObligations || "—",
    "",
    "6. OBOWIĄZKI KLIENTA",
    form.cooperation.clientObligations || "—",
    "",
    "7. ZGODY OPERACYJNE",
    line("Sesja zdjęciowa", form.strategy.photoConsent ? "TAK" : "NIE"),
    line("Publikacja i marketing", form.strategy.marketingConsent ? "TAK" : "NIE"),
    line("Portale ogłoszeniowe", form.strategy.portalConsent ? "TAK" : "NIE"),
    line("Media społecznościowe", form.strategy.socialMediaConsent ? "TAK" : "NIE"),
    line("Przekazanie kluczy", form.strategy.keysHandover ? "TAK" : "NIE"),
    "",
    "8. ZAŁĄCZNIKI",
    form.paperContracts?.length
      ? form.paperContracts.map((file) => `- ${file.name} (${publicAssetUrl(file.url)})`).join("\n")
      : "Brak skanu podpisanej ręcznie umowy.",
    "",
    "9. POTWIERDZENIE",
    "Klient potwierdza prawdziwość przekazanych danych, zapoznanie się z zakresem działań, warunkami wynagrodzenia i zasadami współpracy. Zmiany wymagają utrwalenia przez strony.",
    "",
    "UWAGA FORMALNA",
    "Podpis odręczny złożony na ekranie jest prostym podpisem elektronicznym i tworzy ślad audytowy dokumentu. Nie jest kwalifikowanym podpisem elektronicznym. Firma powinna stosować zatwierdzony przez prawnika wzór umowy i sposób podpisu odpowiedni do wymaganej prawem formy.",
  ].join("\n");
}
