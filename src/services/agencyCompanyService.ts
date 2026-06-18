import { API_URL } from '../config/network';
import type { AgencyCompanyListItem, AgencyMembershipSnapshot } from '../types/agencyMembership';

export async function fetchAgencyCompanyList(): Promise<AgencyCompanyListItem[]> {
  const res = await fetch(`${API_URL}/api/agency-company/list?t=${Date.now()}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return Array.isArray(json?.companies) ? json.companies : [];
}

export async function fetchAgencyMembership(token: string): Promise<AgencyMembershipSnapshot | null> {
  const res = await fetch(`${API_URL}/api/agency-company/me?t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  const membership = json?.membership;
  if (!membership || typeof membership !== 'object') return null;
  return {
    status: String(membership.status || ''),
    role: String(membership.role || ''),
    pendingApproval: Boolean(membership.pendingApproval ?? membership.status === 'PENDING'),
    companyId: membership.companyId != null ? Number(membership.companyId) : null,
    companyName: membership.companyName != null ? String(membership.companyName) : null,
  };
}
