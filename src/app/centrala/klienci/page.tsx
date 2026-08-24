"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  Building2,
  ChevronRight,
  Contact2,
  Loader2,
  Mail,
  Phone,
  Search,
  Trash2,
  User,
  X,
  AlertTriangle,
  FileText,
  Heart,
  Activity,
} from "lucide-react";
import type { AdminClientListItem } from "@/lib/adminAgencyClients";

type StatusTab = "ACTIVE" | "ARCHIVED" | "ALL";

type ClientDetail = {
  id: number;
  status: string;
  type: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  pesel: string | null;
  notes: string | null;
  agencyUserId: number;
  linkedOfferId: number | null;
  linkedUserId: number | null;
  portalToken: string | null;
  createdAt: string;
  updatedAt: string;
  agencyUser: { id: number; name: string | null; email: string | null; phone: string | null };
  linkedUser: { id: number; email: string | null; name: string | null; lastLoginAt: string | null } | null;
  linkedOffer: {
    id: number;
    title: string | null;
    status: string;
    price: number | null;
    city: string | null;
    officeReviewStatus: string | null;
  } | null;
  acquisition: {
    id: number;
    status: string;
    signedAt: string | null;
    signerName: string | null;
    documentHash: string | null;
  } | null;
  activities: Array<{
    id: number;
    kind: string;
    title: string | null;
    body: string | null;
    createdAt: string;
  }>;
  matches: Array<{
    id: number;
    score: number;
    offer: { id: number; title: string | null; city: string | null; price: number | null; status: string };
  }>;
  deskCases: Array<{ id: number; status: string; source: string | null }>;
  _count: {
    activities: number;
    matches: number;
    portalPushSubscriptions: number;
    deskCases: number;
    deskTasks: number;
  };
};

type PurgePreview = {
  clientId: number;
  status: string;
  name: string;
  counts: ClientDetail["_count"];
  hasAcquisition: boolean;
  linkedOfferId: number | null;
  linkedUser: { id: number; email: string | null; safeToDeleteStub: boolean } | null;
  paperFiles: string[];
};

const TABS: { id: StatusTab; label: string; hint: string }[] = [
  { id: "ACTIVE", label: "Aktywni", hint: "Bieżący CRM" },
  { id: "ARCHIVED", label: "Archiwum", hint: "Zarchiwizowani" },
  { id: "ALL", label: "Wszyscy", hint: "Pełna baza" },
];

function clientName(c: Pick<AdminClientListItem, "firstName" | "lastName">) {
  return `${c.firstName} ${c.lastName}`.trim() || "Bez nazwy";
}

function statusLabel(status: string) {
  if (status === "ARCHIVED") return "Archiwum";
  if (status === "ACTIVE") return "Aktywny";
  return status;
}

function typeLabel(type: string) {
  if (type === "BUYER") return "Kupujący";
  if (type === "SELLER") return "Sprzedający";
  return type;
}

function statusBadgeClass(status: string) {
  if (status === "ARCHIVED") return "border-red-500/30 bg-red-500/10 text-red-500";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pl-PL");
}

function formatPrice(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pl-PL").format(value) + " PLN";
}

