import type { AgencyMembershipSnapshot } from '../types/agencyMembership';

/** Agent dołączył do biura, ale kierownik jeszcze go nie zatwierdził. */
export function isAgencyAgentPendingApproval(
  user: { role?: string | null } | null | undefined,
  membership: AgencyMembershipSnapshot | null | undefined,
): boolean {
  return Boolean(user?.role === 'AGENT' && membership?.pendingApproval);
}
