export type LinkedOfferSnapshot = {
  id: number;
  status?: string | null;
  officeReviewStatus?: string | null;
  title?: string | null;
  landRegistryNumber?: string | null;
  apartmentNumber?: string | null;
  isLegalSafeVerified?: boolean | null;
  legalCheckStatus?: string | null;
};

export type OfficeOfferUiStatus = 'draft' | 'review' | 'rejected' | 'active';

export function resolveOfficeOfferUiStatus(offer: LinkedOfferSnapshot | null | undefined): {
  key: OfficeOfferUiStatus;
  label: string;
} {
  if (!offer) return { key: 'draft', label: 'Szkic' };
  const status = String(offer.status || '').toUpperCase();
  const office = String(offer.officeReviewStatus || '').toUpperCase();
  if (status === 'ACTIVE' || office === 'OFFICE_APPROVED') {
    return { key: 'active', label: 'Aktywna' };
  }
  if (office === 'OFFICE_REVIEW') {
    return { key: 'review', label: 'Weryfikacja biura' };
  }
  if (office === 'OFFICE_REJECTED') {
    return { key: 'rejected', label: 'Odrzucona' };
  }
  return { key: 'draft', label: 'Szkic' };
}

export function canSubmitOfferForOfficeActivation(offer: LinkedOfferSnapshot | null | undefined): boolean {
  if (!offer) return false;
  const status = String(offer.status || '').toUpperCase();
  const office = String(offer.officeReviewStatus || '').toUpperCase();
  if (status === 'ACTIVE') return false;
  if (office === 'OFFICE_REVIEW') return false;
  if (office === 'OFFICE_APPROVED') return false;
  return true;
}

export function officeOfferStatusColor(key: OfficeOfferUiStatus, isDark: boolean): string {
  switch (key) {
    case 'active':
      return '#34C759';
    case 'review':
      return '#FF9500';
    case 'rejected':
      return '#FF3B30';
    default:
      return isDark ? '#8E8E93' : '#6C6C70';
  }
}
