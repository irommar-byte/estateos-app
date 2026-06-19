export type AgencyTeamMember = {
  id: number;
  userId: number;
  role: 'ADMIN' | 'AGENT' | string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | string;
  agentTitle: string;
  titleLabel: string;
  name: string | null;
  image: string | null;
  email?: string | null;
  isSelf: boolean;
};

export type AgencyCompanySnapshot = {
  id: number;
  name: string;
  slug?: string | null;
  address?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  officePhone?: string | null;
  officeEmail?: string | null;
  extraListings?: number;
  plusExpiresAt?: string | null;
  ownerUserId?: number;
};

export type AgencyMembershipSnapshot = {
  id?: number;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | string;
  role: 'ADMIN' | 'AGENT' | string;
  agentTitle?: string;
  titleLabel?: string;
  pendingApproval: boolean;
  companyId?: number | null;
  companyName?: string | null;
  company?: AgencyCompanySnapshot | null;
  team?: AgencyTeamMember[];
  stats?: {
    activeMembers: number;
    pendingMembers: number;
  };
};

export type AgencyCompanyListItem = {
  id: number;
  name: string;
  slug?: string | null;
  city?: string | null;
  activeAgents?: number;
};

export const AGENCY_TITLE_OPTIONS = [
  'DORADCA',
  'AGENT',
  'BROKER',
  'EXPERT',
  'LEADER',
  'KIEROWNIK_BIURO',
  'ZASTEPCA_KIEROWNIKA',
] as const;
