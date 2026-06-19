'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  UserX,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import ProfileMediaAvatar from '@/components/profile/ProfileMediaAvatar';
import AgencyMemberDetailPanel from '@/components/crm/AgencyMemberDetailPanel';
import { AGENCY_AGENT_TITLES, formatAgentTitle } from '@/lib/agentProfile';

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
};

type MembershipPayload = {
  role: string;
  status: string;
  company: DashboardPayload['company'];
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AgencyCompanyWorkspace({ pendingOnly = false }: { pendingOnly?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<MembershipPayload | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);
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
          setDashboard({
            company: dashData.company,
            stats: dashData.stats,
            members: dashData.members,
            creditTransfers: dashData.creditTransfers,
            recentOffers: dashData.recentOffers || [],
          });
        }
      }
    } catch {
      setError('Błąd połączenia z serwerem.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
  }, [loading, dashboard?.stats.pendingAgents]);

  const pendingMembers = useMemo(
    () => dashboard?.members.filter((m) => m.status === 'PENDING') ?? [],
    [dashboard],
  );
  const activeAgents = useMemo(
    () => dashboard?.members.filter((m) => m.status === 'ACTIVE' && m.role === 'AGENT') ?? [],
    [dashboard],
  );

  const handleMemberAction = async (memberId: number, status: 'ACTIVE' | 'REJECTED') => {
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
        setError(data.message || 'Operacja nie powiodła się.');
        return;
      }
      await load();
    } catch {
      setError('Błąd połączenia.');
    } finally {
      setActionId(null);
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

  const company = dashboard?.company ?? membership.company;
  const isPending = membership.status === 'PENDING';
  const isAdmin = membership.role === 'ADMIN' && membership.status === 'ACTIVE';

  if (isPending || pendingOnly) {
    return (
      <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 sm:p-10">
        <div className="flex items-start gap-4">
          <Clock className="shrink-0 text-amber-500" size={32} />
          <div>
            <h1 className="text-2xl font-black text-[var(--eos-text)]">Oczekujesz na zatwierdzenie</h1>
            <p className="eos-muted-copy mt-2 text-sm leading-relaxed">
              Twoje zgłoszenie do biura <strong>{company.name}</strong> zostało wysłane. Administrator firmy musi
              je zatwierdzić, zanim uzyskasz dostęp do CRM i publikacji ofert.
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-amber-600">
              Status: oczekujący pracownik
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
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
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Twoje biuro</p>
              <h1 className="text-2xl font-black text-[var(--eos-text)]">{company.name}</h1>
              {company.address && <p className="eos-muted-copy mt-1 text-sm">{company.address}</p>}
            </div>
          </div>
        </header>
        <p className="eos-muted-copy text-sm">
          Jesteś aktywnym pracownikiem tego biura. Panel zarządzania firmą jest dostępny tylko dla administratora.
        </p>
        <Link href="/moje-konto/crm" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-500 hover:underline">
          Przejdź do CRM <ExternalLink size={14} />
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
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">Panel administratora</span>
              </div>
              <h1 className="text-3xl font-black text-[var(--eos-text)]">{company.name}</h1>
              {company.address && <p className="eos-muted-copy mt-1 text-sm">{company.address}</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--eos-muted)]">
                {company.officePhone && <span>{company.officePhone}</span>}
                {company.officeEmail && <span>{company.officeEmail}</span>}
                {company.website && (
                  <a href={company.website} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">
                    Strona www
                  </a>
                )}
                {company.slug ? (
                  <Link href={`/firma/${company.slug}`} target="_blank" className="inline-flex items-center gap-1 text-emerald-500 hover:underline">
                    Publiczna strona biura <ExternalLink size={12} />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Aktywni agenci', value: dashboard?.stats.activeAgents ?? 0, icon: Users },
              { label: 'Oczekujący', value: dashboard?.stats.pendingAgents ?? 0, icon: Clock },
              { label: 'Oferty firmy', value: dashboard?.stats.totalOffers ?? 0, icon: Building2 },
              { label: 'Kredyty w puli', value: company.extraListings, icon: Wallet },
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
            <UserCheck size={18} className="text-amber-500" /> Zgłoszenia do zatwierdzenia
          </h2>
          <div className="space-y-3">
            {pendingMembers.map((m) => (
              <motion.div
                key={m.id}
                layout
                className="flex flex-col gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-bold text-[var(--eos-text)]">{m.user.name || m.user.email}</p>
                  <p className="eos-muted-copy text-xs">{m.user.email}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-[var(--eos-muted)]">
                    Zgłoszono: {fmtDate(m.createdAt)}
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
                    Zatwierdź
                  </button>
                  <button
                    type="button"
                    disabled={actionId === m.id}
                    onClick={() => void handleMemberAction(m.id, 'REJECTED')}
                    className="inline-flex items-center gap-2 rounded-full border border-red-500/40 px-4 py-2 text-xs font-black uppercase tracking-widest text-red-500 disabled:opacity-50"
                  >
                    <UserX size={14} /> Odrzuć
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-[var(--eos-text)]">Zespół i aktywność</h2>
          <p className="eos-muted-copy text-xs">Podgląd logowań, ofert, CRM i przenoszenie ogłoszeń między agentami</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--eos-border)] text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">
                <th className="py-3 pr-4">Agent</th>
                <th className="py-3 pr-4">Stanowisko</th>
                <th className="py-3 pr-4">Ostatnie logowanie</th>
                <th className="py-3 pr-4">Oferty</th>
                <th className="py-3 pr-4">Opinie</th>
                <th className="py-3 pr-4">CRM</th>
                <th className="py-3 pr-4">Transakcje</th>
                <th className="py-3 pr-4">Kredyty</th>
                <th className="py-3">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {dashboard?.members
                .filter((m) => m.status === 'ACTIVE')
                .map((m) => (
                  <tr key={m.id} className="border-b border-[var(--eos-border)]/60">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="size-12 overflow-hidden rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)]">
                            <ProfileMediaAvatar
                              src={m.profilePhotoUrl || m.user.image}
                              alt={m.user.name || 'Agent'}
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
                          <p className="font-bold text-[var(--eos-text)]">{m.user.name || '—'}</p>
                          <p className="eos-muted-copy text-xs">{m.user.email}</p>
                          {m.role === 'ADMIN' && (
                            <span className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                              Administrator
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <select
                        value={m.agentTitle}
                        onChange={(e) => void handleTitleChange(m.id, e.target.value)}
                        className="eos-field min-w-[7.5rem] py-1.5 text-xs font-bold"
                      >
                        {AGENCY_AGENT_TITLES.map((t) => (
                          <option key={t} value={t}>
                            {formatAgentTitle(t)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-4 pr-4 text-xs text-[var(--eos-muted)]">{fmtDate(m.user.lastLoginAt)}</td>
                    <td className="py-4 pr-4">
                      <div className="text-xs font-bold text-[var(--eos-text)]">{m.user.activeOffers} aktyw.</div>
                      <div className="eos-muted-copy text-[10px]">
                        {m.user.pendingOffers} oczek. · {m.user.soldOffers} sprzed.
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <Link href={`/profil/${m.user.id}#agent-reviews`} className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 hover:underline">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        {m.user.averageRating != null ? m.user.averageRating.toFixed(1) : '—'} ({m.user.reviewsCount})
                      </Link>
                    </td>
                    <td className="py-4 pr-4">{m.user.crmClients}</td>
                    <td className="py-4 pr-4">{m.user.dealsInProgress}</td>
                    <td className="py-4 pr-4">{m.user.extraListings}</td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailMember(m)}
                          className="text-xs font-bold text-emerald-500 hover:underline"
                        >
                          Zarządzaj
                        </button>
                        <Link href={`/profil/${m.user.id}`} className="text-xs font-bold text-[var(--eos-muted)] hover:underline">
                          Profil
                        </Link>
                        {m.role === 'AGENT' && (
                          <button
                            type="button"
                            onClick={() => setCreditTarget(m.userId)}
                            className="text-xs font-bold text-amber-500 hover:underline"
                          >
                            Kredyty
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

      {(dashboard?.recentOffers.length ?? 0) > 0 && (
        <section className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
          <h2 className="mb-4 text-lg font-black text-[var(--eos-text)]">Ostatnie ogłoszenia biura</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {dashboard!.recentOffers.map((offer) => (
              <Link
                key={offer.id}
                href={`/oferta/${offer.id}`}
                className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/50 p-4 transition hover:border-emerald-500/30"
              >
                <p className="truncate font-bold text-[var(--eos-text)]">{offer.title}</p>
                <p className="eos-muted-copy mt-1 text-xs">
                  {offer.agent.name || 'Agent'} · {offer.city} · {offer.status}
                </p>
                <p className="mt-2 text-[10px] text-[var(--eos-muted)]">Aktualizacja: {fmtDate(offer.updatedAt)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {detailMember && (
        <AgencyMemberDetailPanel
          member={detailMember}
          transferTargets={dashboard?.members
            .filter((m) => m.status === 'ACTIVE')
            .map((m) => ({ userId: m.userId, name: m.user.name })) ?? []}
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
              Pula firmy: <strong>{company.extraListings}</strong> kredytów
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

      {(dashboard?.creditTransfers.length ?? 0) > 0 && (
        <section className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
          <h2 className="mb-4 text-lg font-black text-[var(--eos-text)]">Historia przydziałów kredytów</h2>
          <div className="space-y-2">
            {dashboard!.creditTransfers.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--eos-border)]/60 px-4 py-3 text-sm"
              >
                <span>
                  <strong>{t.amount}</strong> kredytów → {t.toUser.name || t.toUser.email}
                </span>
                <span className="eos-muted-copy text-xs">{fmtDate(t.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
