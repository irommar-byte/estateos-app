"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArchiveX,
  Building2,
  ChevronRight,
  Edit3,
  ExternalLink,
  Home,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Trash2,
  User,
  UserCog,
  X,
} from "lucide-react";
import { resolveOfferPrimaryImage } from "@/lib/offers/primaryImage";

type OfferTab = "pending" | "active" | "archived";

type AdminOffer = {
  id: number;
  title?: string | null;
  city?: string | null;
  district?: string | null;
  price?: unknown;
  status?: string;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  verificationStatus?: string;
  advertiserType?: string | null;
  userId?: number;
  user?: {
    id?: number;
    name?: string | null;
    email?: string | null;
    planType?: string | null;
    isPro?: boolean;
    buyerType?: string | null;
    role?: string | null;
  } | null;
  images?: unknown;
  imageUrl?: unknown;
  importExternalUrl?: string | null;
  sourceIsActive?: boolean | null;
  sourceListingExpired?: boolean;
  sourceLastCheckAt?: string | null;
  pendingEditChanges?: Array<{ field?: string; label?: string; from?: string; to?: string }>;
};

type LookupUser = {
  id: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  planType?: string | null;
  isPro?: boolean;
};

function isArchived(offer: AdminOffer) {
  return (
    String(offer.status || "").toUpperCase() === "ARCHIVED" ||
    Boolean(offer.expiresAt && new Date(offer.expiresAt).getTime() < Date.now())
  );
}

function tabForOffer(offer: AdminOffer): OfferTab {
  if (isArchived(offer)) return "archived";
  if (String(offer.status || "").toUpperCase() === "ACTIVE") return "active";
  return "pending";
}

function formatPrice(price: unknown) {
  const p = String(price ?? "").replace(/\D/g, "");
  return p ? `${new Intl.NumberFormat("pl-PL").format(parseInt(p, 10))} PLN` : "Do negocjacji";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" });
}

