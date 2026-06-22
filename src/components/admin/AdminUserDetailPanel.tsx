"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  BadgeCheck,
  Copy,
  Crown,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Radar,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import type { AdminUserDetail } from "@/lib/adminUserDetail";
import AdminWalletSection from "@/components/admin/AdminWalletSection";
import {
  labelPropertyType,
  labelSearchType,
  labelTransactionType,
  parseDistrictList,
} from "@/lib/adminUserDetail";

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 px-4 py-2.5 text-sm">
      <dt className="text-[var(--eos-muted)] shrink-0">{label}</dt>
      <dd className={`font-semibold text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
        {icon}
        {title}
      </h3>
      <div className="overflow-hidden rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] divide-y divide-[var(--eos-border)]">
        {children}
      </div>
    </section>
  );
}

function VerificationBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
        ok
          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-subtle)]"
      }`}
    >
      {ok ? <BadgeCheck size={10} /> : null}
      {label}
    </span>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pl-PL");
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return `${new Intl.NumberFormat("pl-PL").format(value)} PLN`;
}

function VerificationActionRow({
  label,
  verified,
  verifiedAt,
  disabledReason,
  busy,
  onVerify,
  onUnverify,
}: {
  label: string;
  verified: boolean;
  verifiedAt: string | null;
  disabledReason?: string | null;
  busy: boolean;
  onVerify: () => void;
  onUnverify: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--eos-text)]">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--eos-muted)]">
          {verified ? `Potwierdzono: ${formatDate(verifiedAt)}` : "Niepotwierdzone"}
        </p>
        {disabledReason ? <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">{disabledReason}</p> : null}
      </div>
      <div className="flex shrink-0 gap-2">
        {verified ? (
          <button
            type="button"
            disabled={busy}
            onClick={onUnverify}
            className="rounded-xl border border-[var(--eos-border)] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] transition hover:border-red-500/35 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
          >
            Cofnij
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || Boolean(disabledReason)}
            onClick={onVerify}
            className="inline-flex min-w-[9.5rem] items-center justify-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 transition hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-400"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : "Potwierdź ręcznie"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminUserDetailPanel({
  user,
  segmentLabel,
  portfolioValue,
  isDeleting,
  onClose,
  onTogglePro,
  onDelete,
  onOpenMessages,
  onVerificationChange,
}: {
  user: AdminUserDetail;
  segmentLabel: string;
  portfolioValue: number;
  isDeleting: boolean;
  onClose: () => void;
  onTogglePro: () => void;
  onDelete: () => void;
  onOpenMessages: () => void;
  onVerificationChange?: (patch: Pick<AdminUserDetail, "isVerified" | "emailVerifiedAt" | "phoneVerifiedAt">) => void;
}) {
  const [verifyBusy, setVerifyBusy] = useState<"email" | "phone" | null>(null);
  const legacyDistricts = parseDistrictList(user.legacyPreferences.searchDistricts);
  const emailOk = Boolean(user.emailVerifiedAt || user.isVerified);
  const phoneOk = Boolean(user.phoneVerifiedAt);

  const runVerification = async (channel: "email" | "phone", action: "verify" | "unverify") => {
    const channelLabel = channel === "email" ? "e-mail" : "telefon (SMS)";
    const actionLabel = action === "verify" ? "potwierdzić" : "cofnąć potwierdzenie";
    if (!confirm(`Czy na pewno chcesz ${actionLabel} ${channelLabel} użytkownika ${user.name || user.email}?`)) {
      return;
    }

    setVerifyBusy(channel);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channel, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        alert(data?.error || "Nie udało się zmienić statusu weryfikacji.");
        return;
      }
      onVerificationChange?.(data.verification);
    } catch {
      alert("Błąd sieci przy zmianie weryfikacji.");
    } finally {
      setVerifyBusy(null);
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(String(user.id));
    } catch {
      /* noop */
    }
  };

  return (
    <aside className="w-full shrink-0 rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-xl xl:sticky xl:top-[calc(var(--eos-nav-height)+0.75rem)] xl:max-h-[calc(100dvh-var(--eos-nav-height)-1.5rem)] xl:w-[480px] xl:overflow-y-auto xl:p-7">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] text-lg font-black text-[var(--eos-muted)]">
            {(user.name || user.email || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black leading-snug break-words" title={user.name || undefined}>
              {user.name || "Użytkownik"}
            </h2>
            <p className="mt-0.5 break-all text-xs font-medium text-[var(--eos-muted)]" title={user.email}>
              {user.email}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => void copyId()}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
              >
                ID {user.id}
                <Copy size={10} />
              </button>
              {user.role === "ADMIN" ? <VerificationBadge ok label="Admin" /> : null}
              {user.isPro ? <VerificationBadge ok label="PRO" /> : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[var(--eos-border)] p-2 text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
          aria-label="Zamknij panel"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        <VerificationBadge ok={emailOk} label={emailOk ? "E-mail OK" : "E-mail niepotw."} />
        <VerificationBadge ok={phoneOk} label={phoneOk ? "Telefon OK" : "Telefon niepotw."} />
        <VerificationBadge ok={user.isVerified} label={user.isVerified ? "Konto zweryf." : "Konto niezweryf."} />
      </div>

      <Section title="Konto" icon={<User size={12} className="text-emerald-500" />}>
        <InfoRow label="Segment" value={segmentLabel} />
        <InfoRow label="Rola" value={user.role} />
        <InfoRow label="Plan" value={user.planType || "—"} />
        <InfoRow label="Telefon" value={user.phone || "—"} mono />
        <InfoRow label="Firma / biuro" value={user.companyName || "—"} />
        <InfoRow label="NIP" value={user.nip || "—"} mono />
        <InfoRow label="Dodatkowe oferty" value={String(user.extraListings)} />
        <InfoRow label="PRO do" value={formatDate(user.proExpiresAt)} />
        <InfoRow label="PLUS do" value={formatDate(user.plusExpiresAt)} />
      </Section>

      <Section title="Weryfikacja" icon={<ShieldCheck size={12} className="text-emerald-500" />}>
        <VerificationActionRow
          label="E-mail"
          verified={emailOk}
          verifiedAt={user.emailVerifiedAt}
          disabledReason={!user.email?.trim() ? "Brak adresu e-mail w profilu" : null}
          busy={verifyBusy === "email"}
          onVerify={() => void runVerification("email", "verify")}
          onUnverify={() => void runVerification("email", "unverify")}
        />
        <VerificationActionRow
          label="Telefon (SMS)"
          verified={phoneOk}
          verifiedAt={user.phoneVerifiedAt}
          disabledReason={!user.phone?.trim() ? "Brak numeru telefonu w profilu" : null}
          busy={verifyBusy === "phone"}
          onVerify={() => void runVerification("phone", "verify")}
          onUnverify={() => void runVerification("phone", "unverify")}
        />
        <InfoRow label="Status konta (e-mail)" value={emailOk ? "Zweryfikowane" : "Niezweryfikowane"} />
        <InfoRow label="Status telefonu" value={phoneOk ? "Zweryfikowany" : "Niezweryfikowany"} />
      </Section>

      <Section title="Radar / Inteligentny Radar" icon={<Radar size={12} className="text-emerald-500" />}>
        {user.radar ? (
          <>
            <InfoRow
              label="Tryb kalibracji"
              value={user.radar.calibrationMode === "MAP" ? "Obszar na mapie" : user.radar.calibrationMode === "CITY" ? "Miasto + dzielnice" : "—"}
            />
            <InfoRow label="Transakcja" value={labelTransactionType(user.radar.transactionType)} />
            <InfoRow label="Typ nieruch." value={labelPropertyType(user.radar.propertyType)} />
            <InfoRow label="Miasto" value={user.radar.city || "—"} />
            <InfoRow
              label="Dzielnice"
              value={user.radar.selectedDistricts.length ? user.radar.selectedDistricts.join(", ") : "—"}
            />
            <InfoRow label="Max cena" value={formatMoney(user.radar.maxPrice)} />
            <InfoRow label="Min metraż" value={user.radar.minArea ? `${user.radar.minArea} m²` : "—"} />
            <InfoRow label="Min rok" value={user.radar.minYear ? String(user.radar.minYear) : "—"} />
            <InfoRow label="Próg dopasowania" value={`${user.radar.minMatchThreshold}% · ${user.radar.intelligenceLabel}`} />
            <InfoRow
              label="Mapa (lat/lng/r)"
              value={
                user.radar.lat != null && user.radar.lng != null
                  ? `${user.radar.lat.toFixed(4)}, ${user.radar.lng.toFixed(4)} · ${user.radar.radius ?? "—"} km`
                  : "—"
              }
            />
            <InfoRow
              label="Wymagania"
              value={
                [
                  user.radar.requireBalcony ? "balkon" : null,
                  user.radar.requireGarden ? "ogród" : null,
                  user.radar.requireElevator ? "winda" : null,
                  user.radar.requireParking ? "parking" : null,
                  user.radar.requireFurnished ? "umeblowane" : null,
                  user.radar.requireTwoLevel ? "dwupoziom" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <InfoRow label="Powiadomienia radaru" value={user.radar.pushNotifications ? "Włączone" : "Wyłączone"} />
          </>
        ) : (
          <div className="px-4 py-3 text-sm text-[var(--eos-muted)]">Brak zapisanej kalibracji radaru.</div>
        )}
      </Section>

      <Section title="Preferencje wstępne (onboarding)" icon={<MapPin size={12} className="text-emerald-500" />}>
        <InfoRow label="Typ poszukiwania" value={labelSearchType(user.legacyPreferences.searchType)} />
        <InfoRow label="Transakcja" value={user.legacyPreferences.searchTransactionType || "—"} />
        <InfoRow label="Typ kupującego" value={user.legacyPreferences.buyerType || "—"} />
        <InfoRow label="Dzielnice" value={legacyDistricts.length ? legacyDistricts.join(", ") : "—"} />
        <InfoRow label="Max cena" value={formatMoney(user.legacyPreferences.searchMaxPrice)} />
        <InfoRow
          label="Metraż"
          value={
            user.legacyPreferences.searchAreaFrom || user.legacyPreferences.searchAreaTo
              ? `${user.legacyPreferences.searchAreaFrom || "?"} – ${user.legacyPreferences.searchAreaTo || "?"} m²`
              : "—"
          }
        />
        <InfoRow label="Działka" value={user.legacyPreferences.searchPlotArea ? `${user.legacyPreferences.searchPlotArea} m²` : "—"} />
        <InfoRow label="Pokoje" value={user.legacyPreferences.searchRooms ? String(user.legacyPreferences.searchRooms) : "—"} />
        <InfoRow label="Udogodnienia" value={user.legacyPreferences.searchAmenities || "—"} />
      </Section>

      {user.discovery ? (
        <Section title="Odkrywaj (Discovery)" icon={<Activity size={12} className="text-emerald-500" />}>
          <InfoRow label="Polubienia" value={String(user.discovery.likesCount)} />
          <InfoRow label="Odrzucenia" value={String(user.discovery.dislikesCount)} />
          <InfoRow label="Fast track" value={String(user.discovery.fastTrackCount)} />
          <InfoRow label="Otwarcia" value={String(user.discovery.opensCount)} />
          <InfoRow label="Ostatnia aktualizacja" value={formatDate(user.discovery.updatedAt)} />
        </Section>
      ) : null}

      <Section title="Kanały / API / sieć" icon={<Globe size={12} className="text-emerald-500" />}>
        <InfoRow
          label="Kanały"
          value={user.channels.length ? user.channels.join(" · ") : "Brak aktywności"}
        />
        <InfoRow label="Sesje WWW" value={String(user.sessionsCount)} />
        <InfoRow label="Passkeys" value={String(user.passkeysCount)} />
        <InfoRow label="Ostatnie logowanie" value={formatDate(user.lastLoginAt)} />
        <InfoRow label="Ostatnie IP" value={user.lastLoginIp || "—"} mono />
        <InfoRow label="Ostatnia aktywność konta" value={formatDate(user.updatedAt)} />
      </Section>

      {user.devices.length > 0 ? (
        <Section title="Urządzenia mobilne" icon={<Smartphone size={12} className="text-emerald-500" />}>
          {user.devices.map((device) => (
            <div key={device.id} className="px-4 py-3 text-sm">
              <p className="font-bold text-[var(--eos-text)]">
                {device.platform}
                {device.deviceModel ? ` · ${device.deviceModel}` : ""}
                {!device.isActive ? " · nieaktywne" : ""}
              </p>
              <p className="mt-1 text-xs text-[var(--eos-muted)]">
                App {device.appVersion || "—"} · sync {formatDate(device.lastSyncedAt)}
              </p>
            </div>
          ))}
        </Section>
      ) : null}

      {user.radarHistory.length > 0 ? (
        <Section title="Historia radaru" icon={<Radar size={12} className="text-emerald-500" />}>
          {user.radarHistory.map((entry) => (
            <div key={entry.id} className="px-4 py-3 text-sm">
              <p className="font-semibold text-[var(--eos-text)]">
                {entry.city || "—"} · {labelTransactionType(entry.transactionType)} · {labelPropertyType(entry.propertyType)}
              </p>
              <p className="mt-1 text-xs text-[var(--eos-muted)]">
                {formatDate(entry.searchedAt)} · {entry.source}
                {entry.matchCount != null ? ` · ${entry.matchCount} trafień` : ""}
                {entry.radius != null ? ` · ${entry.radius} km` : ""}
              </p>
              {entry.queryText ? <p className="mt-1 text-[11px] text-[var(--eos-subtle)]">{entry.queryText}</p> : null}
            </div>
          ))}
        </Section>
      ) : null}

      <Section title="Kredyty i kupony" icon={<Wallet size={12} className="text-emerald-500" />}>
        <div className="px-4 py-4">
          <AdminWalletSection userId={user.id} initialSnapshot={user.wallet} />
        </div>
      </Section>

      <Section title="Aktywność" icon={<Activity size={12} className="text-emerald-500" />}>
        <InfoRow label="Rejestracja" value={formatDate(user.createdAt)} />
        <InfoRow label="Portfel (szac.)" value={`${new Intl.NumberFormat("pl-PL").format(portfolioValue)} PLN`} />
        <InfoRow label="Liczba ofert" value={String(user.offers.length)} />
      </Section>

      <div className="mb-6 space-y-2">
        <button
          type="button"
          onClick={onOpenMessages}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400"
        >
          <Mail size={16} /> Napisz wiadomość (Contact)
        </button>
        <a
          href={`mailto:${user.email}?subject=EstateOS — wiadomość od administratora`}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--eos-text)] py-3.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-bg)] hover:opacity-90"
        >
          <Mail size={16} /> Wyślij e-mail
        </a>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onTogglePro}
            className={`rounded-xl border py-3 text-[10px] font-black uppercase tracking-widest transition ${
              user.isPro
                ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-[var(--eos-border)] text-[var(--eos-muted)] hover:bg-[var(--eos-bg)]"
            }`}
          >
            {user.isPro ? "Odbierz PRO" : "Nadaj PRO"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="flex items-center justify-center gap-1 rounded-xl border border-red-500/30 py-3 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
          >
            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Usuń
          </button>
        </div>
      </div>

      {user.offers.length > 0 ? (
        <div>
          <h3 className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
            Oferty ({user.offers.length})
          </h3>
          <ul className="custom-scrollbar max-h-44 space-y-2 overflow-y-auto">
            {user.offers.map((off) => (
              <li
                key={off.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{off.title || `ID ${off.id}`}</p>
                  <p className="text-[9px] uppercase tracking-wider text-[var(--eos-subtle)]">{off.status}</p>
                </div>
                <Link
                  href={`/oferta/${off.id}`}
                  target="_blank"
                  className="rounded-lg border border-[var(--eos-border)] p-1.5 text-[var(--eos-muted)] hover:text-emerald-500"
                >
                  <ExternalLink size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