export default function AdminCrmClientsPage() {
  const [clients, setClients] = useState<AdminClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<StatusTab>("ACTIVE");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [purgePreview, setPurgePreview] = useState<PurgePreview | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: activeTab });
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await fetch(`/api/admin/clients?${params}`, { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setClients(data.clients || []);
        setSelectedId((prev) => {
          if (!prev) return null;
          return data.clients.some((c: AdminClientListItem) => c.id === prev) ? prev : null;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch]);

  const fetchDetail = useCallback(async (clientId: number) => {
    setDetailLoading(true);
    setPurgePreview(null);
    setPurgeConfirm("");
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (data.success) setDetail(data.client);
      else setDetail(null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (selectedId) void fetchDetail(selectedId);
    else {
      setDetail(null);
      setPurgePreview(null);
      setPurgeConfirm("");
      setActionMsg(null);
    }
  }, [selectedId, fetchDetail]);

  const selectedListItem = selectedId ? clients.find((c) => c.id === selectedId) ?? null : null;

  const runAction = async (action: "restore" | "purge_preview" | "purge", confirm?: string) => {
    if (!selectedId) return;
    setActionBusy(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/clients/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, ...(confirm ? { confirm } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setActionMsg(data.error || "Operacja nie powiodła się.");
        return;
      }
      if (action === "purge_preview") {
        setPurgePreview(data.preview);
        return;
      }
      if (action === "purge") {
        setSelectedId(null);
        setPurgePreview(null);
        setPurgeConfirm("");
        void fetchClients();
        return;
      }
      if (action === "restore") {
        void fetchClients();
        void fetchDetail(selectedId);
      }
    } catch {
      setActionMsg("Błąd sieci.");
    } finally {
      setActionBusy(false);
    }
  };

  const activeCount = clients.filter((c) => c.status === "ACTIVE").length;
  const archivedCount = clients.filter((c) => c.status === "ARCHIVED").length;

  return (
    <div className="theme-aware-dashboard eos-page-shell min-h-screen bg-[var(--eos-bg)] px-4 pb-16 pt-32 text-[var(--eos-text)] sm:px-6 md:px-12 md:pt-36">
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
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
                Centrala · klienci CRM
              </p>
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                Klienci CRM
                <span className="mt-1 block text-lg font-normal text-[var(--eos-muted)] md:text-xl">
                  Pełny podgląd klientów biur — aktywni, archiwum, PESEL i powiązania
                </span>
              </h1>
            </div>
            <div className="group relative w-full lg:max-w-md">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--eos-subtle)] transition-colors group-focus-within:text-red-500"
                size={18}
              />
              <input
                type="search"
                placeholder="Szukaj: imię, nazwisko, e-mail, telefon, PESEL…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] py-3.5 pl-11 pr-4 text-sm outline-none placeholder:text-[var(--eos-muted)] focus:border-red-500/50"
              />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">Wynik</p>
              <p className="text-3xl font-black tabular-nums">{clients.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Aktywni (widok)
              </p>
              <p className="text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">{activeCount}</p>
            </div>
            <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-5">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-red-500">Archiwum (widok)</p>
              <p className="text-3xl font-black tabular-nums text-red-500">{archivedCount}</p>
            </div>
          </div>

          {!loading && (
            <nav className="mt-8" aria-label="Status klientów">
              <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {TABS.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setSelectedId(null);
                      }}
                      title={tab.hint}
                      className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-4 py-3 transition-all ${
                        active
                          ? tab.id === "ARCHIVED"
                            ? "border-red-500/40 bg-red-500/10 text-[var(--eos-text)]"
                            : "border-[var(--eos-border-strong)] bg-[var(--eos-bg-elevated)] text-[var(--eos-text)]"
                          : "border-transparent text-[var(--eos-muted)] hover:border-[var(--eos-border)] hover:bg-[var(--eos-card)]"
                      }`}
                    >
                      {tab.id === "ARCHIVED" ? (
                        <Archive size={16} className={active ? "text-red-500" : "text-[var(--eos-subtle)]"} />
                      ) : (
                        <Contact2 size={16} className={active ? "text-red-500" : "text-[var(--eos-subtle)]"} />
                      )}
                      <span className="text-left">
                        <span className="block whitespace-nowrap text-[11px] font-black uppercase tracking-[0.12em]">
                          {tab.label}
                        </span>
                        <span className="block whitespace-nowrap text-[9px] text-[var(--eos-subtle)]">{tab.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
                {clients.length} klientów · {TABS.find((t) => t.id === activeTab)?.label}
                {debouncedSearch ? ` · filtr „${debouncedSearch}"` : ""}
              </p>
            </nav>
          )}
        </header>

        <div className="flex flex-col gap-8 xl:flex-row">
          <div className="min-w-0 flex-1 space-y-2">
            {loading ? (
              <div className="flex items-center gap-3 py-16 text-[var(--eos-muted)]">
                <Loader2 className="animate-spin text-red-500" size={20} />
                <span className="text-sm font-medium">Wczytywanie klientów…</span>
              </div>
            ) : clients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--eos-border)] bg-[var(--eos-card)]/50 p-12 text-center">
                <Contact2 className="mx-auto mb-4 text-[var(--eos-muted)]" size={36} />
                <p className="text-sm font-semibold">Brak klientów w tym widoku</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[var(--eos-muted)]">
                  {debouncedSearch ? "Zmień wyszukiwanie lub przełącz zakładkę." : "Nie znaleziono rekordów CRM."}
                </p>
              </div>
            ) : (
              clients.map((c) => {
                const selected = selectedId === c.id;
                return (
                  <motion.button
                    type="button"
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectedId(c.id)}
                    className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all md:p-5 ${
                      selected
                        ? "border-red-500/40 bg-red-500/5 shadow-sm"
                        : "border-[var(--eos-border)] bg-[var(--eos-card)] hover:border-[var(--eos-border-strong)]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-black ${
                          c.status === "ARCHIVED"
                            ? "bg-red-500/15 text-red-500"
                            : "bg-[var(--eos-border)] text-[var(--eos-muted)]"
                        }`}
                      >
                        {(c.firstName || c.lastName || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold leading-snug break-words">{clientName(c)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-[var(--eos-bg)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--eos-subtle)]">
                            #{c.id}
                          </span>
                          <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase ${statusBadgeClass(c.status)}`}>
                            {statusLabel(c.status)}
                          </span>
                          <span className="rounded-md bg-[var(--eos-bg)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--eos-subtle)]">
                            {typeLabel(c.type)}
                          </span>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--eos-muted)]">
                          <span className="inline-flex items-center gap-1">
                            <Building2 size={12} />
                            {c.agencyName || `#${c.agencyUserId}`}
                          </span>
                          {c.pesel ? (
                            <span className="font-mono text-[11px] text-red-500/90">PESEL {c.pesel}</span>
                          ) : null}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-[var(--eos-subtle)]">
                          {c.email ? (
                            <span className="inline-flex items-center gap-1 break-all">
                              <Mail size={11} />
                              {c.email}
                            </span>
                          ) : null}
                          {c.phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={11} />
                              {c.phone}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="hidden shrink-0 items-center gap-4 sm:flex">
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">Aktywności</p>
                        <p className="text-sm font-black tabular-nums">{c.activityCount}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">Dopasowania</p>
                        <p className="text-sm font-black tabular-nums">{c.matchCount}</p>
                      </div>
                      <ChevronRight size={18} className={selected ? "text-red-500" : "text-[var(--eos-subtle)]"} />
                    </div>
                    <ChevronRight size={18} className={`shrink-0 sm:hidden ${selected ? "text-red-500" : "text-[var(--eos-subtle)]"}`} />
                  </motion.button>
                );
              })
            )}
          </div>

          <AnimatePresence>
            {selectedId ? (
              <motion.aside
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className="w-full shrink-0 rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-xl xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)] xl:w-[520px] xl:overflow-y-auto xl:p-7"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                      <Contact2 size={12} className="text-red-500" />
                      Szczegóły klienta
                    </p>
                    <h2 className="mt-1 text-lg font-black break-words">
                      {detail ? clientName(detail) : selectedListItem ? clientName(selectedListItem) : "…"}
                    </h2>
                    <p className="text-xs text-[var(--eos-muted)]">ID {selectedId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg border border-[var(--eos-border)] p-2 text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
                    aria-label="Zamknij panel"
                  >
                    <X size={16} />
                  </button>
                </div>

                {detailLoading ? (
                  <div className="flex items-center gap-2 py-12 text-sm text-[var(--eos-muted)]">
                    <Loader2 className="animate-spin text-red-500" size={18} />
                    Wczytywanie szczegółów…
                  </div>
                ) : detail ? (
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase ${statusBadgeClass(detail.status)}`}>
                        {statusLabel(detail.status)}
                      </span>
                      <span className="rounded-md border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--eos-subtle)]">
                        {typeLabel(detail.type)}
                      </span>
                    </div>

                    <section className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/50 p-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">Dane kontaktowe</p>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-[var(--eos-muted)]">E-mail</dt>
                          <dd className="break-all text-right font-medium">{detail.email || "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-[var(--eos-muted)]">Telefon</dt>
                          <dd className="text-right font-medium">{detail.phone || "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-[var(--eos-muted)]">PESEL</dt>
                          <dd className="font-mono text-right font-medium text-red-500">{detail.pesel || "—"}</dd>
                        </div>
                        {detail.notes ? (
                          <div>
                            <dt className="mb-1 text-[var(--eos-muted)]">Notatki</dt>
                            <dd className="whitespace-pre-wrap text-xs leading-relaxed">{detail.notes}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </section>

                    <section className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/50 p-4">
                      <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                        <Building2 size={12} />
                        Biuro / właściciel
                      </p>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-[var(--eos-muted)]">Agent</dt>
                          <dd className="text-right font-medium">{detail.agencyUser.name || "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-[var(--eos-muted)]">E-mail biura</dt>
                          <dd className="break-all text-right text-xs">{detail.agencyUser.email || "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-[var(--eos-muted)]">ID użytkownika</dt>
                          <dd className="font-mono text-right">#{detail.agencyUser.id}</dd>
                        </div>
                      </dl>
                    </section>

                    {detail.linkedOffer ? (
                      <section className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/50 p-4">
                        <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                          <FileText size={12} />
                          Powiązana oferta
                        </p>
                        <p className="font-bold">{detail.linkedOffer.title || `Oferta #${detail.linkedOffer.id}`}</p>
                        <p className="mt-1 text-xs text-[var(--eos-muted)]">
                          {detail.linkedOffer.city || "—"} · {formatPrice(detail.linkedOffer.price)} · {detail.linkedOffer.status}
                        </p>
                        <Link
                          href={`/oferta/${detail.linkedOffer.id}`}
                          className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider text-red-500 hover:underline"
                        >
                          Podgląd oferty →
                        </Link>
                      </section>
                    ) : detail.linkedOfferId ? (
                      <section className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/50 p-4 text-sm">
                        Powiązana oferta #{detail.linkedOfferId} (niedostępna)
                      </section>
                    ) : null}

                    {detail.acquisition ? (
                      <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                          Pozyskanie
                        </p>
                        <p className="text-sm font-bold">Status: {detail.acquisition.status}</p>
                        {detail.acquisition.signerName ? (
                          <p className="mt-1 text-xs text-[var(--eos-muted)]">Podpis: {detail.acquisition.signerName}</p>
                        ) : null}
                        {detail.acquisition.signedAt ? (
                          <p className="mt-1 text-xs text-[var(--eos-muted)]">{formatDate(detail.acquisition.signedAt)}</p>
                        ) : null}
                      </section>
                    ) : null}

                    {detail.linkedUser ? (
                      <section className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/50 p-4">
                        <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                          <User size={12} />
                          Konto portalu
                        </p>
                        <p className="text-sm font-medium">{detail.linkedUser.name || detail.linkedUser.email}</p>
                        <p className="text-xs text-[var(--eos-muted)]">#{detail.linkedUser.id} · ostatnie logowanie {formatDate(detail.linkedUser.lastLoginAt)}</p>
                      </section>
                    ) : null}

                    <section className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/50 p-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">Statystyki</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg border border-[var(--eos-border)] p-2">
                          <p className="text-[9px] uppercase text-[var(--eos-subtle)]">Aktywności</p>
                          <p className="font-black tabular-nums">{detail._count.activities}</p>
                        </div>
                        <div className="rounded-lg border border-[var(--eos-border)] p-2">
                          <p className="text-[9px] uppercase text-[var(--eos-subtle)]">Dopasowania</p>
                          <p className="font-black tabular-nums">{detail._count.matches}</p>
                        </div>
                        <div className="rounded-lg border border-[var(--eos-border)] p-2">
                          <p className="text-[9px] uppercase text-[var(--eos-subtle)]">Sprawy desk</p>
                          <p className="font-black tabular-nums">{detail._count.deskCases}</p>
                        </div>
                        <div className="rounded-lg border border-[var(--eos-border)] p-2">
                          <p className="text-[9px] uppercase text-[var(--eos-subtle)]">Zadania desk</p>
                          <p className="font-black tabular-nums">{detail._count.deskTasks}</p>
                        </div>
                      </div>
                    </section>

                    {detail.matches.length > 0 ? (
                      <section className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/50 p-4">
                        <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                          <Heart size={12} />
                          Top dopasowania
                        </p>
                        <ul className="space-y-2">
                          {detail.matches.map((m) => (
                            <li key={m.id} className="rounded-lg border border-[var(--eos-border)] p-2 text-xs">
                              <p className="font-bold">{m.offer.title || `Oferta #${m.offer.id}`}</p>
                              <p className="text-[var(--eos-muted)]">
                                {m.score}% · {m.offer.city || "—"} · {formatPrice(m.offer.price)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}

                    {detail.activities.length > 0 ? (
                      <section className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/50 p-4">
                        <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                          <Activity size={12} />
                          Ostatnie aktywności
                        </p>
                        <ul className="max-h-48 space-y-2 overflow-y-auto">
                          {detail.activities.slice(0, 8).map((a) => (
                            <li key={a.id} className="border-b border-[var(--eos-border)] pb-2 text-xs last:border-0">
                              <p className="font-semibold">{a.title || a.kind}</p>
                              <p className="text-[var(--eos-muted)]">{formatDate(a.createdAt)}</p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}

                    <p className="text-[10px] text-[var(--eos-subtle)]">
                      Utworzono {formatDate(detail.createdAt)} · aktualizacja {formatDate(detail.updatedAt)}
                    </p>

                    {actionMsg ? (
                      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">{actionMsg}</p>
                    ) : null}

                    {purgePreview ? (
                      <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red-500">
                          <AlertTriangle size={12} />
                          Podgląd usunięcia
                        </p>
                        <ul className="space-y-1 text-xs text-[var(--eos-muted)]">
                          <li>Aktywności: {purgePreview.counts.activities}</li>
                          <li>Dopasowania: {purgePreview.counts.matches}</li>
                          <li>Sprawy desk: {purgePreview.counts.deskCases}</li>
                          <li>Zadania desk: {purgePreview.counts.deskTasks}</li>
                          <li>Push portal: {purgePreview.counts.portalPushSubscriptions}</li>
                          {purgePreview.hasAcquisition ? <li className="text-amber-600">Ma proces pozyskania</li> : null}
                          {purgePreview.linkedUser ? (
                            <li>
                              Konto portalu #{purgePreview.linkedUser.id}
                              {purgePreview.linkedUser.safeToDeleteStub ? " (stub — zostanie usunięty)" : " (pozostanie)"}
                            </li>
                          ) : null}
                          {purgePreview.paperFiles.length > 0 ? (
                            <li>Pliki papierowe: {purgePreview.paperFiles.length}</li>
                          ) : null}
                        </ul>
                      </section>
                    ) : null}

                    <div className="space-y-2 border-t border-[var(--eos-border)] pt-4">
                      {detail.status === "ARCHIVED" ? (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => void runAction("restore")}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-emerald-600 transition-colors hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-400"
                        >
                          {actionBusy ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
                          Przywróć
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => void runAction("purge_preview")}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-4 py-3 text-[11px] font-black uppercase tracking-wider text-[var(--eos-text)] transition-colors hover:border-red-500/30 disabled:opacity-50"
                      >
                        {actionBusy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Podgląd usunięcia
                      </button>
                      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-red-500">Trwałe usunięcie</p>
                        <input
                          type="text"
                          value={purgeConfirm}
                          onChange={(e) => setPurgeConfirm(e.target.value)}
                          placeholder={`Wpisz DELETE-${selectedId}`}
                          className="mb-2 w-full rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2 text-xs outline-none focus:border-red-500/50"
                        />
                        <button
                          type="button"
                          disabled={actionBusy || purgeConfirm !== `DELETE-${selectedId}`}
                          onClick={() => {
                            if (!confirm("Operacja jest nieodwracalna. Kontynuować?")) return;
                            void runAction("purge", purgeConfirm);
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-red-500 transition-colors hover:bg-red-500/25 disabled:opacity-40"
                        >
                          {actionBusy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Usuń trwale
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-sm text-[var(--eos-muted)]">Nie udało się wczytać szczegółów klienta.</p>
                )}
              </motion.aside>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
