'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Building2,
  Check,
  Clock,
  Coins,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  Phone,
  Pencil,
  ShieldCheck,
  Star,
  Upload,
  UserCheck,
  UserRound,
  UserX,
  Users,
  Wallet,
  X,
  PauseCircle,
  RotateCcw,
  Settings,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/contexts/LocaleContext';
import { formatAgencyDateTime, getAgencyFirm } from '@/i18n/agencyFirmDictionary';
import { numberFormatLocale } from '@/i18n/config';
import ProfileMediaAvatar from '@/components/profile/ProfileMediaAvatar';
import AgencyMemberDetailPanel from '@/components/crm/AgencyMemberDetailPanel';
import AgencyPartnerPlanSection, {
  type AgencyPartnerPlanPayload,
} from '@/components/crm/AgencyPartnerPlanSection';
import AgencyGrowthBanner from '@/components/crm/AgencyGrowthBanner';
import type { PartnerGrowthInsight } from '@/lib/partnerGrowth';
import { AGENCY_AGENT_TITLES, formatAgentTitle, pickTeamMemberAvatar } from '@/lib/agentProfile';

type MemberRow = {
  id: number;
  userId: number;
  role: string;
  status: string;
  agentTitle: string;
  profilePhotoUrl: string | null;
  approvedAt: string | null;
  createdAt: string;
  user: {
    id: number;
    name: string | null;
    email: string;
    image: string | null;
    extraListings: number;
    plusExpiresAt: string | null;
    lastLoginAt: string | null;
    memberSince?: string | null;
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

type DashboardPayload = {
  company: {
    id: number;
    name: string;
    slug: string | null;
    address: string | null;
    website: string | null;
    logoUrl: string | null;
    officePhone: string | null;
    officeEmail: string | null;
    extraListings: number;
    plusExpiresAt: string | null;
    ownerUserId: number;
  };
  stats: {
    activeAgents: number;
    pendingAgents: number;
    totalOffers: number;
  };
  recentOffers: Array<{
    id: number;
    title: string;
    status: string;
    price: number;
    city: string;
    district: string | null;
    imageUrl: string | null;
    agentUserId: number;
    updatedAt: string;
    agent: { id: number; name: string | null };
  }>;
  members: MemberRow[];
  creditTransfers: Array<{
    id: number;
    amount: number;
    note: string | null;
    createdAt: string;
    toUser: { id: number; name: string | null; email: string };
    createdBy: { id: number; name: string | null };
  }>;
  partnerPlan?: AgencyPartnerPlanPayload | null;
  growthInsight?: PartnerGrowthInsight | null;
};

type MembershipPayload = {
  role: string;
  status: string;
  company: DashboardPayload['company'];
};

function formatOfferLocation(city?: string | null, district?: string | null) {
  const cityLabel = String(city || '').trim();
  const districtLabel = String(district || '').trim();
  if (!cityLabel && !districtLabel) return '—';
  if (!districtLabel || districtLabel.toUpperCase() === 'OTHER') return cityLabel || '—';
  return cityLabel ? `${cityLabel}, ${districtLabel}` : districtLabel;
}

function formatOfferPrice(price: number, locale: string) {
  if (!Number.isFinite(price)) return '—';
  return `${Math.round(price).toLocaleString(numberFormatLocale(locale as 'pl' | 'en' | 'uk'))} zł`;
}

function memberDisplayName(member: Pick<MemberRow, 'userId' | 'user'> | null | undefined) {
  if (!member?.user) return `Użytkownik #${member?.userId ?? '?'}`;
  return member.user.name || member.user.email || `Użytkownik #${member.userId}`;
}

function normalizeMemberRow(raw: unknown): MemberRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<MemberRow>;
  if (typeof row.id !== 'number' || typeof row.userId !== 'number') return null;
  const user = row.user;
  if (!user || typeof user !== 'object' || typeof user.id !== 'number') return null;

  return {
    id: row.id,
    userId: row.userId,
    role: String(row.role || 'AGENT'),
    status: String(row.status || 'PENDING'),
    agentTitle: String(row.agentTitle || 'AGENT'),
    profilePhotoUrl: row.profilePhotoUrl ?? null,
    approvedAt: row.approvedAt ?? null,
    createdAt: row.createdAt ?? new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name ?? null,
      email: String(user.email || ''),
      image: user.image ?? null,
      extraListings: Number(user.extraListings ?? 0),
      plusExpiresAt: user.plusExpiresAt ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      memberSince: user.memberSince ?? null,
      activeOffers: Number(user.activeOffers ?? 0),
      pendingOffers: Number(user.pendingOffers ?? 0),
      soldOffers: Number(user.soldOffers ?? 0),
      inDealOffers: Number(user.inDealOffers ?? 0),
      dealsInProgress: Number(user.dealsInProgress ?? 0),
      crmClients: Number(user.crmClients ?? 0),
      reviewsCount: Number(user.reviewsCount ?? 0),
      averageRating:
        user.averageRating == null || Number.isNaN(Number(user.averageRating))
          ? null
          : Number(user.averageRating),
    },
  };
}

