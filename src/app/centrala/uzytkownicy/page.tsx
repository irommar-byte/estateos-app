"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  ShieldCheck,
  Trash2,
  X,
  ExternalLink,
  Mail,
  ChevronRight,
  Loader2,
  Building2,
  Crown,
  Activity,
} from "lucide-react";
import Link from "next/link";

type TabType = "PRIVATE" | "AGENCIES" | "PARTNER";

function classifyUser(u: { isPro?: boolean; planType?: string | null; role?: string | null }) {
  if (u.isPro) return "PARTNER" as const;
  if (String(u.role || "").toUpperCase() === "AGENT") return "AGENCIES" as const;
  if (String(u.planType || "").toUpperCase() === "AGENCY") return "AGENCIES" as const;
  return "PRIVATE" as const;
}

function calculatePortfolio(offers: { price?: unknown }[] | undefined) {
  if (!offers?.length) return 0;
  return offers.reduce((acc, off) => acc + (parseFloat(String(off.price).replace(/\s/g, "")) || 0), 0);
}

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("PRIVATE");
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const segmentCounts = useMemo(() => {
    const counts: Record<TabType, number> = { PRIVATE: 0, AGENCIES: 0, PARTNER: 0 };
    for (const u of users) {
      counts[classifyUser(u)] += 1;
    }
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return users
      .filter((u) => {
        const seg = classifyUser(u);
        if (seg !== activeTab) return false;
        if (!q) return true;
        return (
          String(u.email || "").toLowerCase().includes(q) ||
          String(u.name || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
  }, [users, activeTab, searchTerm]);

  const totalOffers = users.reduce((acc, u) => acc + (u.offers?.length || 0), 0);
  const totalCapital = users.reduce((acc, u) => acc + calculatePortfolio(u.offers), 0);

  const tabs: { id: TabType; label: string; hint: string; icon: typeof Users }[] = [
    { id: "PRIVATE", label: "Prywatni", hint: "Osoby fizyczne", icon: Users },
    { id: "AGENCIES", label: "Agencje", hint: "Biura i agenci", icon: Building2 },
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
      const patch = {
        isPro: Boolean(data.isPro),
        planType: data.planType,
        proExpiresAt: data.proExpiresAt,
      };
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
      if (selectedUser?.id === id) {
        setSelectedUser((prev: any) => (prev ? { ...prev, ...patch } : prev));
      }
    } catch {
      alert("Błąd sieci przy zmianie statusu PRO.");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Czy na pewno usunąć tego użytkownika i powiązane dane? Operacji nie można cofnąć.",
      )
    )
      return;

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

  const segmentLabel = tabs.find((t) => t.id === activeTab)?.label ?? "";

  return (
    <div className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)] px-4 sm:px-6 pt-32 pb-16 md:px-12 md:pt-36">
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
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400 mb-2">
                Centrala · użytkownicy
              </p>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[var(--eos-text)]">
                Użytkownicy
                <span className="block text-lg md:text-xl font-normal text-[var(--eos-muted)] mt-1">
                  Segmentacja kont i aktywność na platformie
                </span>
              </h1>
            </div>
            <div className="relative w-full lg:max-w-md group">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--eos-subtle)] group-focus-within:text-emerald-500 transition-colors"
                size={18}
              />
              <input
                type="search"
                placeholder="Szukaj: e-mail, imię, nazwisko…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] py-3.5 pl-11 pr-4 text-sm text-[var(--eos-text)] outline-none focus:border-emerald-500/50 placeholder:text-[var(--eos-muted)]"
              />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] mb-1">
                Konta
              </p>
              <p className="text-3xl font-black tabular-nums">{users.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
                Aktywne oferty
              </p>
              <p className="text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">{totalOffers}</p>
            </div>
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 sm:col-span-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] mb-1">
                Szac. wartość portfeli
              </p>
              <p className="text-2xl md:text-3xl font-black tabular-nums truncate">
                {new Intl.NumberFormat("pl-PL").format(totalCapital)}{" "}
                <span className="text-sm text-[var(--eos-muted)]">PLN</span>
              </p>
            </div>
          </div>

          {!loading && (
            <nav className="mt-8" aria-label="Segmenty użytkowników">
              <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]">
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
                      }}
                      title={tab.hint}
                      className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-3 border transition-all ${
                        active
                          ? tab.id === "AGENCIES"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-[var(--eos-text)]"
                            : tab.id === "PARTNER"
                              ? "border-amber-500/40 bg-amber-500/10 text-[var(--eos-text)]"
                              : "border-[var(--eos-border-strong)] bg-[var(--eos-bg-elevated)] text-[var(--eos-text)]"
                          : "border-transparent text-[var(--eos-muted)] hover:bg-[var(--eos-card)] hover:border-[var(--eos-border)]"
                      }`}
                    >
                      <Icon
                        size={16}
                        className={
                          active
                            ? tab.id === "PARTNER"
                              ? "text-amber-500"
                              : tab.id === "AGENCIES"
                                ? "text-emerald-500"
                                : "text-[var(--eos-text)]"
                            : "text-[var(--eos-subtle)]"
                        }
                      />
                      <span className="text-left">
                        <span className="block text-[11px] font-black uppercase tracking-[0.12em] whitespace-nowrap">
                          {tab.label}
                        </span>
                        <span className="block text-[9px] text-[var(--eos-subtle)] whitespace-nowrap">{tab.hint}</span>
                      </span>
                      <span
                        className={`ml-1 min-w-[1.75rem] rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums ${
                          active ? "bg-[var(--eos-border)] text-[var(--eos-text)]" : "bg-[var(--eos-border)]/60 text-[var(--eos-subtle)]"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
                {filteredUsers.length} w segmencie · {segmentLabel}
                {searchTerm ? ` · filtr „${searchTerm}"` : ""}
              </p>
            </nav>
          )}
        </header>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 min-w-0 space-y-2">
            {loading ? (
              <div className="flex items-center gap-3 py-16 text-[var(--eos-muted)]">
                <Loader2 className="animate-spin text-emerald-500" size={20} />
                <span className="text-sm font-medium">Wczytywanie użytkowników…</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--eos-border)] bg-[var(--eos-card)]/50 p-12 text-center">
                <p className="text-sm font-semibold text-[var(--eos-text)]">Brak użytkowników w tym segmencie</p>
                <p className="mt-2 text-xs text-[var(--eos-muted)] max-w-sm mx-auto leading-relaxed">
                  {searchTerm
                    ? "Zmień wyszukiwanie lub przełącz segment (Prywatni / Agencje / Partner PRO)."
                    : `W kategorii „${segmentLabel}” nie ma jeszcze zarejestrowanych kont.`}
                </p>
              </div>
            ) : (
              filteredUsers.map((u) => {
                const selected = selectedUser?.id === u.id;
                const seg = classifyUser(u);
                return (
                  <motion.button
                    type="button"
                    key={u.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectedUser(u)}
                    className={`w-full text-left p-4 md:p-5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                      selected
                        ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm"
                        : "border-[var(--eos-border)] bg-[var(--eos-card)] hover:border-[var(--eos-border-strong)]"
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-black text-base ${
                          seg === "PARTNER"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : seg === "AGENCIES"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-[var(--eos-border)] text-[var(--eos-muted)]"
                        }`}
                      >
                        {(u.name || u.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[var(--eos-text)] truncate">{u.name || "Bez nazwy"}</span>
                          {u.role === "ADMIN" && <ShieldCheck size={14} className="text-emerald-500 shrink-0" />}
                          {u.isPro && <Crown size={14} className="text-amber-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-[var(--eos-muted)] truncate">{u.email}</p>
                        {String(u.companyName || "").trim() ? (
                          <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                            {u.companyName}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="hidden sm:block text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">Oferty</p>
                        <p className="text-sm font-black tabular-nums">{u.offers?.length || 0}</p>
                      </div>
                      <ChevronRight size={18} className={selected ? "text-emerald-500" : "text-[var(--eos-subtle)]"} />
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>

          <AnimatePresence>
            {selectedUser && (
              <motion.aside
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className="w-full lg:w-[420px] shrink-0 rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 lg:p-7 shadow-xl lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
              >
                <div className="flex justify-between items-start gap-3 mb-8">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-[var(--eos-bg)] border border-[var(--eos-border)] flex items-center justify-center font-black text-lg text-[var(--eos-muted)]">
                      {(selectedUser.name || selectedUser.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-black truncate">{selectedUser.name || "Użytkownik"}</h2>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)] truncate">
                        {selectedUser.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="p-2 rounded-full border border-[var(--eos-border)] text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
                    aria-label="Zamknij panel"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mb-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)] mb-3 flex items-center gap-2">
                    <Activity size={12} className="text-emerald-500" /> Aktywność
                  </h3>
                  <dl className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] divide-y divide-[var(--eos-border)] text-sm">
                    <div className="flex justify-between gap-3 px-4 py-3">
                      <dt className="text-[var(--eos-muted)]">Rejestracja</dt>
                      <dd className="font-semibold text-right">
                        {selectedUser.createdAt
                          ? new Date(selectedUser.createdAt).toLocaleDateString("pl-PL")
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-4 py-3">
                      <dt className="text-[var(--eos-muted)]">Segment</dt>
                      <dd className="font-semibold text-right capitalize">{classifyUser(selectedUser).toLowerCase()}</dd>
                    </div>
                    {String(selectedUser.companyName || "").trim() ? (
                      <div className="flex justify-between gap-3 px-4 py-3">
                        <dt className="text-[var(--eos-muted)]">Biuro / firma</dt>
                        <dd className="font-semibold text-right text-emerald-600 dark:text-emerald-400">
                          {selectedUser.companyName}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-3 px-4 py-3">
                      <dt className="text-[var(--eos-muted)]">Telefon</dt>
                      <dd className="font-semibold text-right">{selectedUser.phone || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3 px-4 py-3">
                      <dt className="text-[var(--eos-muted)]">Portfel (szac.)</dt>
                      <dd className="font-semibold text-right tabular-nums">
                        {new Intl.NumberFormat("pl-PL").format(calculatePortfolio(selectedUser.offers))} PLN
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="space-y-2 mb-6">
                  <a
                    href={`mailto:${selectedUser.email}?subject=EstateOS — wiadomość od administratora`}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--eos-text)] text-[var(--eos-bg)] py-3.5 text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition"
                  >
                    <Mail size={16} /> Wyślij e-mail
                  </a>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => togglePro(selectedUser.id, selectedUser.isPro)}
                      className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition ${
                        selectedUser.isPro
                          ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                          : "border-[var(--eos-border)] text-[var(--eos-muted)] hover:bg-[var(--eos-bg)]"
                      }`}
                    >
                      {selectedUser.isPro ? "Odbierz PRO" : "Nadaj PRO"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedUser.id)}
                      disabled={isDeleting}
                      className="py-3 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Usuń
                    </button>
                  </div>
                </div>

                {selectedUser.offers?.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)] mb-2">
                      Oferty ({selectedUser.offers.length})
                    </h3>
                    <ul className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar">
                      {selectedUser.offers.map((off: any) => (
                        <li
                          key={off.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{off.title || `ID ${off.id}`}</p>
                            <p className="text-[9px] uppercase tracking-wider text-[var(--eos-subtle)]">{off.status}</p>
                          </div>
                          <Link
                            href={`/oferta/${off.id}`}
                            target="_blank"
                            className="p-1.5 rounded-lg border border-[var(--eos-border)] text-[var(--eos-muted)] hover:text-emerald-500"
                          >
                            <ExternalLink size={14} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
