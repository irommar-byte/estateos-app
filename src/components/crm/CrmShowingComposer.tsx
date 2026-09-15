"use client";

import { useMemo, useState } from "react";
import { Phone } from "lucide-react";
import { eosBtn } from "@/components/ui/eosButtonStyles";
import { PortalSourceBadge } from "@/components/crm/MatchImportAgentMeta";
import CrmPresentationOfferPick, { type PresentationPickOffer } from "@/components/crm/CrmPresentationOfferPick";
import type { ShowingCard } from "@/lib/crm/showingKind";
import { importPortalLabel } from "@/lib/crm/importPortalBadge";

function localDatetimeValue(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CrmShowingComposer({
  showing,
  quote,
  statusLabel,
  matches,
  managedOffers,
  selectedId,
  onSelectOffer,
  presentation,
  busy,
  onPropose,
  onRequestListing,
  onMarkHeld,
}: {
  showing: ShowingCard | null;
  quote?: string | null;
  statusLabel?: string | null;
  matches: Array<{
    id: number;
    score: number;
    notifiedAt: string | null;
    offer: PresentationPickOffer & { id: number; title: string };
  }>;
  managedOffers: PresentationPickOffer[];
  selectedId: string;
  onSelectOffer: (id: string) => void;
  presentation?: {
    startsAt: string;
    status: "confirmed" | "pending";
    reason: string | null;
    offerId?: number | null;
    proposedSlots?: string[];
    heldAt?: string | null;
  } | null;
  busy: boolean;
  onPropose: (slots: string[], notes?: string) => void;
  onRequestListing: (slots: string[], notes: string) => void;
  onMarkHeld: () => void;
}) {
  const [slot1, setSlot1] = useState("");
  const [slot2, setSlot2] = useState("");
  const [slot3, setSlot3] = useState("");
  const [notes, setNotes] = useState("");
  const [otherOpen, setOtherOpen] = useState(!showing);

  const slots = [slot1, slot2, slot3].filter(Boolean);
  const isoSlots = slots.map((value) => new Date(value).toISOString()).filter((value) => !Number.isNaN(new Date(value).getTime()));
  const sameOffer = Boolean(showing && presentation?.offerId === showing.offerId);
  const canPropose = isoSlots.length > 0 && Boolean(selectedId.trim());
  const listingKind = showing?.kind === "other_agent" || showing?.kind === "external_import";
  const importKind = showing?.kind === "own_import" || showing?.kind === "external_import";

  const pinnedMatch = useMemo(
    () => matches.find((row) => row.offer.id === showing?.offerId) || null,
    [matches, showing?.offerId],
  );

  return (
    <div id="crm-showing" className="space-y-3">
      {showing ? (
        <article className="overflow-hidden rounded-2xl border border-emerald-500/40 bg-emerald-500/8">
          <div className="flex gap-3 p-3">
            {showing.imageUrl ? (
              <img src={showing.imageUrl} alt="" className="h-24 w-28 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-xs font-black text-emerald-800">
                #{showing.offerId}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <PortalSourceBadge badge={showing.badge} url={showing.sourceUrl} />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  {showing.kindLabel}
                </span>
                {statusLabel ? (
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-900">
                    {statusLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-black leading-snug text-[var(--eos-text)]">
                #{showing.offerId} · {showing.title}
              </p>
              <p className="mt-1 text-[11px] text-[var(--eos-muted)]">
                {[showing.street, showing.city].filter(Boolean).join(", ")}
              </p>
              {quote ? (
                <p className="mt-2 rounded-xl bg-white/60 px-3 py-2 text-sm italic text-[var(--eos-text)]">
                  „{quote}”
                </p>
              ) : pinnedMatch ? (
                <p className="mt-2 text-sm italic text-[var(--eos-text)]">Klient kliknął „Chcę oglądać”.</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2 border-t border-emerald-500/20 px-3 py-3">
            {importKind && showing.sourcePhone ? (
              <p className="text-sm text-[var(--eos-text)]">
                Telefon ze snapshotu: <strong>{showing.sourcePhone}</strong>
                {showing.sourceAgencyName ? ` · ${showing.sourceAgencyName}` : ""}
                {showing.badge ? ` · ${importPortalLabel(showing.badge)}` : ""}
              </p>
            ) : null}
            {showing.kind === "other_agent" && showing.listingAgent ? (
              <p className="text-sm text-[var(--eos-text)]">
                Agent wystawiający:{" "}
                <strong>
                  {[showing.listingAgent.name, showing.listingAgent.companyName].filter(Boolean).join(" · ") ||
                    "konto EstateOS"}
                </strong>
                {showing.listingAgent.phone ? ` · ${showing.listingAgent.phone}` : ""}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {showing.canCallSource && showing.sourcePhone ? (
                <a href={`tel:${showing.sourcePhone}`} className={eosBtn("home", { size: "sm" })}>
                  <Phone className="size-3.5" />
                  Zadzwoń
                </a>
              ) : null}
              {showing.sourceUrl ? (
                <a href={showing.sourceUrl} target="_blank" rel="noreferrer" className={eosBtn("secondary", { size: "sm" })}>
                  Oryginał na portalu
                </a>
              ) : null}
            </div>
          </div>
        </article>
      ) : (
        <p className="text-xs text-[var(--eos-muted)]">
          Wybierz nieruchomość, której chce klient — albo inną z portfela.
        </p>
      )}

      {sameOffer && presentation && !presentation.heldAt ? (
        <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">Aktualny termin</p>
          <p className="mt-1 text-sm font-semibold">{new Date(presentation.startsAt).toLocaleString("pl-PL")}</p>
          <p className="mt-1 text-xs font-black uppercase tracking-wider text-emerald-700">
            {presentation.status === "pending" ? presentation.reason || "Termin wysłany" : "Potwierdzona"}
          </p>
          <button type="button" disabled={busy} onClick={onMarkHeld} className={`mt-2 ${eosBtn("home", { size: "sm" })}`}>
            Oznacz jako odbytą
          </button>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <input type="datetime-local" value={slot1} onChange={(e) => setSlot1(e.target.value)} className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm" />
        <input type="datetime-local" value={slot2} onChange={(e) => setSlot2(e.target.value)} className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm" />
        <input type="datetime-local" value={slot3} onChange={(e) => setSlot3(e.target.value)} className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm" />
      </div>
      <p className="text-[10px] text-[var(--eos-muted)]">2–3 terminy. Jeden slot działa tak jak dotychczas.</p>
      {listingKind ? (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Krótka wiadomość do agenta wystawiającego"
          className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm"
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {listingKind ? (
          <button
            type="button"
            disabled={busy || !canPropose}
            onClick={() => onRequestListing(isoSlots, notes.trim())}
            className={eosBtn("home")}
          >
            Poproś o pokaz
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !canPropose}
            onClick={() => onPropose(isoSlots, notes.trim() || undefined)}
            className={eosBtn("home")}
          >
            {showing?.kind === "own_import" || showing?.kind === "external_import"
              ? "Zaproponuj terminy kupującemu"
              : "Zaproponuj terminy"}
          </button>
        )}
      </div>

      <button type="button" onClick={() => setOtherOpen((open) => !open)} className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
        {otherOpen ? "Ukryj inną nieruchomość" : "Inna nieruchomość"}
      </button>
      {otherOpen ? (
        <div className="space-y-2 rounded-2xl border border-dashed border-[var(--eos-border)] p-3">
          <CrmPresentationOfferPick
            managedOffers={managedOffers}
            matches={matches}
            selectedId={selectedId}
            onSelect={onSelectOffer}
          />
          <input
            value={selectedId}
            onChange={(e) => onSelectOffer(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="Albo wpisz ID oferty"
            className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}

export { localDatetimeValue };