function normalizeDashboardPayload(raw: Record<string, unknown>): DashboardPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const companyRaw = raw.company;
  if (!companyRaw || typeof companyRaw !== 'object') return null;

  const members = (Array.isArray(raw.members) ? raw.members : [])
    .map(normalizeMemberRow)
    .filter((m): m is MemberRow => m != null);

  const recentOffers = (Array.isArray(raw.recentOffers) ? raw.recentOffers : [])
    .filter((offer): offer is DashboardPayload['recentOffers'][number] => {
      if (!offer || typeof offer !== 'object') return false;
      const o = offer as DashboardPayload['recentOffers'][number];
      return typeof o.id === 'number' && typeof o.title === 'string';
    })
    .map((offer) => ({
      ...offer,
      district: offer.district ?? null,
      imageUrl: offer.imageUrl ?? null,
      agentUserId: offer.agentUserId ?? offer.agent?.id ?? 0,
      agent: offer.agent ?? { id: 0, name: null },
    }));

  const creditTransfers = (Array.isArray(raw.creditTransfers) ? raw.creditTransfers : [])
    .filter((row): row is DashboardPayload['creditTransfers'][number] => {
      if (!row || typeof row !== 'object') return false;
      const t = row as DashboardPayload['creditTransfers'][number];
      return typeof t.id === 'number' && t.toUser != null;
    });

  const statsRaw = (raw.stats ?? {}) as DashboardPayload['stats'];
  const company = companyRaw as DashboardPayload['company'];

  return {
    company,
    stats: {
      activeAgents: Number(statsRaw?.activeAgents ?? 0),
      pendingAgents: Number(statsRaw?.pendingAgents ?? 0),
      totalOffers: Number(statsRaw?.totalOffers ?? 0),
    },
    members,
    recentOffers,
    creditTransfers,
    partnerPlan: (raw.partnerPlan as DashboardPayload['partnerPlan']) ?? null,
    growthInsight: (raw.growthInsight as DashboardPayload['growthInsight']) ?? null,
  };
}

type MemberStatusAction = 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

type OfficeQueueItem = {
  id: number;
  title: string;
  city: string | null;
  price: number;
  status: string;
  officeReviewStatus: string | null;
  officeSubmittedAt: string | null;
  userId: number;
  user: { id: number; name: string | null; email: string };
};

