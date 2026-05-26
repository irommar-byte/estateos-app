const TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'tak']);

function isTruthy(value: unknown): boolean {
  if (value === true || value === 1) return true;
  return TRUE_VALUES.has(String(value ?? '').trim().toLowerCase());
}

function upper(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

const VERIFIED_STATUSES = new Set([
  'VERIFIED',
  'SAFE',
  'APPROVED',
  'APPROVED_LEGAL',
  'LEGAL_VERIFIED',
  'LEGAL_SAFE',
  'LEGAL_CHECK_VERIFIED',
  'LAND_REGISTRY_VERIFIED',
]);

export function isOfferLegallyVerified(offer: Record<string, unknown> | null | undefined): boolean {
  if (!offer) return false;

  if (isTruthy(firstDefined(offer.isLegalSafeVerified, (offer.legalVerification as { isLegalSafeVerified?: unknown })?.isLegalSafeVerified))) {
    return true;
  }

  const legalStatus = upper(
    firstDefined(
      offer.legalCheckStatus,
      offer.legal_check_status,
      offer.legalVerificationStatus,
      (offer.legalVerification as { status?: unknown })?.status,
    ),
  );
  return VERIFIED_STATUSES.has(legalStatus);
}