function verificationMeta(status?: string) {
  const s = String(status || "UNVERIFIED").toUpperCase();
  if (s === "VERIFIED") {
    return { label: "Dok. OK", cls: "border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  }
  if (s === "PENDING_REVIEW") {
    return { label: "Dok. w toku", cls: "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  }
  return { label: "Bez weryf.", cls: "border-[var(--eos-border)] bg-[var(--eos-bg)] text-[var(--eos-muted)]" };
}

function statusMeta(tab: OfferTab) {
  if (tab === "active") {
    return { label: "Aktywna", cls: "border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  }
  if (tab === "archived") {
    return { label: "Archiwum", cls: "border-violet-500/35 bg-violet-500/10 text-violet-600 dark:text-violet-400" };
  }
  return { label: "Weryfikacja", cls: "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400" };
}

function ownerLabel(offer: AdminOffer) {
  const u = offer.user;
  if (!u) return "Nieznany";
  return String(u.name || u.email?.split("@")[0] || `ID ${u.id ?? offer.userId ?? "?"}`);
}

function ownerType(offer: AdminOffer) {
  if (offer.user?.isPro) return "PRO";
  if (offer.user?.planType === "AGENCY" || offer.advertiserType === "agency") return "Agencja";
  return "Prywatny";
}

export default function AdminOffersWorkspace() {
  const router = useRouter();
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [counts, setCounts] = useState({ pending: 0, active: 0, archived: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<OfferTab>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerHits, setOwnerHits] = useState<LookupUser[]>([]);
  const [ownerSearching, setOwnerSearching] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [ownerMsg, setOwnerMsg] = useState<string | null>(null);

  const fetchOffers = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/admin/offers", { cache: "no-store" });
      const data = await res.json();
      if (data?.success && Array.isArray(data.offers)) {
        setOffers(data.offers);
        if (data.counts) {
          setCounts({
            pending: Number(data.counts.pending) || 0,
            active: Number(data.counts.active) || 0,
            archived: Number(data.counts.archived) || 0,
            total: Number(data.counts.total) || data.offers.length,
          });
        } else {
          const c = { pending: 0, active: 0, archived: 0, total: data.offers.length };
          for (const o of data.offers as AdminOffer[]) c[tabForOffer(o)] += 1;
          setCounts(c);
        }
      } else if (Array.isArray(data)) {
        setOffers(data);
      } else {
        setOffers([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchOffers();
  }, [fetchOffers]);

  useEffect(() => {
    const q = ownerQuery.trim();
    if (q.length < 1) {
      setOwnerHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setOwnerSearching(true);
      try {
        const res = await fetch(`/api/admin/users/lookup?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.success && Array.isArray(data.users)) {
          setOwnerHits(data.users);
        }
      } catch {
        if (!cancelled) setOwnerHits([]);
      } finally {
        if (!cancelled) setOwnerSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [ownerQuery]);

  const filteredOffers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const qId = Number(q);
    return offers
      .filter((o) => tabForOffer(o) === activeTab)
      .filter((o) => {
        if (!q) return true;
        if (Number.isFinite(qId) && qId > 0 && o.id === qId) return true;
        const owner = ownerLabel(o).toLowerCase();
        const email = String(o.user?.email || "").toLowerCase();
        return (
          String(o.id).includes(q) ||
          String(o.title || "").toLowerCase().includes(q) ||
          String(o.city || "").toLowerCase().includes(q) ||
          String(o.district || "").toLowerCase().includes(q) ||
          owner.includes(q) ||
          email.includes(q) ||
          String(o.userId || "").includes(q)
        );
      })
      .sort(
        (a, b) =>
          Date.parse(String(b.updatedAt || b.createdAt || 0)) -
          Date.parse(String(a.updatedAt || a.createdAt || 0)),
      );
  }, [offers, activeTab, searchTerm]);

  const selectedOffer = selectedId ? offers.find((o) => o.id === selectedId) ?? null : null;

  const patchLocalOffer = (id: number, patch: Partial<AdminOffer>) => {
    setOffers((prev) => {
      const next = prev.map((o) => (o.id === id ? { ...o, ...patch } : o));
      const c = { pending: 0, active: 0, archived: 0, total: next.length };
      for (const o of next) c[tabForOffer(o)] += 1;
      setCounts(c);
      return next;
    });
  };

  const handleUpdateStatus = async (id: number, status: string, verificationStatus?: string) => {
    const res = await fetch("/api/admin/offers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, verificationStatus }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      alert(data?.error || "Nie udało się zaktualizować oferty.");
      return;
    }
    if (data.offer) {
      patchLocalOffer(id, {
        status: data.offer.status,
        expiresAt: data.offer.expiresAt,
        verificationStatus: verificationStatus || data.offer.verificationStatus,
        user: data.offer.user ?? undefined,
        userId: data.offer.userId,
        updatedAt: data.offer.updatedAt || new Date().toISOString(),
      });
    } else {
      await fetchOffers({ soft: true });
    }
  };

  const handleForceArchive = async (id: number) => {
    if (!confirm("Wymusić archiwizację tej oferty?")) return;
    const res = await fetch("/api/admin/offers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "ARCHIVED" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      alert(data?.error || "Nie udało się zarchiwizować.");
      return;
    }
    setSelectedId(null);
    if (data.offer) patchLocalOffer(id, { status: "ARCHIVED", expiresAt: data.offer.expiresAt });
    else await fetchOffers({ soft: true });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Na pewno usunąć ofertę na stałe?")) return;
    const res = await fetch(`/api/admin/offers?id=${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      alert(data?.error || "Nie udało się usunąć.");
      return;
    }
    setSelectedId(null);
    setOffers((prev) => {
      const next = prev.filter((o) => o.id !== id);
      const c = { pending: 0, active: 0, archived: 0, total: next.length };
      for (const o of next) c[tabForOffer(o)] += 1;
      setCounts(c);
      return next;
    });
  };

  const handleReassignOwner = async (nextUserId: number) => {
    if (!selectedOffer) return;
    if (nextUserId === Number(selectedOffer.userId || selectedOffer.user?.id)) {
      setOwnerMsg("Oferta jest już przypisana do tego użytkownika.");
      return;
    }
    if (!confirm(`Przypisać ofertę #${selectedOffer.id} do użytkownika #${nextUserId}?`)) return;
    setOwnerBusy(true);
    setOwnerMsg(null);
    try {
      const res = await fetch("/api/admin/offers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedOffer.id, userId: nextUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setOwnerMsg(data?.error || "Nie udało się zmienić właściciela.");
        return;
      }
      patchLocalOffer(selectedOffer.id, {
        userId: data.offer?.userId ?? nextUserId,
        user: data.offer?.user ?? null,
        updatedAt: data.offer?.updatedAt || new Date().toISOString(),
      });
      setOwnerMsg(`Przypisano do #${nextUserId}`);
      setOwnerQuery("");
      setOwnerHits([]);
    } catch {
      setOwnerMsg("Błąd sieci przy zmianie właściciela.");
    } finally {
      setOwnerBusy(false);
    }
  };

  const tabs: { id: OfferTab; label: string; count: number; accent: string }[] = [
    { id: "pending", label: "Weryfikacja", count: counts.pending, accent: "amber" },
    { id: "active", label: "Aktywne", count: counts.active, accent: "emerald" },
    { id: "archived", label: "Archiwum", count: counts.archived, accent: "violet" },
  ];

  return (
    <div className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)] px-4 pb-16 pt-28 sm:px-6 md:px-10 md:pt-32 lg:px-12">
      <div className="mx-auto max-w-[1400px]">
        <Link
          href="/centrala"
          className="mb-6 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
        >
          ← Centrala
        </Link>

        <header className="mb-6 flex flex-col gap-4 border-b border-[var(--eos-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
              Moderacja ofert
            </p>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              Zasoby
              <span className="text-emerald-500">.</span>
            </h1>
            <p className="mt-1 text-sm text-[var(--eos-muted)]">
              {counts.total} ofert · szybki podgląd, właściciel i akcje admina
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-md">
            <div className="group relative min-w-0 flex-1">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--eos-subtle)] group-focus-within:text-emerald-500"
                aria-hidden
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Szukaj: ID, tytuł, miasto, właściciel…"
                className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] py-2.5 pl-10 pr-3 text-sm text-[var(--eos-text)] outline-none placeholder:text-[var(--eos-muted)] focus:border-emerald-500/45"
              />
            </div>
            <button
              type="button"
              onClick={() => void fetchOffers({ soft: true })}
              disabled={refreshing || loading}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2.5 text-[10px] font-black uppercase tracking-wide text-[var(--eos-muted)] hover:border-emerald-500/35 hover:text-emerald-600 disabled:opacity-50 dark:hover:text-emerald-400"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Odśwież
            </button>
          </div>
        </header>

        <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-1 [scrollbar-width:none]">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedId(null);
                }}
                className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-all ${
                  active
                    ? tab.accent === "emerald"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : tab.accent === "violet"
                        ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "text-[var(--eos-muted)] hover:bg-[var(--eos-bg)] hover:text-[var(--eos-text)]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
                    active ? "bg-[var(--eos-bg)]/80" : "bg-[var(--eos-border)]/60"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>

        <p className="mb-3 text-[11px] font-semibold text-[var(--eos-subtle)]">
          {filteredOffers.length} w segmencie · {tabs.find((t) => t.id === activeTab)?.label}
          {searchTerm ? ` · filtr „${searchTerm}"` : ""}
        </p>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--eos-muted)]">
                <Loader2 className="size-4 animate-spin text-emerald-500" />
                Wczytywanie ofert…
              </div>
            ) : filteredOffers.length === 0 ? (
              <div className="py-14 text-center text-sm text-[var(--eos-muted)]">Brak ofert w tym widoku.</div>
            ) : (
              <ul className="custom-scrollbar max-h-[calc(100vh-17rem)] divide-y divide-[var(--eos-border)] overflow-y-auto">
                {filteredOffers.map((offer) => {
                  const thumb = resolveOfferPrimaryImage(offer);
                  const tab = tabForOffer(offer);
                  const st = statusMeta(tab);
                  const verify = verificationMeta(offer.verificationStatus);
                  const selected = selectedId === offer.id;
                  const ownerId = Number(offer.user?.id ?? offer.userId ?? 0);
                  const sourceExpired = offer.sourceListingExpired === true || offer.sourceIsActive === false;

                  return (
                    <li key={offer.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(offer.id);
                          setOwnerQuery("");
                          setOwnerHits([]);
                          setOwnerMsg(null);
                        }}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors sm:gap-3.5 sm:px-3.5 ${
                          sourceExpired
                            ? selected
                              ? "border-l-2 border-red-500 bg-red-500/12"
                              : "border-l-2 border-red-500/70 bg-red-500/[0.06] hover:bg-red-500/10"
                            : selected
                              ? "bg-emerald-500/8"
                              : "hover:bg-[var(--eos-bg)]"
                        }`}
                      >
                        <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] sm:size-16">
                          {thumb ? (
                            <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex size-full items-center justify-center text-[var(--eos-subtle)]">
                              <Home size={20} />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`line-clamp-1 text-[13px] font-bold leading-snug sm:text-sm ${
                                sourceExpired ? "text-red-700 dark:text-red-300" : "text-[var(--eos-text)]"
                              }`}
                            >
                              {offer.title || `Oferta #${offer.id}`}
                            </p>
                            <span className="shrink-0 font-mono text-[10px] font-bold text-[var(--eos-subtle)]">
                              #{offer.id}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--eos-muted)]">
                            {[offer.district, offer.city].filter(Boolean).join(" · ") || "—"} · {formatPrice(offer.price)}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${st.cls}`}>
                              {st.label}
                            </span>
                            <span
                              className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${verify.cls}`}
                            >
                              {verify.label}
                            </span>
                            {sourceExpired ? (
                              <span className="rounded-md border border-red-500/40 bg-red-500/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-600 dark:text-red-300">
                                Oryginał nieaktualny
                              </span>
                            ) : null}
                            {ownerId > 0 ? (
                              <span className="inline-flex max-w-[min(100%,12rem)] items-center gap-1 rounded-md border border-[var(--eos-border)] bg-[var(--eos-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--eos-text)]">
                                <User size={10} className="shrink-0" />
                                <span className="truncate">{ownerLabel(offer)}</span>
                                <span className="text-[9px] text-[var(--eos-subtle)]">· #{ownerId}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <ChevronRight
                          size={16}
                          className={`shrink-0 ${selected ? "text-emerald-500" : "text-[var(--eos-subtle)]"}`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <AnimatePresence mode="wait">
            {selectedOffer ? (
              <motion.aside
                key={selectedOffer.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="w-full shrink-0 overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] xl:sticky xl:top-28 xl:w-[400px]"
              >
                {(() => {
                  const thumb = resolveOfferPrimaryImage(selectedOffer);
                  const tab = tabForOffer(selectedOffer);
                  const ownerId = Number(selectedOffer.user?.id ?? selectedOffer.userId ?? 0);
                  const archived = tab === "archived";

                  return (
                    <>
                      <div className="relative aspect-[16/10] border-b border-[var(--eos-border)] bg-[var(--eos-bg)]">
                        {thumb ? (
                          <img src={thumb} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-[var(--eos-subtle)]">
                            <Building2 size={32} />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedId(null)}
                          className="absolute right-2 top-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)]/95 p-1.5 text-[var(--eos-muted)] backdrop-blur-sm hover:text-[var(--eos-text)]"
                          aria-label="Zamknij panel"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="custom-scrollbar max-h-[calc(100vh-14rem)] space-y-4 overflow-y-auto p-4">
                        <div>
                          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">
                            Oferta #{selectedOffer.id}
                          </p>
                          <h2 className="mt-1 text-base font-black leading-snug">
                            {selectedOffer.title || "Bez tytułu"}
                          </h2>
                          <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatPrice(selectedOffer.price)}
                          </p>
                        </div>

                        {Array.isArray(selectedOffer.pendingEditChanges) && selectedOffer.pendingEditChanges.length > 0 ? (
                          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
                              Co zmienił właściciel
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {selectedOffer.pendingEditChanges.map((change, idx) => (
                                <li key={`${change.field || change.label}-${idx}`} className="text-[12px] leading-snug">
                                  <span className="font-bold">{change.label || change.field}: </span>
                                  <span className="text-[var(--eos-muted)]">{change.from || '—'}</span>
                                  <span className="mx-1 text-amber-600 dark:text-amber-400">→</span>
                                  <span className="font-semibold">{change.to || '—'}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <dl className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2.5 py-2">
                            <dt className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">
                              Lokalizacja
                            </dt>
                            <dd className="mt-0.5 font-semibold leading-snug">
                              {[selectedOffer.district, selectedOffer.city].filter(Boolean).join(", ") || "—"}
                            </dd>
                          </div>
                          <div className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2.5 py-2">
                            <dt className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">
                              Ważność
                            </dt>
                            <dd className="mt-0.5 font-semibold">{formatDate(selectedOffer.expiresAt)}</dd>
                          </div>
                          <div className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2.5 py-2">
                            <dt className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">
                              Utworzono
                            </dt>
                            <dd className="mt-0.5 font-semibold">{formatDate(selectedOffer.createdAt)}</dd>
                          </div>
                          <div className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2.5 py-2">
                            <dt className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">
                              Dokumenty
                            </dt>
                            <dd className="mt-0.5 font-semibold">
                              {verificationMeta(selectedOffer.verificationStatus).label}
                            </dd>
                          </div>
                        </dl>

                        <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <UserCog size={14} className="text-emerald-500" />
                            <p className="text-[10px] font-black uppercase tracking-wide text-[var(--eos-subtle)]">
                              Właściciel / userId
                            </p>
                          </div>
                          {ownerId > 0 ? (
                            <Link
                              href={`/centrala/uzytkownicy?userId=${ownerId}`}
                              className="mb-3 flex items-center gap-3 rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] p-2.5 transition-colors hover:border-emerald-500/35"
                            >
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--eos-bg)] text-sm font-black text-emerald-600 dark:text-emerald-400">
                                {ownerLabel(selectedOffer).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold">{ownerLabel(selectedOffer)}</p>
                                <p className="truncate text-[11px] text-[var(--eos-muted)]">
                                  #{ownerId} · {selectedOffer.user?.email || "—"} · {ownerType(selectedOffer)}
                                </p>
                              </div>
                              <ChevronRight size={14} className="shrink-0 text-[var(--eos-subtle)]" />
                            </Link>
                          ) : (
                            <p className="mb-3 text-xs text-[var(--eos-muted)]">Brak przypisanego użytkownika.</p>
                          )}

                          <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">
                            Przypisz do innego użytkownika
                            <input
                              type="search"
                              value={ownerQuery}
                              onChange={(e) => setOwnerQuery(e.target.value)}
                              placeholder="ID, e-mail lub nazwa…"
                              className="mt-1 w-full rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-2.5 py-2 text-sm outline-none focus:border-emerald-500/45"
                            />
                          </label>
                          {ownerSearching ? (
                            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--eos-muted)]">
                              <Loader2 size={12} className="animate-spin" /> Szukam…
                            </p>
                          ) : null}
                          {ownerHits.length > 0 ? (
                            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                              {ownerHits.map((u) => (
                                <li key={u.id}>
                                  <button
                                    type="button"
                                    disabled={ownerBusy}
                                    onClick={() => void handleReassignOwner(u.id)}
                                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-2.5 py-2 text-left text-xs hover:border-emerald-500/40 disabled:opacity-50"
                                  >
                                    <span className="min-w-0 truncate">
                                      <span className="font-bold">#{u.id}</span>{" "}
                                      {u.name || u.email?.split("@")[0] || "—"}
                                      <span className="block truncate text-[10px] text-[var(--eos-muted)]">
                                        {u.email}
                                      </span>
                                    </span>
                                    <span className="shrink-0 text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                                      Przypisz
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {ownerMsg ? (
                            <p className="mt-2 text-[11px] font-semibold text-[var(--eos-muted)]">{ownerMsg}</p>
                          ) : null}
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void handleUpdateStatus(
                                selectedOffer.id,
                                selectedOffer.status === "ACTIVE" ? "PENDING" : "ACTIVE",
                              )
                            }
                            className="flex-1 rounded-xl border border-[var(--eos-border)] py-2.5 text-[10px] font-black uppercase tracking-wide text-[var(--eos-text)] transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300"
                          >
                            {selectedOffer.status === "ACTIVE" ? "Cofnij publikację" : "Zatwierdź"}
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/edytuj-oferte/${selectedOffer.id}?from=admin`)}
                            className="rounded-xl border border-[var(--eos-border)] px-3 py-2.5 text-[var(--eos-muted)] hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400"
                            aria-label="Edytuj ofertę"
                          >
                            <Edit3 size={16} />
                          </button>
                        </div>

                        <div className="rounded-xl border border-[var(--eos-border)] p-2">
                          <p className="mb-2 px-1 text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">
                            Jakość dokumentów
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(
                              [
                                ["UNVERIFIED", "Brak"],
                                ["PENDING_REVIEW", "W toku"],
                                ["VERIFIED", "OK"],
                              ] as const
                            ).map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() =>
                                  void handleUpdateStatus(selectedOffer.id, selectedOffer.status || "PENDING", value)
                                }
                                className={`rounded-lg border py-2 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                                  String(selectedOffer.verificationStatus || "UNVERIFIED") === value
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-[var(--eos-border)] text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Link
                            href={`/oferta/${selectedOffer.id}`}
                            target="_blank"
                            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-[10px] font-black uppercase tracking-wide text-emerald-700 transition-colors hover:bg-emerald-500/15 dark:text-emerald-300"
                          >
                            Podgląd publiczny <ExternalLink size={14} />
                          </Link>
                          {!archived ? (
                            <button
                              type="button"
                              onClick={() => void handleForceArchive(selectedOffer.id)}
                              className="flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 py-2 text-[10px] font-bold uppercase tracking-wide text-violet-600 hover:bg-violet-500/10 dark:text-violet-400"
                            >
                              <ArchiveX size={14} /> Archiwizuj
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void handleDelete(selectedOffer.id)}
                            className="flex items-center justify-center gap-2 rounded-xl border border-red-500/25 py-2 text-[10px] font-bold uppercase tracking-wide text-red-600 hover:bg-red-500/10 dark:text-red-400"
                          >
                            <Trash2 size={14} /> Usuń na stałe
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </motion.aside>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hidden rounded-2xl border border-dashed border-[var(--eos-border)] bg-[var(--eos-card)]/50 p-8 text-center xl:flex xl:w-[400px] xl:flex-col xl:justify-center"
              >
                <MapPin className="mx-auto mb-3 size-8 text-[var(--eos-subtle)]" />
                <p className="text-sm font-semibold text-[var(--eos-text)]">Wybierz ofertę z listy</p>
                <p className="mt-1 text-xs text-[var(--eos-muted)]">
                  Zmiana właściciela, moderacja statusu i dokumenty — w jednym panelu.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
