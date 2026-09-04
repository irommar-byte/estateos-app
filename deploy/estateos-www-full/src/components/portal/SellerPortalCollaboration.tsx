"use client";

import { useState } from "react";
import PortalPathStacks from "@/components/portal/PortalPathStacks";
import { type ListingPathEvent } from "@/components/portal/ListingPathEventCard";
import { parseSellerEventProposal } from "@/lib/crm/sellerEventStage";

type Channel = {
  portal: string;
  externalUrl: string | null;
  status: string | null;
  renewalDueAt: string | null;
  activityId: number;
};

type NextStep = {
  currentStep: string;
  nextAction: string;
  clientMessage: string | null;
  dueAt: string | null;
};

type Decision = {
  id: number;
  kind?: string;
  title: string;
  clientMessage: string;
  clientResponse?: string | null;
  dueAt: string | null;
  payload?: Record<string, unknown> | null;
};

type SellerEvents = {
  openHouse: {
    event: { id: number; status: string; startsAt: string | null; endsAt: string | null; title?: string | null } | null;
  };
  auction: {
    event: {
      id: number;
      status: string;
      startsAt: string | null;
      endsAt: string | null;
      startPrice: number;
      title?: string | null;
    } | null;
  };
  stage: { id: string; label: string; kind: "open_house" | "auction" | null } | null;
} | null;

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString("pl-PL")} zł`;
}

function countdownLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = target - Date.now();
  if (diff <= 0) return "Trwa lub właśnie wystartowało";
  const hours = Math.floor(diff / 3600_000);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `Za ${days} ${days === 1 ? "dzień" : "dni"}`;
  if (hours >= 1) return `Za ${hours} h`;
  const mins = Math.max(1, Math.floor(diff / 60_000));
  return `Za ${mins} min`;
}

export default function SellerPortalCollaboration({
  token,
  listingImage,
  listingPath,
  activeChannels,
  sellerNextStep,
  pendingDecisions,
  sellerEvents = null,
  listingHref,
  onDone,
}: {
  token: string;
  listingImage?: string | null;
  listingPath: ListingPathEvent[];
  activeChannels: Channel[];
  sellerNextStep: NextStep | null;
  pendingDecisions: Decision[];
  sellerEvents?: SellerEvents;
  listingHref?: string | null;
  onDone: () => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  const respond = async (
    decisionId: number,
    response: "approve" | "reject" | "comment",
  ) => {
    setBusyId(decisionId);
    setError("");
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond_decision",
          decisionId,
          response,
          comment: comments[decisionId] || "",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się zapisać odpowiedzi.");
      if (json.fulfillError) {
        setError(String(json.fulfillError));
      }
      setComments((current) => {
        const next = { ...current };
        delete next[decisionId];
        return next;
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    } finally {
      setBusyId(null);
    }
  };

  const confirmedOpenHouse = sellerEvents?.openHouse.event;
  const confirmedAuction = sellerEvents?.auction.event;
  const stage = sellerEvents?.stage;

  const hasWork =
    Boolean(sellerNextStep) ||
    pendingDecisions.length > 0 ||
    activeChannels.length > 0 ||
    listingPath.length > 0 ||
    Boolean(confirmedOpenHouse || confirmedAuction);

  if (!hasWork) {
    return (
      <section className="eos-lux-panel rounded-[1.75rem] p-6">
        <p className="eos-portal-label eos-portal-label--ok">Współpraca z agentem</p>
        <h2 className="mt-1 text-xl font-black text-[var(--eos-text)]">
          Plan promocji pojawi się tutaj
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
          Gdy agent ustali kolejny krok, poprosi o decyzję albo udostępni publikację,
          zobaczysz to w tym panelu — tak samo jak w aplikacji.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {sellerNextStep ? (
        <section className="eos-lux-panel rounded-[1.75rem] p-6">
          <p className="eos-portal-label eos-portal-label--ok">Co teraz / co dalej</p>
          <h2 className="mt-1 text-xl font-black text-[var(--eos-text)]">
            {sellerNextStep.currentStep}
          </h2>
          <p className="mt-2 text-sm font-semibold text-[var(--eos-text)]">
            {sellerNextStep.nextAction}
          </p>
          {sellerNextStep.clientMessage ? (
            <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
              {sellerNextStep.clientMessage}
            </p>
          ) : null}
          {sellerNextStep.dueAt ? (
            <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
              Do {formatDate(sellerNextStep.dueAt)}
            </p>
          ) : null}
        </section>
      ) : null}

      {(confirmedOpenHouse || confirmedAuction) &&
      stage &&
      stage.id !== "pending_approval" &&
      stage.id !== "rejected" ? (
        <section className="eos-lux-panel rounded-[1.75rem] border border-emerald-500/25 p-6">
          <p className="eos-portal-label eos-portal-label--ok">Wydarzenie sprzedaży</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-[var(--eos-text)]">
              {confirmedAuction ? "Licytacja" : "Dzień otwarty"}
            </h2>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-800">
              {stage.label}
            </span>
          </div>
          {confirmedAuction ? (
            <div className="mt-3 space-y-1 text-sm text-[var(--eos-text)]">
              <p className="text-2xl font-black">{formatDateTime(confirmedAuction.startsAt)}</p>
              <p className="text-[var(--eos-muted)]">
                do {formatDateTime(confirmedAuction.endsAt)}
              </p>
              <p className="font-semibold">
                Cena startowa: {formatMoney(confirmedAuction.startPrice)}
              </p>
              <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                {countdownLabel(confirmedAuction.startsAt)}
              </p>
            </div>
          ) : confirmedOpenHouse ? (
            <div className="mt-3 space-y-1 text-sm text-[var(--eos-text)]">
              <p className="text-2xl font-black">{formatDateTime(confirmedOpenHouse.startsAt)}</p>
              {confirmedOpenHouse.endsAt ? (
                <p className="text-[var(--eos-muted)]">
                  do {formatDateTime(confirmedOpenHouse.endsAt)}
                </p>
              ) : null}
              <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                {countdownLabel(confirmedOpenHouse.startsAt)}
              </p>
            </div>
          ) : null}
          {listingHref ? (
            <a
              href={listingHref}
              className="mt-4 inline-flex rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black"
            >
              Zobacz ogłoszenie
            </a>
          ) : null}
        </section>
      ) : null}

      {pendingDecisions.length ? (
        <section className="eos-lux-panel rounded-[1.75rem] p-6">
          <p className="eos-portal-label eos-portal-label--ok">Decyzje do potwierdzenia</p>
          <div className="mt-4 space-y-4">
            {pendingDecisions.map((item) => {
              const proposal = parseSellerEventProposal(item.payload);
              const isEvent =
                item.kind === "open_house" ||
                item.kind === "auction" ||
                Boolean(proposal);
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 ${
                    isEvent
                      ? "border-amber-500/35 bg-amber-500/[0.08]"
                      : "border-[var(--eos-border)] bg-[var(--eos-input)]/40"
                  }`}
                >
                  {isEvent ? (
                    <>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">
                        Wydarzenie sprzedaży · do akceptacji
                      </p>
                      <h3 className="mt-1 text-lg font-black text-[var(--eos-text)]">
                        {proposal?.kind === "auction" || item.kind === "auction"
                          ? "Licytacja"
                          : "Dzień otwarty"}
                      </h3>
                      <p className="mt-2 text-2xl font-black text-[var(--eos-text)]">
                        {formatDateTime(
                          proposal?.startsAt ||
                            proposal?.slots?.[0]?.startsAt ||
                            null,
                        ) || item.title}
                      </p>
                      {(proposal?.endsAt || proposal?.slots?.[0]?.endsAt) ? (
                        <p className="mt-1 text-sm text-[var(--eos-muted)]">
                          do{" "}
                          {formatDateTime(
                            proposal?.endsAt || proposal?.slots?.[0]?.endsAt,
                          )}
                        </p>
                      ) : null}
                      {proposal?.kind === "auction" && proposal.startPrice != null ? (
                        <p className="mt-2 text-sm font-semibold text-[var(--eos-text)]">
                          Cena startowa: {formatMoney(proposal.startPrice)}
                          {proposal.reservePrice != null
                            ? ` · rezerwa ${formatMoney(proposal.reservePrice)}`
                            : ""}
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
                        {item.clientMessage}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-base font-black text-[var(--eos-text)]">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--eos-muted)]">
                        {item.clientMessage}
                      </p>
                    </>
                  )}
                  {item.clientResponse ? (
                    <p className="mt-2 text-sm text-[var(--eos-text)]">
                      Twój ostatni komentarz: {item.clientResponse}
                    </p>
                  ) : null}
                  {item.dueAt ? (
                    <p className="mt-2 text-xs font-black uppercase tracking-wider text-amber-700">
                      Do {formatDate(item.dueAt)}
                    </p>
                  ) : null}
                  <textarea
                    value={comments[item.id] || ""}
                    onChange={(e) =>
                      setComments((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder={
                      isEvent
                        ? "Inny termin / inna cena (opcjonalnie)"
                        : "Komentarz (opcjonalnie)"
                    }
                    className="mt-3 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                    rows={2}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void respond(item.id, "approve")}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                    >
                      Akceptuję
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void respond(item.id, "reject")}
                      className="rounded-full border border-[var(--eos-border)] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--eos-text)] disabled:opacity-50"
                    >
                      {isEvent ? "Poproszę o inny termin" : "Odrzucam"}
                    </button>
                    {(comments[item.id] || "").trim() ? (
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void respond(item.id, "comment")}
                        className="rounded-full border border-emerald-500/30 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 disabled:opacity-50"
                      >
                        Wyślij komentarz
                      </button>
                    ) : null}
                    {isEvent ? (
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void respond(item.id, "reject")}
                        className="rounded-full border border-rose-500/20 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-rose-700 disabled:opacity-50"
                      >
                        Nie teraz
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        </section>
      ) : null}

      {activeChannels.length > 0 && !listingPath.some((item) => {
        const kind = String(item.kind || "").toUpperCase();
        return (
          kind === "ESTATEOS_ACTIVATED" ||
          kind === "ESTATEOS_PROMOTED" ||
          kind === "LISTING_FEATURED" ||
          kind.startsWith("EXTERNAL_PORTAL")
        );
      }) ? (
        <section className="eos-lux-panel rounded-[1.75rem] p-6">
          <p className="eos-portal-label eos-portal-label--ok">Aktywne kanały</p>
          <div className="mt-4 space-y-2">
            {activeChannels.map((channel) => (
              <div
                key={`${channel.activityId}-${channel.portal}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--eos-border)] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-black text-[var(--eos-text)]">{channel.portal}</p>
                  {channel.renewalDueAt ? (
                    <p className="text-xs text-[var(--eos-muted)]">
                      Odnowienie: {formatDate(channel.renewalDueAt)}
                    </p>
                  ) : null}
                </div>
                {channel.externalUrl ? (
                  <a
                    href={channel.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-black uppercase tracking-wider text-emerald-700"
                  >
                    Otwórz
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {listingPath.length ? (
        <section className="eos-lux-panel rounded-[1.75rem] p-6">
          <p className="eos-portal-label eos-portal-label--ok">Ścieżka oferty</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--eos-muted)]">
            Promocje, raporty i pozostałe kroki są zebrane w stosy — rozwiń kartę, żeby zobaczyć każdy wpis.
          </p>
          <div className="mt-4">
            <PortalPathStacks
              token={token}
              listingPath={listingPath}
              listingImage={listingImage}
              activePortals={activeChannels.map((channel) => channel.portal)}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
