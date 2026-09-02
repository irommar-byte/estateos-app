"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Facebook, Repeat2 } from "lucide-react";
import { facebookSharerHref } from "@/lib/crm/marketingChannel";
import type { FacebookGroupDestination } from "@/lib/crm/marketingChannel";
import { eosBtn } from "@/components/ui/eosButtonStyles";

export type FacebookShareOffer = {
  id: number;
  title: string;
  city: string | null;
  price: number | null;
  imageUrl: string | null;
  linkedClientId: number | null;
};

type Props = {
  groups: FacebookGroupDestination[];
  offers: FacebookShareOffer[];
  currentOfferId: number | null;
  busy: boolean;
  onShare: (payload: {
    offerId: number;
    groupName: string;
    groupUrl: string | null;
    renewalDueAt?: string;
  }) => Promise<{
    shareUrl?: string;
    facebookHref?: string;
    groupUrl?: string | null;
  } | null>;
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("pl-PL");
}

export default function FacebookGroupPromotePanel({
  groups,
  offers,
  currentOfferId,
  busy,
  onShare,
}: Props) {
  const [pickedOfferId, setPickedOfferId] = useState<number | "">(
    currentOfferId || offers[0]?.id || "",
  );
  const [renewalDate, setRenewalDate] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const selectedOffer = useMemo(
    () => offers.find((item) => item.id === Number(pickedOfferId)) || null,
    [offers, pickedOfferId],
  );

  const launchShare = async (group: FacebookGroupDestination, offerId: number) => {
    setActiveKey(group.key);
    const result = await onShare({
      offerId,
      groupName: group.groupName,
      groupUrl: group.groupUrl,
      renewalDueAt: renewalDate ? new Date(`${renewalDate}T12:00:00`).toISOString() : undefined,
    });
    setActiveKey(null);
    if (!result?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(result.shareUrl);
    } catch {
      /* clipboard optional */
    }
    const groupHref = result.groupUrl || group.groupUrl;
    const facebookHref = result.facebookHref || facebookSharerHref(result.shareUrl);
    if (groupHref) window.open(groupHref, "_blank", "noopener,noreferrer");
    window.open(facebookHref, "_blank", "noopener,noreferrer");
  };

  if (!groups.length) {
    return (
      <div className="rounded-2xl border border-[#1877F2]/20 bg-[#1877F2]/[0.05] p-4">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#1877F2]">
          <Facebook className="size-3.5" /> Facebook · grupy
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--eos-muted)]">
          Gdy zapiszesz pierwszą publikację z linkiem do grupy Facebook, pojawi się tu
          jednoklikowe wystawianie kolejnych ogłoszeń na tych samych grupach.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#1877F2]/25 bg-[linear-gradient(180deg,rgba(24,119,242,0.12),rgba(24,119,242,0.04))] p-4 shadow-[0_16px_36px_rgba(24,119,242,0.12)]">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#1877F2]">
        <Facebook className="size-3.5" /> Szybkie wystawianie na grupach
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">
        Otwiera grupę i okno Facebooka z kartą ogłoszenia. Link wizytówki kopiujemy do schowka —
        wrzucasz go w grupie, a klient widzi to w ścieżce oferty.
      </p>

      {offers.length > 1 ? (
        <label className="mt-3 block">
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">
            Ogłoszenie
          </span>
          <select
            value={pickedOfferId}
            onChange={(e) => setPickedOfferId(e.target.value ? Number(e.target.value) : "")}
            className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
          >
            {offers.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.title}
                {offer.id === currentOfferId ? " · ta oferta" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="mt-3 flex items-center gap-2">
        <CalendarDays className="size-3.5 text-[#1877F2]" />
        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">
          Ponownie wystaw
        </span>
        <input
          type="date"
          value={renewalDate}
          onChange={(e) => setRenewalDate(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
        />
      </label>

      <div className="mt-3 space-y-2">
        {groups.map((group) => (
          <div
            key={group.key}
            className="flex flex-col gap-2 rounded-2xl border border-[#1877F2]/20 bg-[var(--eos-card)]/80 px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-[var(--eos-text)]">{group.groupName}</p>
              <p className="text-[11px] text-[var(--eos-muted)]">
                {group.postCount}× · ostatnio {formatWhen(group.lastPostedAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentOfferId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void launchShare(group, currentOfferId)}
                  className={eosBtn("secondary", { size: "sm" })}
                >
                  <Repeat2 className="size-3.5" />
                  {activeKey === group.key ? "Otwieram…" : "Tę ofertę"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy || !selectedOffer}
                onClick={() => selectedOffer && void launchShare(group, selectedOffer.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#1877F2] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50"
              >
                <Facebook className="size-3.5" />
                {selectedOffer && selectedOffer.id !== currentOfferId
                  ? "Inna oferta"
                  : "Wystaw"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
