import type { AgencyAgentTitle } from '@prisma/client';

export const AGENCY_AGENT_TITLES: AgencyAgentTitle[] = [
  'DORADCA',
  'AGENT',
  'BROKER',
  'EXPERT',
  'LEADER',
  'KIEROWNIK_BIURO',
  'ZASTEPCA_KIEROWNIKA',
];

const TITLE_LABELS: Record<AgencyAgentTitle, string> = {
  DORADCA: 'Doradca',
  AGENT: 'Agent',
  BROKER: 'Broker',
  EXPERT: 'Expert',
  LEADER: 'Leader',
  KIEROWNIK_BIURO: 'Kierownik biura',
  ZASTEPCA_KIEROWNIKA: 'Zastępca kierownika biura',
};

export function formatAgentTitle(title: string | null | undefined): string {
  const key = String(title || 'AGENT').toUpperCase() as AgencyAgentTitle;
  return TITLE_LABELS[key] || TITLE_LABELS.AGENT;
}

export function isPdfMediaUrl(url: string | null | undefined): boolean {
  return String(url || '').toLowerCase().includes('.pdf');
}

export function resolveProfileMediaUrl(value: unknown): string | null {
  const s = String(value ?? '').trim();
  if (!s || s === '[object Object]') return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return s;
  return `/${s.replace(/^\//, '')}`;
}

export function pickAgentAvatar(params: {
  profilePhotoUrl?: string | null;
  userImage?: string | null;
  companyLogoUrl?: string | null;
}): string | null {
  return (
    resolveProfileMediaUrl(params.profilePhotoUrl) ||
    resolveProfileMediaUrl(params.userImage) ||
    resolveProfileMediaUrl(params.companyLogoUrl)
  );
}
