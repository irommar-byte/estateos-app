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

const PENDING_LEGAL_STATUSES = new Set([
  'PENDING',
  'PENDING_LEGAL',
  'LEGAL_PENDING',
  'LEGAL_CHECK_PENDING',
  'UNDER_REVIEW',
  'IN_REVIEW',
]);

const REJECTED_LEGAL_STATUSES = new Set([
  'REJECTED',
  'LEGAL_REJECTED',
  'LEGAL_CHECK_REJECTED',
]);

/** Kanoniczny resolver zielonego znaczka prawnego. */
export function isOfferLegallyVerified(offer: any, ownerEndpointVerified = false): boolean {
  if (ownerEndpointVerified) return true;

  if (
    isTruthy(
      firstDefined(
        offer?.isLegalSafeVerified,
        offer?.legalVerification?.isLegalSafeVerified,
      ),
    )
  ) {
    return true;
  }

  const legalStatus = upper(
    firstDefined(
      offer?.legalCheckStatus,
      offer?.legal_check_status,
      offer?.legalVerificationStatus,
      offer?.legalVerification?.status,
    ),
  );
  return VERIFIED_STATUSES.has(legalStatus);
}

export function isOfferLegalVerificationPending(offer: any): boolean {
  const legalStatus = upper(
    firstDefined(
      offer?.legalCheckStatus,
      offer?.legal_check_status,
      offer?.legalVerificationStatus,
      offer?.legalVerification?.status,
    ),
  );

  if (PENDING_LEGAL_STATUSES.has(legalStatus)) return true;
  if (REJECTED_LEGAL_STATUSES.has(legalStatus)) return false;
  if (VERIFIED_STATUSES.has(legalStatus)) return false;

  return Boolean(firstDefined(offer?.legalCheckSubmittedAt, offer?.legalVerification?.submittedAt));
}
