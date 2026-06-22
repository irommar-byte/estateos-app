'use client';

import Link from 'next/link';
import { Building2, ChevronRight } from 'lucide-react';

export type AgencyMembershipUi = {
  status: string;
  role: string;
  titleLabel?: string | null;
  displayAvatarUrl?: string | null;
  pendingApproval?: boolean;
  companyName?: string | null;
  company?: {
    name?: string | null;
    logoUrl?: string | null;
  } | null;
  team?: Array<{ status: string; isSelf?: boolean; image?: string | null }>;
  stats?: {
    activeMembers?: number;
    pendingMembers?: number;
  };
};

type Props = {
  membership: AgencyMembershipUi;
  personName?: string | null;
};

function resolveLogoUrl(logoUrl?: string | null) {
  const raw = String(logoUrl || '').trim();
  if (!raw) return null;
  return raw.startsWith('/') ? raw : raw;
}

export default function ProfileAgencyOfficeCard({ membership, personName }: Props) {
  const companyName =
    membership.companyName || membership.company?.name || 'Biuro nieruchomości';
  const logoUrl = resolveLogoUrl(membership.company?.logoUrl);
  const isAdmin = membership.role === 'ADMIN' && membership.status === 'ACTIVE';
  const isPending = membership.status === 'PENDING' || membership.pendingApproval;
  const titleLabel = membership.titleLabel || (isAdmin ? 'Kierownik biura' : 'Agent');
  const activeCount =
    membership.stats?.activeMembers ??
    membership.team?.filter((m) => m.status === 'ACTIVE').length ??
    0;
  const pendingCount =
    membership.stats?.pendingMembers ??
    membership.team?.filter((m) => m.status === 'PENDING').length ??
    0;

  let subtitle = `${activeCount} pracowników w zespole`;
  if (isPending) subtitle = 'Oczekuje na akceptację przez kierownika biura';
  else if (isAdmin && pendingCount > 0) {
    subtitle = `${activeCount} aktywnych · ${pendingCount} oczekujących`;
  } else if (personName) {
    subtitle = `${personName} · ${subtitle}`;
  }

  return (
    <Link
      href="/moje-konto/firma"
      className="mb-6 flex items-center gap-4 rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-surface)]/60 p-4 transition hover:border-emerald-500/30 hover:bg-[var(--eos-surface)] sm:p-5"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-white/5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Building2 className="h-7 w-7 text-emerald-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--eos-subtle)]">
          Moje biuro
        </p>
        <p className="mt-0.5 truncate text-lg font-black tracking-tight text-[var(--eos-text)]">
          {companyName}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-lg bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
            {titleLabel}
          </span>
          {isAdmin ? (
            <span className="rounded-lg bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
              Administrator
            </span>
          ) : null}
          {isPending ? (
            <span className="rounded-lg bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
              Oczekuje
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-[var(--eos-muted)]">{subtitle}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--eos-subtle)]" />
    </Link>
  );
}
