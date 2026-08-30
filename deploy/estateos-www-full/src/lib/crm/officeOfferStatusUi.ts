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

export function officeOfferStatusChipClass(key: OfficeOfferUiStatus): string {
  switch (key) {
    case 'active':
      return 'bg-emerald-500/15 text-emerald-700';
    case 'review':
      return 'bg-amber-500/15 text-amber-700';
    case 'rejected':
      return 'bg-red-500/15 text-red-600';
    default:
      return 'bg-slate-500/15 text-slate-600';
  }
}