export default function AgencyCompanyWorkspace({ pendingOnly = false }: { pendingOnly?: boolean }) {
  const { locale } = useLocale();
  const t = getAgencyFirm(locale);
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<MembershipPayload | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    memberId: number;
    status: 'SUSPENDED' | 'REJECTED';
    name: string;
  } | null>(null);
  const [creditTarget, setCreditTarget] = useState<number | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [creditBusy, setCreditBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactDraft, setContactDraft] = useState({
    website: '',
    officePhone: '',
    officeEmail: '',
  });
  const [contactEditing, setContactEditing] = useState(false);
  const [photoBusyId, setPhotoBusyId] = useState<number | null>(null);
  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);
  const [partnerCheckoutLoading, setPartnerCheckoutLoading] = useState<string | null>(null);
  const [partnerCheckoutError, setPartnerCheckoutError] = useState('');
  const searchParams = useSearchParams();
  const [assignBusyId, setAssignBusyId] = useState<number | null>(null);
  const [assignTargetByOffer, setAssignTargetByOffer] = useState<Record<number, string>>({});
  const [officeQueue, setOfficeQueue] = useState<OfficeQueueItem[]>([]);
  const [queueBusyId, setQueueBusyId] = useState<number | null>(null);
  const [rejectDraft, setRejectDraft] = useState<{ offerId: number; note: string } | null>(null);

  const loadOfficeQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/agency-company/offers/office-review', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setOfficeQueue([]);
        return;
      }
      setOfficeQueue(Array.isArray(data.queue) ? data.queue : []);
    } catch {
      setOfficeQueue([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const meRes = await fetch('/api/agency-company/me', { credentials: 'include' });
      const meData = await meRes.json();
      if (!meRes.ok || !meData.success) {
        setError(meData.message || 'Nie udało się wczytać danych firmy.');
        setLoading(false);
        return;
      }
      if (!meData.membership) {
        setMembership(null);
        setDashboard(null);
        setLoading(false);
        return;
      }
      setMembership(meData.membership);

      if (meData.membership.role === 'ADMIN' && meData.membership.status === 'ACTIVE') {
        const dashRes = await fetch('/api/agency-company/dashboard', { credentials: 'include' });
        const dashData = await dashRes.json();
        if (dashRes.ok && dashData.success) {
          const normalized = normalizeDashboardPayload(dashData as Record<string, unknown>);
          if (normalized) {
            setDashboard(normalized);
          } else {
            setError('Nie udało się wczytać pełnych danych panelu biura.');
          }
        } else if (dashRes.status === 403 || dashRes.status === 404) {
          setError(dashData.message || 'Panel administratora jest chwilowo niedostępny.');
        }
      }

      if (
        (meData.membership.role === 'ADMIN' || meData.membership.role === 'MANAGER') &&
        meData.membership.status === 'ACTIVE'
      ) {
        await loadOfficeQueue();
      } else {
        setOfficeQueue([]);
      }
    } catch {
      setError('Błąd połączenia z serwerem.');
    } finally {
      setLoading(false);
    }
  }, [loadOfficeQueue]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const paymentSuccess = searchParams?.get('payment_success');
    const planActivated = searchParams?.get('plan_activated');
    const sessionId = searchParams?.get('session_id');
    if (paymentSuccess !== 'true' || !planActivated) return;

    void (async () => {
      try {
        await fetch('/api/stripe/force-sync', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: planActivated,
            sessionId,
          }),
        });
        await load();
        window.history.replaceState({}, '', '/moje-konto/firma');
      } catch {
        /* webhook may still grant */
      }
    })();
  }, [searchParams, load]);

  useEffect(() => {
    const company = dashboard?.company ?? membership?.company;
    if (!company) return;
    setContactDraft({
      website: company.website || '',
      officePhone: company.officePhone || '',
      officeEmail: company.officeEmail || '',
    });
  }, [dashboard?.company, membership?.company]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const scrollToPending = () => {
      document.getElementById('zgłoszenia')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (window.location.hash === '#zgłoszenia' || new URLSearchParams(window.location.search).get('pending') === '1') {
      const timer = window.setTimeout(scrollToPending, 400);
      return () => window.clearTimeout(timer);
    }
  }, [loading, dashboard?.stats?.pendingAgents]);

  const pendingMembers = useMemo(
    () => (dashboard?.members ?? []).filter((m) => m.status === 'PENDING'),
    [dashboard],
  );
  const activeAgents = useMemo(
    () => (dashboard?.members ?? []).filter((m) => m.status === 'ACTIVE' && m.role === 'AGENT'),
    [dashboard],
  );
  const suspendedMembers = useMemo(
    () => (dashboard?.members ?? []).filter((m) => m.status === 'SUSPENDED'),
    [dashboard],
  );
  const assignableAgents = useMemo(
    () => (dashboard?.members ?? []).filter((m) => m.status === 'ACTIVE'),
    [dashboard],
  );

  const handleMemberAction = async (memberId: number, status: MemberStatusAction) => {
    setActionId(memberId);
    try {
      const res = await fetch(`/api/agency-company/members/${memberId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || t.operationFailed);
        return;
      }
      setConfirmAction(null);
      await load();
    } catch {
      setError(t.connectionError);
    } finally {
      setActionId(null);
    }
  };

  const handleMemberRoleChange = async (memberId: number, role: 'AGENT' | 'MANAGER') => {
    setActionId(memberId);
    setError('');
    try {
      const res = await fetch(`/api/agency-company/members/${memberId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || t.operationFailed);
        return;
      }
      await load();
    } catch {
      setError(t.connectionError);
    } finally {
      setActionId(null);
    }
  };

  const handleOfficeReviewDecision = async (
    offerId: number,
    decision: 'approve' | 'reject',
    note?: string,
  ) => {
    setQueueBusyId(offerId);
    setError('');
    try {
      const res = await fetch('/api/agency-company/offers/office-review', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: decision, offerId, note: note || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || t.operationFailed);
        return;
      }
      setRejectDraft(null);
      await loadOfficeQueue();
      await load();
    } catch {
      setError(t.connectionError);
    } finally {
      setQueueBusyId(null);
    }
  };

  const handleCreditTransfer = async () => {
    if (!creditTarget) return;
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Podaj dodatnią liczbę kredytów.');
      return;
    }
    setCreditBusy(true);
    setError('');
    try {
      const res = await fetch('/api/agency-company/credits', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: creditTarget, amount, note: creditNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Transfer nie powiódł się.');
        return;
      }
      setCreditTarget(null);
      setCreditAmount('');
      setCreditNote('');
      await load();
    } catch {
      setError('Błąd połączenia.');
    } finally {
      setCreditBusy(false);
    }
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    setLogoBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/agency-company/logo', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Nie udało się wgrać logo.');
        return;
      }
      await load();
    } catch {
      setError('Błąd połączenia.');
    } finally {
      setLogoBusy(false);
    }
  };

  const handleMemberPhotoUpload = async (memberId: number, file: File | null) => {
    if (!file) return;
    setPhotoBusyId(memberId);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/agency-company/members/${memberId}/photo`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Nie udało się wgrać zdjęcia.');
        return;
      }
      await load();
    } catch {
      setError('Błąd połączenia.');
    } finally {
      setPhotoBusyId(null);
    }
  };

  const handlePartnerCheckout = async (stripePlanCode: string) => {
    setPartnerCheckoutError('');
    setPartnerCheckoutLoading(stripePlanCode);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/moje-konto/firma`,
          cancelUrl: `${window.location.origin}/moje-konto/firma`,
          plan: stripePlanCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPartnerCheckoutError(data?.error || data?.message || 'Nie udało się rozpocząć płatności.');
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setPartnerCheckoutError('Błąd połączenia z płatnością.');
    } finally {
      setPartnerCheckoutLoading(null);
    }
  };

  const handleAssignOffer = async (offerId: number, fromUserId: number) => {
    const toUserId = Number(assignTargetByOffer[offerId]);
    if (!Number.isFinite(toUserId) || toUserId <= 0) {
      setError('Wybierz agenta, któremu przypisać ogłoszenie.');
      return;
    }
    if (toUserId === fromUserId) {
      setError('Wybierz innego agenta niż obecny opiekun ogłoszenia.');
      return;
    }
    setAssignBusyId(offerId);
    setError('');
    try {
      const res = await fetch('/api/agency-company/offers/transfer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId,
          toUserId,
          offerIds: [offerId],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Nie udało się przypisać ogłoszenia.');
        return;
      }
      setAssignTargetByOffer((prev) => {
        const next = { ...prev };
        delete next[offerId];
        return next;
      });
      await load();
    } catch {
      setError('Błąd połączenia.');
    } finally {
      setAssignBusyId(null);
    }
  };

  const handleContactSave = async () => {
    setContactBusy(true);
    setError('');
    try {
      const res = await fetch('/api/agency-company/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: contactDraft.website.trim() || null,
          officePhone: contactDraft.officePhone.trim() || null,
          officeEmail: contactDraft.officeEmail.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Nie udało się zapisać danych biura.');
        return;
      }
      setContactEditing(false);
      await load();
    } catch {
      setError('Błąd połączenia.');
    } finally {
      setContactBusy(false);
    }
  };

  const handleTitleChange = async (memberId: number, agentTitle: string) => {
    setError('');
    try {
      const res = await fetch(`/api/agency-company/members/${memberId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentTitle }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Nie udało się zapisać stanowiska.');
        return;
      }
      await load();
    } catch {
      setError('Błąd połączenia.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-10 text-center">
        <Building2 className="mx-auto mb-4 text-[var(--eos-muted)]" size={40} />
        <h1 className="text-xl font-black text-[var(--eos-text)]">Brak przypisanej firmy</h1>
        <p className="eos-muted-copy mt-2 text-sm">
          Konto agenta nie jest powiązane z biurem. Załóż nową firmę lub dołącz do istniejącej przy rejestracji.
        </p>
        <Link href="/rejestracja" className="mt-6 inline-block text-sm font-bold text-emerald-500 hover:underline">
          Przejdź do rejestracji
        </Link>
      </div>
    );
  }

  const company = dashboard?.company ?? membership?.company ?? null;
  const isPending = membership.status === 'PENDING';
  const isAdmin = membership.role === 'ADMIN' && membership.status === 'ACTIVE';
  const isManager = membership.role === 'MANAGER' && membership.status === 'ACTIVE';
  const isOfficeManager = isAdmin || isManager;

  const officeActivationQueueSection = (
    <section className="rounded-3xl border border-amber-500/25 bg-amber-500/[0.04] p-6">
      <h2 className="text-lg font-black text-[var(--eos-text)]">{t.offerActivationQueueTitle}</h2>
      <p className="eos-muted-copy mb-4 text-xs">{t.offerActivationQueueSubtitle}</p>
      {officeQueue.length === 0 ? (
        <p className="text-sm font-semibold text-[var(--eos-muted)]">{t.offerActivationQueueEmpty}</p>
      ) : (
        <div className="space-y-3">
          {officeQueue.map((offer) => (
            <div
              key={offer.id}
              className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <Link href={`/oferta/${offer.id}`} className="font-bold text-[var(--eos-text)] hover:text-emerald-600">
                    {offer.title || `Oferta #${offer.id}`}
                  </Link>
                  <p className="eos-muted-copy mt-1 text-xs">
                    {formatOfferLocation(offer.city, null)} · {formatOfferPrice(offer.price, locale)}
                  </p>
                  <p className="eos-muted-copy mt-1 text-[10px] uppercase tracking-widest">
                    {offer.user?.name || offer.user?.email || `Agent #${offer.userId}`}
                    {offer.officeSubmittedAt
                      ? ` · ${formatAgencyDateTime(offer.officeSubmittedAt, locale)}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={queueBusyId === offer.id}
                    onClick={() => void handleOfficeReviewDecision(offer.id, 'approve')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                  >
                    {queueBusyId === offer.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    {t.activateOffer}
                  </button>
                  <button
                    type="button"
                    disabled={queueBusyId === offer.id}
                    onClick={() => setRejectDraft({ offerId: offer.id, note: '' })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-red-500 disabled:opacity-50"
                  >
                    <X size={12} />
                    {t.reject}
                  </button>
                </div>
              </div>
              {rejectDraft?.offerId === offer.id ? (
                <div className="mt-3 space-y-2 border-t border-[var(--eos-border)] pt-3">
                  <textarea
                    rows={2}
                    value={rejectDraft.note}
                    onChange={(event) => setRejectDraft({ offerId: offer.id, note: event.target.value })}
                    placeholder={t.rejectOfferNotePlaceholder}
                    className="eos-field w-full rounded-xl px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={queueBusyId === offer.id}
                      onClick={() => void handleOfficeReviewDecision(offer.id, 'reject', rejectDraft.note)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50"
                    >
                      {queueBusyId === offer.id ? <Loader2 size={12} className="animate-spin" /> : null}
                      {t.confirm}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectDraft(null)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--eos-border)] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );

  if (!company) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-8 text-center sm:p-10">
        <h1 className="text-xl font-black text-[var(--eos-text)]">{t.noCompanyData}</h1>
        <p className="eos-muted-copy mt-2 text-sm">{t.noCompanyDataHint}</p>
        <Link href="/moje-konto/crm" className="mt-6 inline-block text-sm font-bold text-emerald-500 hover:underline">
          {t.backToCrm}
        </Link>
      </div>
    );
  }

  if (isPending || pendingOnly) {
    return (
      <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 sm:p-10">
        <div className="flex items-start gap-4">
          <Clock className="shrink-0 text-amber-500" size={32} />
          <div>
            <h1 className="text-2xl font-black text-[var(--eos-text)]">{t.awaitingApprovalTitle}</h1>
            <p className="eos-muted-copy mt-2 text-sm leading-relaxed">
              {t.awaitingApprovalBody.replace('{company}', company.name)}
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-amber-600">{t.awaitingStatus}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isManager) {
    return (
      <div className="space-y-6">
        <header className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-8">
          <div className="flex flex-wrap items-center gap-4">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                <Building2 size={28} />
              </div>
            )}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">{t.yourOffice}</p>
              <h1 className="text-2xl font-black text-[var(--eos-text)]">{company.name}</h1>
              {company.address && <p className="eos-muted-copy mt-1 text-sm">{company.address}</p>}
            </div>
          </div>
        </header>
        <p className="eos-muted-copy text-sm">{t.employeeOnlyHint}</p>
        <Link href="/moje-konto/crm" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-500 hover:underline">
          {t.goToCrm} <ExternalLink size={14} />
        </Link>
      </div>
    );
  }

  if (isManager && !isAdmin) {
    return (
      <div className="space-y-6">
        <header className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-8">
          <div className="flex flex-wrap items-center gap-4">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                <Building2 size={28} />
              </div>
            )}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">{t.yourOffice}</p>
              <h1 className="text-2xl font-black text-[var(--eos-text)]">{company.name}</h1>
              <span className="mt-2 inline-block rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-600">
                {t.manager}
              </span>
            </div>
          </div>
        </header>
        <p className="eos-muted-copy text-sm">{t.managerPanelHint}</p>
        {isOfficeManager ? officeActivationQueueSection : null}
        <Link href="/moje-konto/crm" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-500 hover:underline">
          {t.goToCrm} <ExternalLink size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="overflow-hidden rounded-3xl border border-[var(--eos-border)] bg-gradient-to-br from-[var(--eos-card)] to-emerald-500/5 p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="h-20 w-20 overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] shadow-lg">
                <ProfileMediaAvatar src={company.logoUrl} alt={company.name} iconSize={36} className="size-full object-cover" />
              </div>
              <label className="absolute -bottom-2 -right-2 flex size-9 cursor-pointer items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] text-emerald-500 shadow-md hover:bg-emerald-500/10">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={logoBusy}
                  onChange={(e) => void handleLogoUpload(e.target.files?.[0] ?? null)}
                />
                {logoBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              </label>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">{t.adminPanel}</span>
              </div>
              <h1 className="text-3xl font-black text-[var(--eos-text)]">{company.name}</h1>
              {company.address && <p className="eos-muted-copy mt-1 text-sm">{company.address}</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--eos-muted)]">
                {company.officePhone && <span>{company.officePhone}</span>}
                {company.officeEmail && <span>{company.officeEmail}</span>}
                {company.website && (
                  <a href={company.website} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">
                    {t.website}
                  </a>
                )}
                {company.slug ? (
                  <Link href={`/firma/${company.slug}`} target="_blank" className="inline-flex items-center gap-1 text-emerald-500 hover:underline">
                    {t.publicOfficePage} <ExternalLink size={12} />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t.activeAgents, value: dashboard?.stats?.activeAgents ?? 0, icon: Users },
              { label: t.pendingAgents, value: dashboard?.stats?.pendingAgents ?? 0, icon: Clock },
              { label: t.companyOffers, value: dashboard?.stats?.totalOffers ?? 0, icon: Building2 },
              { label: t.creditsInPool, value: company.extraListings, icon: Wallet },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/60 px-4 py-3">
                <kpi.icon size={14} className="mb-2 text-emerald-500" />
                <p className="text-2xl font-black text-[var(--eos-text)]">{kpi.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{kpi.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {dashboard?.growthInsight ? (
        <AgencyGrowthBanner insight={dashboard.growthInsight} />
      ) : null}

      {dashboard?.partnerPlan ? (
        <Suspense fallback={null}>
          <AgencyPartnerPlanSection
            id="pakiet"
            partnerPlan={dashboard.partnerPlan}
            onCheckout={(code) => void handlePartnerCheckout(code)}
            checkoutLoading={partnerCheckoutLoading}
            checkoutError={partnerCheckoutError}
          />
        </Suspense>
      ) : null}

      <section className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-[var(--eos-text)]">
              <Globe size={18} className="text-emerald-500" />
              Dane kontaktowe biura
            </h2>
            <p className="eos-muted-copy mt-1 text-xs">
              Widoczne na publicznej stronie biura i w katalogu agencji
            </p>
          </div>
          {!contactEditing ? (
            <button
              type="button"
              onClick={() => setContactEditing(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-500 hover:bg-emerald-500/10"
            >
              <Pencil size={14} /> Edytuj
            </button>
          ) : null}
        </div>

        {contactEditing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">
                <Globe size={12} /> Strona internetowa
              </span>
              <input
                type="url"
                value={contactDraft.website}
                onChange={(e) => setContactDraft((d) => ({ ...d, website: e.target.value }))}
                placeholder="https://twoje-biuro.pl"
                className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm text-[var(--eos-text)] outline-none focus:border-emerald-500/50"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">
                <Phone size={12} /> Telefon biura
              </span>
              <input
                type="tel"
                value={contactDraft.officePhone}
                onChange={(e) => setContactDraft((d) => ({ ...d, officePhone: e.target.value }))}
                placeholder="+48 22 000 00 00"
                className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm text-[var(--eos-text)] outline-none focus:border-emerald-500/50"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">
                <Mail size={12} /> E-mail biura
              </span>
              <input
                type="email"
                value={contactDraft.officeEmail}
                onChange={(e) => setContactDraft((d) => ({ ...d, officeEmail: e.target.value }))}
                placeholder="biuro@twoje-biuro.pl"
                className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm text-[var(--eos-text)] outline-none focus:border-emerald-500/50"
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="button"
                disabled={contactBusy}
                onClick={() => void handleContactSave()}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-black disabled:opacity-50"
              >
                {contactBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Zapisz
              </button>
              <button
                type="button"
                disabled={contactBusy}
                onClick={() => {
                  setContactEditing(false);
                  setContactDraft({
                    website: company.website || '',
                    officePhone: company.officePhone || '',
                    officeEmail: company.officeEmail || '',
                  });
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-5 py-2.5 text-xs font-black uppercase tracking-widest text-[var(--eos-muted)]"
              >
                <X size={14} /> Anuluj
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-sm text-[var(--eos-muted)]">
            <p className="flex items-center gap-2">
              <Globe size={14} className="shrink-0 text-emerald-500" />
              {company.website ? (
                <a href={company.website} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">
                  {company.website}
                </a>
              ) : (
                <span className="italic">Brak strony www</span>
              )}
            </p>
            <p className="flex items-center gap-2">
              <Phone size={14} className="shrink-0 text-emerald-500" />
              {company.officePhone || <span className="italic">Brak telefonu</span>}
            </p>
            <p className="flex items-center gap-2">
              <Mail size={14} className="shrink-0 text-emerald-500" />
              {company.officeEmail || <span className="italic">Brak e-maila</span>}
            </p>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
          {error}
        </div>
      )}

      {pendingMembers.length > 0 && (
        <section id="zgłoszenia" className="scroll-mt-28 rounded-3xl border border-amber-500/25 bg-amber-500/5 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[var(--eos-text)]">
            <UserCheck size={18} className="text-amber-500" /> {t.pendingTitle}
          </h2>
          <div className="space-y-3">
            {pendingMembers.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-bold text-[var(--eos-text)]">{memberDisplayName(m)}</p>
                  <p className="eos-muted-copy text-xs">{m.user?.email || '—'}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-[var(--eos-muted)]">
                    {formatAgencyDateTime(m.createdAt, locale)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actionId === m.id}
                    onClick={() => void handleMemberAction(m.id, 'ACTIVE')}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-black disabled:opacity-50"
                  >
                    {actionId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {t.approve}
                  </button>
                  <button
                    type="button"
                    disabled={actionId === m.id}
                    onClick={() => void handleMemberAction(m.id, 'REJECTED')}
                    className="inline-flex items-center gap-2 rounded-full border border-red-500/40 px-4 py-2 text-xs font-black uppercase tracking-widest text-red-500 disabled:opacity-50"
                  >
                    <UserX size={14} /> {t.reject}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-[var(--eos-text)]">{t.teamTitle}</h2>
          <p className="eos-muted-copy text-xs">{t.teamSubtitle}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--eos-border)] text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">
                <th className="py-3 pr-4">{t.agent}</th>
                <th className="py-3 pr-4">{t.position}</th>
                <th className="py-3 pr-4">{t.lastLogin}</th>
                <th className="py-3 pr-4">{t.offers}</th>
                <th className="py-3 pr-4">{t.reviews}</th>
                <th className="py-3 pr-4">CRM</th>
                <th className="py-3 pr-4">{t.transactions}</th>
                <th className="py-3 pr-4">{t.credits}</th>
                <th className="py-3">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.members ?? [])
                .filter((m) => m.status === 'ACTIVE')
                .map((m) => (
                  <tr key={m.id} className="border-b border-[var(--eos-border)]/60">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="size-12 overflow-hidden rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)]">
                            <ProfileMediaAvatar
                              src={pickTeamMemberAvatar({ userImage: m.user?.image, profilePhotoUrl: m.profilePhotoUrl })}
                              alt={memberDisplayName(m)}
                              iconSize={18}
                              className="size-full object-cover"
                            />
                          </div>
                          <label className="absolute -bottom-1 -right-1 flex size-6 cursor-pointer items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] text-[10px] text-emerald-500">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="sr-only"
                              disabled={photoBusyId === m.id}
                              onChange={(e) => void handleMemberPhotoUpload(m.id, e.target.files?.[0] ?? null)}
                            />
                            {photoBusyId === m.id ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                          </label>
                        </div>
                        <div>
                          <p className="font-bold text-[var(--eos-text)]">{memberDisplayName(m)}</p>
                          <p className="eos-muted-copy text-xs">{m.user?.email || '—'}</p>
                          {m.role === 'ADMIN' && (
                            <span className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                              {t.administrator}
                            </span>
                          )}
                          {m.role === 'MANAGER' && (
                            <span className="mt-1 inline-block rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-600">
                              {t.manager}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <select
                        value={m.agentTitle}
                        onChange={(e) => void handleTitleChange(m.id, e.target.value)}
                        disabled={m.role === 'ADMIN' || m.role === 'MANAGER'}
                        className="eos-field min-w-[7.5rem] rounded-xl py-2 text-xs font-bold"
                      >
                        {AGENCY_AGENT_TITLES.map((titleKey) => (
                          <option key={titleKey} value={titleKey}>
                            {t.agentTitles[titleKey] ?? formatAgentTitle(titleKey)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-4 pr-4 text-xs text-[var(--eos-muted)]">
                      {formatAgencyDateTime(m.user?.lastLoginAt ?? null, locale)}
                    </td>
                    <td className="py-4 pr-4">
                      <div className="text-xs font-bold text-[var(--eos-text)]">
                        {m.user?.activeOffers ?? 0} {t.activeOffersShort}
                      </div>
                      <div className="eos-muted-copy text-[10px]">
                        {m.user?.pendingOffers ?? 0} {t.pendingOffersShort} · {m.user?.soldOffers ?? 0}{' '}
                        {t.soldOffersShort}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      {m.user?.id ? (
                        <Link href={`/profil/${m.user.id}#agent-reviews`} className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 hover:underline">
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          {m.user.averageRating != null ? m.user.averageRating.toFixed(1) : '—'} ({m.user.reviewsCount ?? 0})
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-4 pr-4">{m.user?.crmClients ?? 0}</td>
                    <td className="py-4 pr-4">{m.user?.dealsInProgress ?? 0}</td>
                    <td className="py-4 pr-4">{m.user?.extraListings ?? 0}</td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailMember(m)}
                          className="eos-btn eos-btn--home eos-btn--sm"
                        >
                          <Settings size={12} />
                          {t.manage}
                        </button>
                        {m.user?.id ? (
                          <Link
                            href={`/profil/${m.user.id}`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--eos-text)] transition hover:border-emerald-500/30 hover:text-emerald-600"
                          >
                            <UserRound size={12} />
                            {t.profile}
                          </Link>
                        ) : null}
                        {m.role === 'AGENT' && (
                          <>
                            <button
                              type="button"
                              disabled={actionId === m.id}
                              onClick={() => void handleMemberRoleChange(m.id, 'MANAGER')}
                              className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-sky-600 transition hover:bg-sky-500/20 disabled:opacity-50"
                            >
                              <ShieldCheck size={12} />
                              {t.promoteToManager}
                            </button>
                            <button
                              type="button"
                              onClick={() => setCreditTarget(m.userId)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-600 transition hover:bg-amber-500/20"
                            >
                              <Coins size={12} />
                              {t.assignCredits}
                            </button>
                            <button
                              type="button"
                              disabled={actionId === m.id}
                              onClick={() =>
                                setConfirmAction({
                                  memberId: m.id,
                                  status: 'SUSPENDED',
                                  name: memberDisplayName(m),
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--eos-border)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)] transition hover:border-amber-500/40 hover:text-amber-600 disabled:opacity-50"
                            >
                              <PauseCircle size={12} />
                              {t.suspend}
                            </button>
                            <button
                              type="button"
                              disabled={actionId === m.id}
                              onClick={() =>
                                setConfirmAction({
                                  memberId: m.id,
                                  status: 'REJECTED',
                                  name: memberDisplayName(m),
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-full border border-red-500/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                            >
                              <UserX size={12} />
                              {t.removeFromOffice}
                            </button>
                          </>
                        )}
                        {m.role === 'MANAGER' && (
                          <button
                            type="button"
                            disabled={actionId === m.id}
                            onClick={() => void handleMemberRoleChange(m.id, 'AGENT')}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--eos-border)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)] transition hover:border-amber-500/40 hover:text-amber-600 disabled:opacity-50"
                          >
                            <UserRound size={12} />
                            {t.demoteToAgent}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {suspendedMembers.length > 0 ? (
        <section className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.04] p-6">
          <h2 className="text-lg font-black text-[var(--eos-text)]">{t.suspendedTitle}</h2>
          <p className="eos-muted-copy mb-4 text-xs">{t.suspendedSubtitle}</p>
          <div className="space-y-3">
            {suspendedMembers.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-bold text-[var(--eos-text)]">{memberDisplayName(m)}</p>
                  <p className="eos-muted-copy text-xs">{m.user?.email || '—'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={actionId === m.id}
                    onClick={() => void handleMemberAction(m.id, 'ACTIVE')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                  >
                    {actionId === m.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    {t.restore}
                  </button>
                  <button
                    type="button"
                    disabled={actionId === m.id}
                    onClick={() =>
                      setConfirmAction({
                        memberId: m.id,
                        status: 'REJECTED',
                        name: memberDisplayName(m),
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-red-500 disabled:opacity-50"
                  >
                    <UserX size={12} /> {t.removeFromOffice}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isOfficeManager ? officeActivationQueueSection : null}

      {(dashboard?.recentOffers ?? []).length > 0 && (
        <section className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
          <h2 className="mb-4 text-lg font-black text-[var(--eos-text)]">{t.recentOffersTitle}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {(dashboard?.recentOffers ?? []).map((offer) => {
              const thumb = offer.imageUrl || '/placeholder.jpg';
              const assignTargets = assignableAgents.filter((m) => m.userId !== offer.agentUserId);
              return (
                <div
                  key={offer.id}
                  className="overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/50 transition hover:border-emerald-500/30"
                >
                  <Link href={`/oferta/${offer.id}`} className="flex gap-4 p-4">
                    <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb}
                        alt=""
                        className="size-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.jpg';
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-bold text-[var(--eos-text)]">{offer.title}</p>
                      <p className="mt-1 text-sm font-black text-emerald-500">{formatOfferPrice(offer.price, locale)}</p>
                      <p className="eos-muted-copy mt-1 text-xs">
                        {formatOfferLocation(offer.city, offer.district)}
                      </p>
                      <p className="eos-muted-copy mt-2 text-[10px] uppercase tracking-widest">
                        {offer.agent?.name || 'Agent'} · {offer.status}
                      </p>
                      <p className="mt-2 text-[10px] text-[var(--eos-muted)]">
                        {formatAgencyDateTime(offer.updatedAt, locale)}
                      </p>
                    </div>
                  </Link>
                  {isAdmin && assignTargets.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--eos-border)]/60 px-4 py-3">
                      <label className="eos-muted-copy text-[10px] font-bold uppercase tracking-widest">
                        {t.assignToAgent}
                      </label>
                      <select
                        value={assignTargetByOffer[offer.id] || ''}
                        onChange={(e) =>
                          setAssignTargetByOffer((prev) => ({ ...prev, [offer.id]: e.target.value }))
                        }
                        className="eos-field min-w-[10rem] flex-1 py-1.5 text-xs font-bold"
                      >
                        <option value="">Wybierz agenta…</option>
                        {assignTargets.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {memberDisplayName(m)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={assignBusyId === offer.id}
                        onClick={() => void handleAssignOffer(offer.id, offer.agentUserId)}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black disabled:opacity-50"
                      >
                        {assignBusyId === offer.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : null}
                        {t.transfer}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {detailMember && (
        <AgencyMemberDetailPanel
          member={detailMember}
          transferTargets={(dashboard?.members ?? [])
            .filter((m) => m.status === 'ACTIVE' && m.user)
            .map((m) => ({ userId: m.userId, name: memberDisplayName(m) }))}
          onClose={() => setDetailMember(null)}
          onTransferred={() => void load()}
        />
      )}

      {creditTarget != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-black text-[var(--eos-text)]">
                <Coins size={18} className="text-amber-500" /> Przydziel kredyty
              </h3>
              <button type="button" onClick={() => setCreditTarget(null)} className="text-[var(--eos-muted)]">
                <X size={20} />
              </button>
            </div>
            <p className="eos-muted-copy mb-4 text-sm">
              Pula firmy: <strong>{company.extraListings ?? 0}</strong> kredytów
            </p>
            <input
              type="number"
              min={1}
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              className="eos-field mb-3 w-full"
              placeholder="Liczba kredytów"
            />
            <input
              type="text"
              value={creditNote}
              onChange={(e) => setCreditNote(e.target.value)}
              className="eos-field mb-4 w-full"
              placeholder="Notatka (opcjonalnie)"
            />
            <button
              type="button"
              disabled={creditBusy}
              onClick={() => void handleCreditTransfer()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 py-3 text-sm font-black uppercase tracking-widest text-black disabled:opacity-50"
            >
              {creditBusy ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
              Przenieś kredyty
            </button>
          </div>
        </div>
      )}

      {(dashboard?.creditTransfers ?? []).length > 0 && (
        <section className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
          <h2 className="mb-4 text-lg font-black text-[var(--eos-text)]">Historia przydziałów kredytów</h2>
          <div className="space-y-2">
            {(dashboard?.creditTransfers ?? []).map((transfer) => (
              <div
                key={transfer.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--eos-border)]/60 px-4 py-3 text-sm"
              >
                <span>
                  <strong>{transfer.amount}</strong> kredytów → {transfer.toUser?.name || transfer.toUser?.email || 'Agent'}
                </span>
                <span className="eos-muted-copy text-xs">{formatAgencyDateTime(transfer.createdAt, locale)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {confirmAction ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-2xl">
            <h3 className="text-lg font-black text-[var(--eos-text)]">
              {confirmAction.status === 'SUSPENDED' ? t.confirmSuspendTitle : t.confirmRemoveTitle}
            </h3>
            <p className="eos-muted-copy mt-3 text-sm leading-relaxed">
              <strong className="text-[var(--eos-text)]">{confirmAction.name}</strong>
              {' — '}
              {confirmAction.status === 'SUSPENDED' ? t.confirmSuspendBody : t.confirmRemoveBody}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actionId === confirmAction.memberId}
                onClick={() => void handleMemberAction(confirmAction.memberId, confirmAction.status)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--eos-text)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--eos-bg)] disabled:opacity-50"
              >
                {actionId === confirmAction.memberId ? <Loader2 size={14} className="animate-spin" /> : null}
                {t.confirm}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-[var(--eos-border)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--eos-muted)]"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
