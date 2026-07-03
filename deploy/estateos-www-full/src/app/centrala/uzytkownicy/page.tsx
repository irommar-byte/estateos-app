"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  ShieldCheck,
  ChevronRight,
  Loader2,
  Building2,
  Crown,
  BadgeCheck,
  Radar,
  Smartphone,
  Coins,
  Ticket,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminUserDetail } from "@/lib/adminUserDetail";
import type { AdminAgencyListItem } from "@/lib/adminAgencyDetail";
import AdminUserDetailPanel from "@/components/admin/AdminUserDetailPanel";
import AdminAgencyDetailPanel from "@/components/admin/AdminAgencyDetailPanel";

type TabType = "PRIVATE" | "AGENTS" | "AGENCIES" | "PARTNER";

function isAgentLikeUser(u: { role?: string | null; planType?: string | null }) {
  if (String(u.role || "").toUpperCase() === "AGENT") return true;
  if (String(u.planType || "").toUpperCase() === "AGENCY") return true;
  return false;
}

function classifyUser(u: { isPro?: boolean; planType?: string | null; role?: string | null }) {
  if (isAgentLikeUser(u)) return "AGENTS" as const;
  if (u.isPro) return "PARTNER" as const;
  return "PRIVATE" as const;
}

function calculatePortfolio(offers: { price?: unknown }[] | undefined) {
  if (!offers?.length) return 0;
  return offers.reduce((acc, off) => acc + (parseFloat(String(off.price).replace(/\s/g, "")) || 0), 0);
}

function isVerifiedUser(u: AdminUserDetail) {
  return Boolean(u.isVerified || u.emailVerifiedAt || u.phoneVerifiedAt);
}

