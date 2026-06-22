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
  displayAvatarUrl?: string | null;
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

export type AgencyDashboardMember = {
  id: number;
  userId: number;
  role: string;
  status: string;
  agentTitle: string;
  profilePhotoUrl: string | null;
  user: {
    id: number;
    name: string | null;
    email: string;
    image: string | null;
    extraListings: number;
    plusExpiresAt: string | null;
    lastLoginAt: string | null;
    activeOffers: number;
    pendingOffers: number;
    soldOffers: number;
    inDealOffers: number;
    dealsInProgress: number;
    crmClients: number;
    reviewsCount: number;
    averageRating: number | null;
  };
};

export type AgencyDashboardPayload = {
  company: AgencyCompanySnapshot & { slug: string | null; ownerUserId: number };
  stats: {
    activeAgents: number;
    pendingAgents: number;
    totalOffers: number;
  };
  members: AgencyDashboardMember[];
  creditTransfers: Array<{
    id: number;
    amount: number;
    note: string | null;
    createdAt: string;
    toUser: { id: number; name: string | null; email: string };
    createdBy: { id: number; name: string | null };
  }>;
  recentOffers: Array<{
    id: number;
    title: string;
    status: string;
    price: number;
    city: string;
    updatedAt: string;
    agent: { id: number; name: string | null };
  }>;
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
