export type OfferVerificationStatus = "UNVERIFIED" | "PENDING_REVIEW" | "VERIFIED";

export type OfferVerificationMeta = {
  apartmentNumber: string;
  landRegistryNumber: string;
  status: OfferVerificationStatus;
};

const MARKER_PREFIX = "<!--ESTATEOS_VERIFY:";
const MARKER_SUFFIX = "-->";
const KW_SANITIZE_REGEX = /[^A-Za-z0-9/]/g;

function normalizeApartmentNumber(value: unknown): string {
  return String(value || "").trim().slice(0, 24);
}

function normalizeLandRegistryNumber(value: unknown): string {
  return String(value || "")
    .toUpperCase()
    .replace(KW_SANITIZE_REGEX, "")
    .trim()
    .slice(0, 40);
}

export function buildOfferVerificationMeta(input: {
  apartmentNumber?: unknown;
  landRegistryNumber?: unknown;
}): OfferVerificationMeta {
  const apartmentNumber = normalizeApartmentNumber(input.apartmentNumber);
  const landRegistryNumber = normalizeLandRegistryNumber(input.landRegistryNumber);
  const hasBoth = Boolean(apartmentNumber && landRegistryNumber);

  return {
    apartmentNumber,
    landRegistryNumber,
    status: hasBoth ? "PENDING_REVIEW" : "UNVERIFIED",
  };
}

function encode(meta: OfferVerificationMeta): string {
  return Buffer.from(JSON.stringify(meta), "utf-8").toString("base64url");
}

function decode(value: string): OfferVerificationMeta | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf-8"));
    const status = parsed?.status === "VERIFIED" ? "VERIFIED" : parsed?.status === "PENDING_REVIEW" ? "PENDING_REVIEW" : "UNVERIFIED";
    return {
      apartmentNumber: normalizeApartmentNumber(parsed?.apartmentNumber),
      landRegistryNumber: normalizeLandRegistryNumber(parsed?.landRegistryNumber),
      status,
    };
  } catch {
    return null;
  }
}

export function attachVerificationMetaToDescription(description: unknown, meta: OfferVerificationMeta): string {
  const base = String(description || "");
  const withoutMarker = stripVerificationMetaFromDescription(base);
  const payload = `${MARKER_PREFIX}${encode(meta)}${MARKER_SUFFIX}`;
  return `${withoutMarker}\n\n${payload}`.trim();
}

export function stripVerificationMetaFromDescription(description: unknown): string {
  return String(description || "")
    .replace(/<!--ESTATEOS_VERIFY:[A-Za-z0-9_-]+-->/g, "")
    .trim();
}

export function extractVerificationMeta(description: unknown): {
  cleanDescription: string;
  verification: OfferVerificationMeta;
} {
  const raw = String(description || "");
  const match = raw.match(/<!--ESTATEOS_VERIFY:([A-Za-z0-9_-]+)-->/);
  const decoded = match ? decode(match[1]) : null;
  return {
    cleanDescription: stripVerificationMetaFromDescription(raw),
    verification:
      decoded || {
        apartmentNumber: "",
        landRegistryNumber: "",
        status: "UNVERIFIED",
      },
  };
}

export function setVerificationStatusInDescription(
  description: unknown,
  status: OfferVerificationStatus,
): string {
  const { cleanDescription, verification } = extractVerificationMeta(description);
  return attachVerificationMetaToDescription(cleanDescription, {
    ...verification,
    status,
  });
}
