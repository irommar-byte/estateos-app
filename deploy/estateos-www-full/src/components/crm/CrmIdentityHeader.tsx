'use client';

import Link from 'next/link';
import { Building2, Settings2, Star } from 'lucide-react';
import EliteStatusBadges from '@/components/ui/EliteStatusBadges';
import PasskeyToggle from '@/components/PasskeyToggle';
import { eosBtn } from '@/components/ui/eosButtonStyles';
import type { AgencyMembershipUi } from '@/components/crm/ProfileAgencyOfficeCard';

type Props = {
  personName: string;
  accountPrimary: string;
  accountSecondary?: string | null;
  avatarSrc?: string | null;
  avatarInitial: string;
  currentUser: any;
  userId?: number | null;
  isDarkTheme: boolean;
  verificationStatus: 'verified' | 'email' | 'sms';
  verificationLabels: {
    verifiedBadge: string;
    confirmEmail: string;
    confirmPhone: string;
    seeProfile: string;
    reviewsNone: string;
    userIdLabel: string;
  };
  reviewsData?: { totalReviews: number; averageRating: number } | null;
  reviewsLoading?: boolean;
  onOpenReviews: () => void;
  membership?: AgencyMembershipUi | null;
  isAgencyWorkspace: boolean;
  onPasskeyRefresh: () => Promise<void> | void;
};

function resolveLogoUrl(logoUrl?: string | null) {
  const raw = String(logoUrl || '').trim();
  if (!raw) return null;
  return raw;
}

export default function CrmIdentityHeader({
  personName,
  accountPrimary,
  accountSecondary,
  avatarSrc,
  avatarInitial,
  currentUser,
  userId,
  isDarkTheme,
  verificationStatus,
  verificationLabels,
  reviewsData,
  reviewsLoading,
  onOpenReviews,
  membership,
  isAgencyWorkspace,
  onPasskeyRefresh,
}: Props) {
  const companyName = membership?.companyName || membership?.company?.name || null;
  const logoUrl = resolveLogoUrl(membership?.company?.logoUrl);
  const isAdmin = membership?.role === 'ADMIN' && membership?.status === 'ACTIVE';
  const isPending = membership?.status === 'PENDING' || membership?.pendingApproval;
  const titleLabel =
    membership?.titleLabel || (isAdmin ? 'Kierownik biura' : isAgencyWorkspace ? 'Agent' : null);
  const activeCount =
    membership?.stats?.activeMembers ??
    membership?.team?.filter((m) => m.status === 'ACTIVE').length ??
    0;

  return (
    <section className="mb-5 overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-soft)] sm:mb-6">
      {isAgencyWorkspace && (companyName || membership) ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--eos-border)] bg-[var(--eos-surface)]/40 px-4 py-3 sm:px-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-5 w-5 text-emerald-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[var(--eos-subtle)]">
              Biuro nieruchomości
            </p>
            <p className="truncate text-sm font-black text-[var(--eos-text)] sm:text-base">
              {companyName || 'Twoje biuro'}
            </p>
            <p className="text-[11px] text-[var(--eos-muted)]">
              {isPending
                ? 'Oczekuje na akceptację'
                : `${activeCount} ${activeCount === 1 ? 'osoba' : 'osób'} w zespole`}
              {titleLabel ? ` · ${titleLabel}` : ''}
            </p>
          </div>
          {isAdmin ? (
            <Link href="/moje-konto/firma" className={eosBtn('home', { size: 'sm' })}>
              <Settings2 size={14} />
              Zarządzaj biurem
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] shadow-sm sm:h-16 sm:w-16">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt={`Awatar ${personName}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-black text-emerald-500">
                  {avatarInitial}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--eos-subtle)]">
                Moje konto EstateOS™
              </p>
              <h1 className="mt-1 break-words text-2xl font-black tracking-tight text-[var(--eos-text)] sm:text-3xl">
                {personName || accountPrimary}
              </h1>
              {accountSecondary || companyName ? (
                <p className="mt-1 text-sm font-semibold text-[var(--eos-muted)]">
                  {[titleLabel, companyName && companyName !== personName ? companyName : null, accountSecondary]
                    .filter(Boolean)
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .join(' · ')}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <EliteStatusBadges subject={currentUser} isDark={isDarkTheme} compact />
                {userId ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--eos-border)] bg-[var(--eos-input)] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-[var(--eos-muted)]">
                    {verificationLabels.userIdLabel}
                    <span className="text-emerald-600">{userId}</span>
                  </span>
                ) : null}
                {!reviewsLoading && reviewsData ? (
                  <button
                    type="button"
                    onClick={onOpenReviews}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black text-amber-600 transition hover:bg-amber-500/15"
                  >
                    <Star
                      size={12}
                      className={reviewsData.totalReviews > 0 ? 'fill-amber-500 text-amber-500' : ''}
                    />
                    {reviewsData.totalReviews > 0
                      ? `${reviewsData.averageRating.toFixed(1)} · ${reviewsData.totalReviews}`
                      : verificationLabels.reviewsNone}
                  </button>
                ) : null}
                {verificationStatus === 'verified' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-600">
                    ✓ {verificationLabels.verifiedBadge}
                  </span>
                ) : (
                  <Link
                    href="/moje-konto/weryfikacja"
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-600 hover:bg-amber-500/15"
                  >
                    !{' '}
                    {verificationStatus === 'email'
                      ? verificationLabels.confirmEmail
                      : verificationLabels.confirmPhone}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="w-full shrink-0 sm:max-w-[280px]">
          <PasskeyToggle compact onProfileRefresh={onPasskeyRefresh} />
        </div>
      </div>
    </section>
  );
}
