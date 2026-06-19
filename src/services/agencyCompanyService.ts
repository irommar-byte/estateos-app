import { API_URL } from '../config/network';
import type { AgencyCompanyListItem, AgencyMembershipSnapshot } from '../types/agencyMembership';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' };
}

export async function fetchAgencyCompanyList(): Promise<AgencyCompanyListItem[]> {
  const res = await fetch(`${API_URL}/api/agency-company/list?t=${Date.now()}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return Array.isArray(json?.companies) ? json.companies : [];
}

function mapMembership(raw: Record<string, unknown>): AgencyMembershipSnapshot {
  const company =
    raw.company && typeof raw.company === 'object'
      ? (raw.company as AgencyMembershipSnapshot['company'])
      : null;
  const team = Array.isArray(raw.team) ? raw.team : [];
  const stats =
    raw.stats && typeof raw.stats === 'object'
      ? (raw.stats as AgencyMembershipSnapshot['stats'])
      : undefined;

  return {
    id: raw.id != null ? Number(raw.id) : undefined,
    status: String(raw.status || ''),
    role: String(raw.role || ''),
    agentTitle: raw.agentTitle != null ? String(raw.agentTitle) : undefined,
    titleLabel: raw.titleLabel != null ? String(raw.titleLabel) : undefined,
    pendingApproval: Boolean(raw.pendingApproval ?? raw.status === 'PENDING'),
    companyId:
      raw.companyId != null
        ? Number(raw.companyId)
        : company?.id != null
          ? Number(company.id)
          : null,
    companyName:
      raw.companyName != null
        ? String(raw.companyName)
        : company?.name != null
          ? String(company.name)
          : null,
    company,
    team: team as AgencyMembershipSnapshot['team'],
    stats,
  };
}

export async function fetchAgencyMembership(token: string): Promise<AgencyMembershipSnapshot | null> {
  const res = await fetch(`${API_URL}/api/agency-company/me?t=${Date.now()}`, {
    headers: authHeaders(token),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  const membership = json?.membership;
  if (!membership || typeof membership !== 'object') return null;
  return mapMembership(membership as Record<string, unknown>);
}

export async function patchAgencyMember(
  token: string,
  memberId: number,
  body: { status?: 'ACTIVE' | 'REJECTED' | 'SUSPENDED'; agentTitle?: string },
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_URL}/api/agency-company/members/${memberId}`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: String(json?.message || 'Operacja nie powiodła się.') };
  }
  return { ok: true };
}

export async function patchAgencyCompanyContact(
  token: string,
  body: { website?: string | null; officePhone?: string | null; officeEmail?: string | null },
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_URL}/api/agency-company/profile`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: String(json?.message || 'Nie udało się zapisać danych biura.') };
  }
  return { ok: true };
}