export default function AdminUsers() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [agencies, setAgencies] = useState<AdminAgencyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("PRIVATE");
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = async () => {
    try {
      const [usersRes, agenciesRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/agencies"),
      ]);
      const usersData = await usersRes.json();
      const agenciesData = await agenciesRes.json();
      if (usersData.success) {
        setUsers(usersData.users);
        setSelectedUser((prev) =>
          prev ? usersData.users.find((u: AdminUserDetail) => u.id === prev.id) ?? prev : null,
        );
      }
      if (agenciesData.success) setAgencies(agenciesData.agencies);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  useEffect(() => {
    const userId = Number(searchParams.get("userId"));
    const agencyId = Number(searchParams.get("agencyId"));
    if (Number.isFinite(agencyId) && agencyId > 0) {
      setActiveTab("AGENCIES");
      setSelectedAgencyId(agencyId);
      setSelectedUser(null);
      return;
    }
    if (!Number.isFinite(userId) || userId <= 0 || users.length === 0) return;
    const match = users.find((u) => u.id === userId);
    if (!match) return;
    const seg = classifyUser(match);
    if (seg) setActiveTab(seg);
    setSelectedUser(match);
    setSelectedAgencyId(null);
  }, [searchParams, users]);

  const segmentCounts = useMemo(() => {
    const counts: Record<TabType, number> = { PRIVATE: 0, AGENTS: 0, AGENCIES: agencies.length, PARTNER: 0 };
    for (const u of users) {
      const seg = classifyUser(u);
      counts[seg] += 1;
    }
    return counts;
  }, [users, agencies.length]);

  const filteredAgencies = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const qId = Number(q);
    return agencies
      .filter((a) => {
        if (!q) return true;
        if (Number.isFinite(qId) && qId > 0 && a.id === qId) return true;
        return (
          String(a.id).includes(q) ||
          String(a.name || "").toLowerCase().includes(q) ||
          String(a.slug || "").toLowerCase().includes(q) ||
          String(a.ownerName || "").toLowerCase().includes(q) ||
          String(a.managerName || "").toLowerCase().includes(q) ||
          String(a.officeEmail || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [agencies, searchTerm]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const qId = Number(q);
    return users
      .filter((u) => {
        const seg = classifyUser(u);
        if (seg !== activeTab) return false;
        if (!q) return true;
        if (Number.isFinite(qId) && qId > 0 && u.id === qId) return true;
        return (
          String(u.id).includes(q) ||
          String(u.email || "").toLowerCase().includes(q) ||
          String(u.name || "").toLowerCase().includes(q) ||
          String(u.phone || "").toLowerCase().includes(q) ||
          String(u.companyName || "").toLowerCase().includes(q) ||
          String(u.agencyMembership?.companyName || "").toLowerCase().includes(q) ||
          String(u.agencyMembership?.companySlug || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [users, activeTab, searchTerm]);

  const totalOffers = users.reduce((acc, u) => acc + (u.offers?.length || 0), 0);
  const totalCapital = users.reduce((acc, u) => acc + calculatePortfolio(u.offers), 0);
  const verifiedCount = users.filter(isVerifiedUser).length;

  const tabs: { id: TabType; label: string; hint: string; icon: typeof Users }[] = [
    { id: "PRIVATE", label: "Prywatni", hint: "Osoby fizyczne", icon: Users },
    { id: "AGENTS", label: "Agenci", hint: "Agenci i doradcy", icon: Briefcase },
    { id: "AGENCIES", label: "Agencje", hint: "Biura nieruchomości", icon: Building2 },
    { id: "PARTNER", label: "Partner PRO", hint: "Status PRO / inwestor", icon: Crown },
  ];

  const togglePro = async (id: number, isPro: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/toggle-pro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: isPro ? "take" : "give" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        alert(data?.error || "Nie udało się zmienić statusu PRO.");
        return;
      }
      void fetchUsers();
    } catch {
      alert("Błąd sieci przy zmianie statusu PRO.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Czy na pewno usunąć tego użytkownika i powiązane dane? Operacji nie można cofnąć.")) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSelectedUser(null);
        void fetchUsers();
      } else {
        alert("Błąd podczas usuwania.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const patchUserVerification = (
    userId: number,
    patch: Pick<AdminUserDetail, "isVerified" | "emailVerifiedAt" | "phoneVerifiedAt">,
  ) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
    setSelectedUser((prev) => (prev?.id === userId ? { ...prev, ...patch } : prev));
  };

  const openContact = async (peerUserId: number, peerName?: string | null) => {
    try {
      const res = await fetch("/api/contact/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ peerUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.thread?.id) {
        alert(data?.error || "Nie udało się otworzyć czatu.");
        return;
      }
      const name = encodeURIComponent(peerName || "");
      router.push(`/moje-konto/wiadomosci?thread=${data.thread.id}&peer=${peerUserId}${name ? `&name=${name}` : ""}`);
    } catch {
      alert("Błąd sieci przy otwieraniu czatu.");
    }
  };

  const segmentLabel = tabs.find((t) => t.id === activeTab)?.label ?? "";

  return (
    <div className="theme-aware-dashboard eos-page-shell min-h-screen bg-[var(--eos-bg)] px-4 pb-16 text-[var(--eos-text)] sm:px-6 md:px-12">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/centrala"
          className="mb-8 inline-block text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
        >
          ← Powrót do centrali
        </Link>

        <header className="mb-10 border-b border-[var(--eos-border)] pb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400">
                Centrala · użytkownicy
              </p>
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                Użytkownicy
                <span className="mt-1 block text-lg font-normal text-[var(--eos-muted)] md:text-xl">
                  Pełny podgląd kont, radaru, weryfikacji i kanałów API
                </span>
              </h1>
            </div>
            <div className="group relative w-full lg:max-w-md">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--eos-subtle)] transition-colors group-focus-within:text-emerald-500"
                size={18}
              />
              <input
                type="search"
                placeholder="Szukaj: ID, e-mail, imię, telefon, firma…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] py-3.5 pl-11 pr-4 text-sm outline-none placeholder:text-[var(--eos-muted)] focus:border-emerald-500/50"
              />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">Konta</p>
              <p className="text-3xl font-black tabular-nums">{users.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Zweryfikowani
              </p>
              <p className="text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">{verifiedCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">Aktywne oferty</p>
              <p className="text-3xl font-black tabular-nums">{totalOffers}</p>
            </div>
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-[var(--eos-muted)]">Szac. portfele</p>
              <p
                className="text-xl font-black tabular-nums leading-tight sm:text-2xl lg:text-3xl"
                title={`${new Intl.NumberFormat("pl-PL").format(totalCapital)} PLN`}
              >
                {new Intl.NumberFormat("pl-PL").format(totalCapital)}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--eos-muted)]">PLN</p>
            </div>
          </div>

          {!loading && (
            <nav className="mt-8" aria-label="Segmenty użytkowników">
              <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  const count = segmentCounts[tab.id];
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setSelectedUser(null);
                        setSelectedAgencyId(null);
                      }}
                      title={tab.hint}
                      className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-4 py-3 transition-all ${
                        active
                          ? tab.id === "AGENCIES" || tab.id === "AGENTS"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-[var(--eos-text)]"
                            : tab.id === "PARTNER"
                              ? "border-amber-500/40 bg-amber-500/10 text-[var(--eos-text)]"
                              : "border-[var(--eos-border-strong)] bg-[var(--eos-bg-elevated)] text-[var(--eos-text)]"
                          : "border-transparent text-[var(--eos-muted)] hover:border-[var(--eos-border)] hover:bg-[var(--eos-card)]"
                      }`}
                    >
                      <Icon
                        size={16}
                        className={
                          active
                            ? tab.id === "PARTNER"
                              ? "text-amber-500"
                              : tab.id === "AGENCIES" || tab.id === "AGENTS"
                                ? "text-emerald-500"
                                : "text-[var(--eos-text)]"
                            : "text-[var(--eos-subtle)]"
                        }
                      />
                      <span className="text-left">
                        <span className="block whitespace-nowrap text-[11px] font-black uppercase tracking-[0.12em]">{tab.label}</span>
                        <span className="block whitespace-nowrap text-[9px] text-[var(--eos-subtle)]">{tab.hint}</span>
                      </span>
                      <span className="ml-1 min-w-[1.75rem] rounded-md bg-[var(--eos-border)]/60 px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
                {activeTab === "AGENCIES" ? filteredAgencies.length : filteredUsers.length} w segmencie · {segmentLabel}
                {searchTerm ? ` · filtr „${searchTerm}"` : ""}
              </p>
            </nav>
          )}
        </header>

        <div className="flex flex-col gap-8 xl:flex-row">
          <div className="min-w-0 flex-1 space-y-2">
            {loading ? (
              <div className="flex items-center gap-3 py-16 text-[var(--eos-muted)]">
                <Loader2 className="animate-spin text-emerald-500" size={20} />
                <span className="text-sm font-medium">Wczytywanie użytkowników…</span>
              </div>
            ) : activeTab === "AGENCIES" ? (
              filteredAgencies.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--eos-border)] bg-[var(--eos-card)]/50 p-12 text-center">
                  <Building2 className="mx-auto mb-4 text-[var(--eos-muted)]" size={36} />
                  <p className="text-sm font-semibold">Brak zarejestrowanych biur</p>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[var(--eos-muted)]">
                    {searchTerm
                      ? "Zmień wyszukiwanie lub wyczyść filtr."
                      : "Biura powstają przy rejestracji agenta lub automatycznie z profilu kierownika."}
                  </p>
                </div>
              ) : (
                filteredAgencies.map((a) => {
                  const selected = selectedAgencyId === a.id;
                  return (
                    <motion.button
                      type="button"
                      key={a.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        setSelectedAgencyId(a.id);
                        setSelectedUser(null);
                      }}
                      className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all md:p-5 ${
                        selected
                          ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm"
                          : "border-[var(--eos-border)] bg-[var(--eos-card)] hover:border-[var(--eos-border-strong)]"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          <Building2 size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold leading-snug break-words" title={a.name}>
                            {a.name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-[var(--eos-bg)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--eos-subtle)]">
                              #{a.id}
                            </span>
                            {a.managerName ? (
                              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-600 dark:text-amber-400">
                                {a.managerName}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 break-all text-xs text-[var(--eos-muted)]">
                            {a.slug ? `/firma/${a.slug}` : "Bez slug"} · właściciel: {a.ownerName || `#${a.ownerUserId}`}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[var(--eos-subtle)]">
                            <span>{a.stats.activeMembers} prac.</span>
                            {a.stats.pendingMembers > 0 ? <span>{a.stats.pendingMembers} oczek.</span> : null}
                            <span>{a.stats.activeOffers} ofert</span>
                            <span>{a.extraListings} kred. puli</span>
                            <span>od {new Date(a.createdAt).toLocaleDateString("pl-PL")}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={18} className={selected ? "text-emerald-500" : "text-[var(--eos-subtle)]"} />
                    </motion.button>
                  );
                })
              )
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--eos-border)] bg-[var(--eos-card)]/50 p-12 text-center">
                <p className="text-sm font-semibold">Brak użytkowników w tym segmencie</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[var(--eos-muted)]">
                  {searchTerm
                    ? "Zmień wyszukiwanie lub przełącz segment."
                    : `W kategorii „${segmentLabel}” nie ma jeszcze zarejestrowanych kont.`}
                </p>
              </div>
            ) : (
              filteredUsers.map((u) => {
                const selected = selectedUser?.id === u.id;
                const seg = classifyUser(u);
                const verified = isVerifiedUser(u);
                return (
                  <motion.button
                    type="button"
                    key={u.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      setSelectedUser(u);
                      setSelectedAgencyId(null);
                    }}
                    className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all md:p-5 ${
                      selected
                        ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm"
                        : "border-[var(--eos-border)] bg-[var(--eos-card)] hover:border-[var(--eos-border-strong)]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-black ${
                          seg === "PARTNER"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : seg === "AGENTS"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-[var(--eos-border)] text-[var(--eos-muted)]"
                        }`}
                      >
                        {(u.name || u.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold leading-snug break-words" title={u.name || u.email || undefined}>
                          {u.name || "Bez nazwy"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-[var(--eos-bg)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--eos-subtle)]">
                            #{u.id}
                          </span>
                          {u.role === "ADMIN" ? <ShieldCheck size={14} className="shrink-0 text-emerald-500" /> : null}
                          {u.agencyMembership?.isOfficeBoard ? (
                            <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                              Zarząd biura
                            </span>
                          ) : null}
                          {u.isPro ? <Crown size={14} className="shrink-0 text-amber-500" /> : null}
                          {verified ? <BadgeCheck size={14} className="shrink-0 text-emerald-500" /> : null}
                          {u.devices.length > 0 ? <Smartphone size={13} className="shrink-0 text-[var(--eos-subtle)]" /> : null}
                          {u.radar ? <Radar size={13} className="shrink-0 text-sky-500" /> : null}
                          {u.wallet && u.wallet.credits > 0 ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                              <Coins size={10} />
                              {u.wallet.credits}
                            </span>
                          ) : null}
                          {u.wallet && u.wallet.activeCoupons > 0 ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold text-sky-600 dark:text-sky-400">
                              <Ticket size={10} />
                              {u.wallet.activeCoupons}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 break-all text-xs text-[var(--eos-muted)]">{u.email}</p>
                        {u.agencyMembership ? (
                          <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {u.agencyMembership.companyName}
                            {u.agencyMembership.memberRole === "ADMIN" ? " · zarząd" : ""}
                          </p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[var(--eos-subtle)]">
                          {u.radar?.city ? <span>{u.radar.city}</span> : null}
                          {u.channels.length ? <span>{u.channels.slice(0, 2).join(" · ")}</span> : null}
                          {u.lastLoginIp ? <span>IP {u.lastLoginIp}</span> : null}
                        </div>
                      </div>
                    </div>
                    <div className="hidden shrink-0 items-center gap-4 xl:flex">
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">Kredyty</p>
                        <p className="text-sm font-black tabular-nums">{u.wallet?.credits ?? 0}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">Kupony</p>
                        <p className="text-sm font-black tabular-nums">{u.wallet?.activeCoupons ?? 0}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">Oferty</p>
                        <p className="text-sm font-black tabular-nums">{u.offers?.length || 0}</p>
                      </div>
                      <ChevronRight size={18} className={selected ? "text-emerald-500" : "text-[var(--eos-subtle)]"} />
                    </div>
                    <ChevronRight size={18} className={`shrink-0 xl:hidden ${selected ? "text-emerald-500" : "text-[var(--eos-subtle)]"}`} />
                  </motion.button>
                );
              })
            )}
          </div>

          <AnimatePresence>
            {selectedAgencyId ? (
              <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>
                <AdminAgencyDetailPanel
                  agencyId={selectedAgencyId}
                  onClose={() => setSelectedAgencyId(null)}
                  onOpenMessages={(userId, name) => void openContact(userId, name)}
                  onUpdated={() => void fetchUsers()}
                />
              </motion.div>
            ) : selectedUser ? (
              <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>
                <AdminUserDetailPanel
                  user={selectedUser}
                  segmentLabel={segmentLabel}
                  portfolioValue={calculatePortfolio(selectedUser.offers)}
                  isDeleting={isDeleting}
                  onClose={() => setSelectedUser(null)}
                  onTogglePro={() => void togglePro(selectedUser.id, selectedUser.isPro)}
                  onDelete={() => void handleDelete(selectedUser.id)}
                  onOpenMessages={() => void openContact(selectedUser.id, selectedUser.name)}
                  onVerificationChange={(patch) => patchUserVerification(selectedUser.id, patch)}
                  onRefresh={() => void fetchUsers()}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
