import { extractVerificationMeta, type OfferVerificationStatus } from '@/lib/offerVerification';

/** Status weryfikacji prawnej (API / UI) — bez mieszania z `OfferVerificationStatus` z opisu (PENDING_REVIEW). */
export type PublicLegalCheckStatus = 'NONE' | 'PENDING' | 'REJECTED' | 'VERIFIED';

export function normalizeLegalCheckStatus(raw: unknown): PublicLegalCheckStatus {
  const v = String(raw || '').trim().toUpperCase();
  if (v === 'APPROVED' || v === 'VERIFIED') return 'VERIFIED';
  if (v === 'REJECTED') return 'REJECTED';
  if (v === 'PENDING') return 'PENDING';
  return 'NONE';
}

function markerVerificationToLegal(marker: OfferVerificationStatus): PublicLegalCheckStatus {
  if (marker === 'VERIFIED') return 'VERIFIED';
  if (marker === 'PENDING_REVIEW') return 'PENDING';
  return 'NONE';
}

type OfferLike = {
  description?: string | null;
  legalCheckStatus?: unknown;
  isLegalSafeVerified?: unknown;
};

/**
 * Ujednolicone pola weryfikacji prawnej dla payloadów ofert (WWW + mobile).
 * Priorytet: kolumny DB (gdy są w obiekcie) > marker w opisie (`ESTATEOS_VERIFY`).
 * Nie zwracamy `verificationStatus: PENDING_REVIEW` jako statusu prawnego — tylko jawne pola `legal*`.
 */
export function computePublicLegalFields(offer: OfferLike) {
  const db = normalizeLegalCheckStatus(offer.legalCheckStatus);
  const { verification } = extractVerificationMeta(offer.description);
  const fromMarker = markerVerificationToLegal(verification.status);

  const legalCheckStatus: PublicLegalCheckStatus = db !== 'NONE' ? db : fromMarker;
  const isLegalSafeVerified =
    Boolean(offer.isLegalSafeVerified) || legalCheckStatus === 'VERIFIED';

  return {
    legalCheckStatus,
    legalVerificationStatus: legalCheckStatus,
    legal_check_status: legalCheckStatus,
    isLegalSafeVerified,
    /** Stan markera w opisie (KW) — NIE mylić ze statusem moderacji oferty w aplikacji. */
    descriptionVerificationStatus: verification.status,
  };
}
