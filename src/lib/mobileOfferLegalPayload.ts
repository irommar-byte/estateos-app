import type { OfferVerificationStatus } from '@/lib/offerVerification';
import { setVerificationStatusInDescription } from '@/lib/offerVerification';
import { computePublicLegalFields } from '@/lib/offerLegalPublicShape';

export function normalizeLegalStatus(raw: unknown): 'NONE' | 'PENDING' | 'REJECTED' | 'VERIFIED' {
  const value = String(raw || '').trim().toUpperCase();
  if (value === 'VERIFIED') return 'VERIFIED';
  if (value === 'APPROVED') return 'VERIFIED';
  if (value === 'REJECTED') return 'REJECTED';
  if (value === 'PENDING') return 'PENDING';
  return 'NONE';
}

function legalDbToDescriptionVerificationStatus(db: 'NONE' | 'PENDING' | 'REJECTED' | 'VERIFIED'): OfferVerificationStatus {
  if (db === 'VERIFIED') return 'VERIFIED';
  if (db === 'PENDING') return 'PENDING_REVIEW';
  return 'UNVERIFIED';
}

/** Spójny payload dla mobile: DB + marker w opisie; pola prawne tylko jako legal* / isLegalSafeVerified (bez verificationStatus jako prawnego). */
export function enrichOfferWithLegalAliases(offer: Record<string, unknown>) {
  const legal = computePublicLegalFields({
    description: offer?.description as string | null | undefined,
    legalCheckStatus: offer?.legalCheckStatus,
    isLegalSafeVerified: offer?.isLegalSafeVerified,
  });
  const descStatus = legalDbToDescriptionVerificationStatus(legal.legalCheckStatus);
  const description = setVerificationStatusInDescription(offer?.description, descStatus);

  return {
    ...offer,
    description,
    legalCheckStatus: legal.legalCheckStatus,
    legal_check_status: legal.legal_check_status,
    legalVerificationStatus: legal.legalVerificationStatus,
    isLegalSafeVerified: legal.isLegalSafeVerified,
    descriptionVerificationStatus: legal.descriptionVerificationStatus,
    legalVerification: {
      ...((offer?.legalVerification as Record<string, unknown>) || {}),
      status: legal.legalCheckStatus,
    },
  };
}
