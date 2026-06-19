"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Calendar,
  Check,
  Coins,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";
import type { AdminAgencyDetail } from "@/lib/adminAgencyDetail";
import ProfileMediaAvatar from "@/components/profile/ProfileMediaAvatar";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pl-PL");
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 px-4 py-2.5 text-sm">
      <dt className="shrink-0 text-[var(--eos-muted)]">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

export default function AdminAgencyDetailPanel({
  agencyId,
  onClose,
  onOpenMessages,
  onUpdated,
}: {
  agencyId: number;
  onClose: () => void;
  onOpenMessages: (userId: number, name?: string | null) => void;
  onUpdated?: () => void;
}) {
  const [agency, setAgency] = useState<AdminAgencyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    address: "",
    website: "",
    officePhone: "",
    officeEmail: "",
    extraListings: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/agencies/${agencyId}`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Nie udało się wczytać biura.");
        setAgency(null);
        return;
      }
      setAgency(data.agency);
      setDraft({
        name: data.agency.name || "",
        address: data.agency.address || "",
        website: data.agency.website || "",
        officePhone: data.agency.officePhone || "",
        officeEmail: data.agency.officeEmail || "",
        extraListings: String(data.agency.extraListings ?? 0),
      });
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/agencies/${agencyId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          address: draft.address.trim() || null,
          website: draft.website.trim() || null,
          officePhone: draft.officePhone.trim() || null,
          officeEmail: draft.officeEmail.trim() || null,
          extraListings: Number(draft.extraListings),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Zapis nie powiódł się.");
        return;
      }
      setAgency(data.agency);
      setEditing(false);
      onUpdated?.();
    } catch {
      setError("Błąd połączenia przy zapisie.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <aside className="flex w-full shrink-0 items-center justify-center rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-16 lg:w-[28rem] xl:w-[32rem]">
        <Loader2 className="animate-spin text-emerald-500" size={28} />
      </aside>
    );
  }

  if (!agency) {
    return (
      <aside className="w-full shrink-0 rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-8 lg:w-[28rem]">
        <p className="text-sm text-red-500">{error || "Brak danych biura."}</p>
        <button type="button" onClick={onClose} className="mt-4 text-sm font-bold text-[var(--eos-muted)]">
          Zamknij
        </button>
      </aside>
    );
  }

  const publicUrl = agency.slug ? `/firma/${agency.slug}` : `/firma/${agency.id}`;

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-28 lg:w-[28rem] xl:w-[32rem]">
      <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--eos-border)] bg-[var(--eos-card)]/95 px-5 py-4 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            <div className="size-12 shrink-0 overflow-hidden rounded-xl border border-[var(--eos-border)]">
              <ProfileMediaAvatar src={agency.logoUrl} alt="" iconSize={22} className="size-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black">{agency.name}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Biuro #{agency.id}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[var(--eos-muted)] hover:bg-[var(--eos-border)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {error ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500">
              {error}
            </div>
          ) : null}

          <div className="mb-5 grid grid-cols-2 gap-2">
            {[
              { label: "Pracownicy", value: agency.stats.activeMembers, icon: Users },
              { label: "Oczekujący", value: agency.stats.pendingMembers, icon: User },
              { label: "Oferty aktywne", value: agency.stats.activeOffers, icon: Building2 },
              { label: "Kredyty puli", value: agency.extraListings, icon: Coins },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5">
                <kpi.icon size={13} className="mb-1 text-emerald-500" />
                <p className="text-xl font-black tabular-nums">{kpi.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">{kpi.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <Link
              href={publicUrl}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
            >
              <ExternalLink size={12} /> Strona biura
            </Link>
            <Link
              href={`/moje-konto/firma`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--eos-border)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]"
            >
              Panel firmy
            </Link>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--eos-border)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--eos-text)]"
            >
              {editing ? "Anuluj edycję" : "Edytuj dane"}
            </button>
          </div>

          {editing ? (
            <div className="mb-5 space-y-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)] p-4">
              <label className="block text-xs">
                <span className="mb-1 block font-bold text-[var(--eos-muted)]">Nazwa biura</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-bold text-[var(--eos-muted)]">Adres</span>
                <input
                  value={draft.address}
                  onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-bold text-[var(--eos-muted)]">Strona www</span>
                <input
                  value={draft.website}
                  onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs">
                  <span className="mb-1 block font-bold text-[var(--eos-muted)]">Telefon</span>
                  <input
                    value={draft.officePhone}
                    onChange={(e) => setDraft((d) => ({ ...d, officePhone: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-bold text-[var(--eos-muted)]">E-mail</span>
                  <input
                    value={draft.officeEmail}
                    onChange={(e) => setDraft((d) => ({ ...d, officeEmail: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs">
                <span className="mb-1 block font-bold text-[var(--eos-muted)]">Kredyty w puli firmy</span>
                <input
                  type="number"
                  min={0}
                  value={draft.extraListings}
                  onChange={(e) => setDraft((d) => ({ ...d, extraListings: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-black uppercase tracking-widest text-black disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Zapisz zmiany
              </button>
            </div>
          ) : (
            <div className="mb-5 overflow-hidden rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] divide-y divide-[var(--eos-border)]">
              <InfoRow label="Utworzono" value={fmtDate(agency.createdAt)} />
              <InfoRow label="Aktualizacja" value={fmtDate(agency.updatedAt)} />
              <InfoRow label="Właściciel konta" value={agency.ownerName || `#${agency.ownerUserId}`} />
              <InfoRow label="Kierownik" value={agency.managerName || "—"} />
              {agency.address ? (
                <InfoRow label="Adres" value={<span className="inline-flex items-start gap-1"><MapPin size={12} className="mt-0.5" />{agency.address}</span>} />
              ) : null}
              {agency.website ? (
                <InfoRow label="WWW" value={<a href={agency.website} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">{agency.website}</a>} />
              ) : null}
              {agency.officePhone ? <InfoRow label="Telefon" value={agency.officePhone} /> : null}
              {agency.officeEmail ? <InfoRow label="E-mail" value={agency.officeEmail} /> : null}
            </div>
          )}

          <h3 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
            <Users size={12} /> Zespół ({agency.members.length})
          </h3>
          <div className="space-y-2">
            {agency.members.map((m) => (
              <div
                key={m.memberId}
                className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold">{m.user.name || m.user.email}</span>
                      <span className="font-mono text-[9px] text-[var(--eos-subtle)]">#{m.user.id}</span>
                      {m.isOfficeManager ? (
                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-600 dark:text-amber-400">
                          Kierownik biura
                        </span>
                      ) : null}
                      {m.status === "PENDING" ? (
                        <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-500">
                          Oczekuje
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-[var(--eos-muted)]">{m.titleLabel} · {m.user.email}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-[var(--eos-subtle)]">
                      <span>{m.user.activeOffers} ofert</span>
                      <span>{m.user.walletCredits} kred.</span>
                      <span>Ostatnie log.: {fmtDate(m.user.lastLoginAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    href={`/centrala/uzytkownicy?userId=${m.userId}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--eos-border)] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[var(--eos-muted)] hover:border-emerald-500/40"
                  >
                    <User size={10} /> Profil w centrali
                  </Link>
                  <Link
                    href={`/profil/${m.userId}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--eos-border)] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[var(--eos-muted)] hover:border-emerald-500/40"
                  >
                    <ExternalLink size={10} /> Profil publiczny
                  </Link>
                  <button
                    type="button"
                    onClick={() => onOpenMessages(m.userId, m.user.name)}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400"
                  >
                    <MessageSquare size={10} /> Czat
                  </button>
                </div>
              </div>
            ))}
          </div>

          {agency.recentOffers.length > 0 ? (
            <>
              <h3 className="mb-3 mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                <Building2 size={12} /> Ostatnie oferty
              </h3>
              <div className="space-y-1.5">
                {agency.recentOffers.slice(0, 8).map((o) => (
                  <Link
                    key={o.id}
                    href={`/oferta/${o.id}`}
                    target="_blank"
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--eos-border)] px-3 py-2 text-xs hover:border-emerald-500/30"
                  >
                    <span className="truncate font-semibold">{o.title}</span>
                    <span className="shrink-0 text-[var(--eos-subtle)]">{o.city}</span>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
