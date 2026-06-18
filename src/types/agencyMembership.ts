export type AgencyMembershipSnapshot = {
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | string;
  role: 'ADMIN' | 'AGENT' | string;
  pendingApproval: boolean;
  companyId?: number | null;
  companyName?: string | null;
};

export type AgencyCompanyListItem = {
  id: number;
  name: string;
  slug?: string | null;
  city?: string | null;
};
