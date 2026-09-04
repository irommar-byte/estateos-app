"use client";

import { useEffect, useMemo, useState } from "react";
import FacebookGroupPromotePanel, {
  type FacebookShareOffer,
} from "@/components/crm/FacebookGroupPromotePanel";
import type { FacebookGroupDestination } from "@/lib/crm/marketingChannel";
import { SELLER_EVENT_STAGE_LABELS } from "@/lib/crm/sellerEventStage";

type NextStep = {
  currentStep: string;
  nextAction: string;
  clientMessage: string | null;
  dueAt: string | null;
  visibleToClient: boolean;
} | null;

type SellerEventsBundle = {
  openHouse: {
    proposal: { id: number; title: string; status: string } | null;
    event: { id: number; status: string; startsAt: string | null; endsAt: string | null } | null;
  };
  auction: {
    proposal: { id: number; title: string; status: string } | null;
    event: {
      id: number;
      status: string;
      startsAt: string | null;
      endsAt: string | null;
      startPrice: number;
    } | null;
  };
  stage: { id: string; label: string; kind: "open_house" | "auction" | null } | null;
} | null;

type Props = {
  linkedOfferId: number | null;
  busy: boolean;
  sellerNextStep: NextStep;
  sellerEvents?: SellerEventsBundle;
  facebookGroups: FacebookGroupDestination[];
  facebookShareOffers: FacebookShareOffer[];
  onAction: (
    action: string,
    payload?: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null | undefined>;
  onToast: (message: string) => void;
};

function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toLocalDateTimeValue(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function stageChipClass(id: string | undefined) {
  switch (id) {
    case "pending_approval":
      return "bg-amber-500/15 text-amber-800 border-amber-500/30";
    case "live":
    case "upcoming":
      return "bg-emerald-500/15 text-emerald-800 border-emerald-500/30";
    case "rejected":
      return "bg-rose-500/15 text-rose-700 border-rose-500/30";
    case "ended":
      return "bg-[var(--eos-input)] text-[var(--eos-muted)] border-[var(--eos-border)]";
    default:
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/25";
  }
}

export default function CrmSellerCollaborationPanel({
  linkedOfferId,
  busy,
  sellerNextStep,
  sellerEvents = null,
  facebookGroups,
  facebookShareOffers,
  onAction,
  onToast,
}: Props) {
  const [portalLinkDraft, setPortalLinkDraft] = useState("");
  const [showPortalToClient, setShowPortalToClient] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextMessage, setNextMessage] = useState("");
  const [nextDueAt, setNextDueAt] = useState("");
  const [nextVisible, setNextVisible] = useState(true);
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionMessage, setDecisionMessage] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [eventMode, setEventMode] = useState<"open_house" | "auction" | null>(null);
  const [eventStartsAt, setEventStartsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(11, 0, 0, 0);
    return toLocalDateTimeValue(d);
  });
  const [eventEndsAt, setEventEndsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(14, 0, 0, 0);
    return toLocalDateTimeValue(d);
  });
  const [startPrice, setStartPrice] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [eventMessage, setEventMessage] = useState("");
  const [eventBusy, setEventBusy] = useState(false);

  useEffect(() => {
    setCurrentStep(sellerNextStep?.currentStep || "");
    setNextAction(sellerNextStep?.nextAction || "");
    setNextMessage(sellerNextStep?.clientMessage || "");
    setNextDueAt(toDateInput(sellerNextStep?.dueAt));
    setNextVisible(sellerNextStep?.visibleToClient !== false);
  }, [sellerNextStep]);

  const stage = sellerEvents?.stage || null;
  const previewMessage = useMemo(() => {
    if (!eventMode) return "";
    const when = eventStartsAt
      ? new Date(eventStartsAt).toLocaleString("pl-PL", {
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "…";
    if (eventMode === "open_house") {
      return (
        eventMessage.trim() ||
        `Proponuję dzień otwartych drzwi ${when}. Potwierdź termin, żebym mógł opublikować wydarzenie na ogłoszeniu.`
      );
    }
    const price = startPrice.trim()
      ? `${Number(startPrice).toLocaleString("pl-PL")} zł`
      : "…";
    return (
      eventMessage.trim() ||
      `Proponuję licytację od ${when}, cena startowa ${price}. Potwierdź warunki, żebym mógł opublikować wydarzenie na ogłoszeniu.`
    );
  }, [eventMode, eventStartsAt, eventMessage, startPrice]);

  const savePortal = async () => {
    const url = portalLinkDraft.trim();
    if (!url) return;
    if (showPortalToClient && !window.confirm("Klient zobaczy tę publikację w panelu. Kontynuować?")) {
      return;
    }
    const json = await onAction("add_external_portal", {
      url,
      visibleToClient: showPortalToClient,
    });
    if (json?.success) {
      setPortalLinkDraft("");
      onToast(
        showPortalToClient
          ? "Zapisano portal i pokazano klientowi."
          : "Zapisano szkic portalu. Klient go jeszcze nie widzi.",
      );
    }
  };

  const saveNextStep = async () => {
    if (!currentStep.trim() || !nextAction.trim()) {
      onToast("Uzupełnij obecny krok i następną akcję.");
      return;
    }
    const json = await onAction("set_seller_next_step", {
      currentStep: currentStep.trim(),
      nextAction: nextAction.trim(),
      clientMessage: nextMessage.trim() || null,
      dueAt: nextDueAt ? new Date(`${nextDueAt}T12:00:00`).toISOString() : null,
      visibleToClient: nextVisible,
    });
    if (json?.success) onToast("Plan współpracy zapisany.");
  };

  const requestDecision = async () => {
    if (!decisionTitle.trim() || !decisionMessage.trim()) {
      onToast("Wpisz tytuł i treść prośby o decyzję.");
      return;
    }
    const json = await onAction("request_client_decision", {
      kind: "other",
      title: decisionTitle.trim(),
      clientMessage: decisionMessage.trim(),
    });
    if (json?.success) {
      setDecisionTitle("");
      setDecisionMessage("");
      onToast("Wysłano prośbę o decyzję do klienta.");
    }
  };

  const proposeEvent = async () => {
    if (!linkedOfferId) {
      onToast("Najpierw powiąż aktywne ogłoszenie z klientem.");
      return;
    }
    if (!eventMode) return;
    if (!eventStartsAt || !eventEndsAt) {
      onToast("Uzupełnij datę i godziny.");
      return;
    }
    if (eventMode === "auction" && (!startPrice.trim() || Number(startPrice) <= 0)) {
      onToast("Podaj cenę startową licytacji.");
      return;
    }
    setEventBusy(true);
    try {
      const json = await onAction(
        eventMode === "auction" ? "propose_auction" : "propose_open_house",
        {
          startsAt: new Date(eventStartsAt).toISOString(),
          endsAt: new Date(eventEndsAt).toISOString(),
          startPrice: eventMode === "auction" ? Number(startPrice) : undefined,
          reservePrice:
            eventMode === "auction" && reservePrice.trim()
              ? Number(reservePrice)
              : undefined,
          clientMessage: eventMessage.trim() || null,
        },
      );
      if (json?.success) {
        setEventMode(null);
        setEventMessage("");
        setStartPrice("");
        setReservePrice("");
        onToast(
          eventMode === "auction"
            ? "Propozycja licytacji czeka na akceptację klienta."
            : "Propozycja dnia otwartego czeka na akceptację klienta.",
        );
      }
    } finally {
      setEventBusy(false);
    }
  };

  const promoteEstateos = async () => {
    if (!linkedOfferId) return;
    if (!window.confirm("Zużyć kredyt wyróżnienia i opublikować je na EstateOS™?")) return;
    setPromoting(true);
    try {
      const res = await fetch(`/api/offers/${linkedOfferId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się wyróżnić ogłoszenia.");
      const show = window.confirm(
        "Wyróżnienie zapisane prywatnie. Pokazać klientowi w ścieżce oferty?",
      );
      if (show) {
        await onAction("publish_latest_estateos_promotion", { offerId: linkedOfferId });
        onToast("Wyróżnienie EstateOS™ jest widoczne dla klienta.");
      } else {
        onToast("Wyróżnienie zapisane. Klient go jeszcze nie widzi.");
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Błąd wyróżnienia.");
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600">
          Inny portal
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">
          Wklej link z Otodom, OLX, Gratki albo z grupy Facebook. Domyślnie to szkic —
          klient zobaczy kartę dopiero po Twoim potwierdzeniu.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={portalLinkDraft}
            onChange={(e) => setPortalLinkDraft(e.target.value)}
            placeholder="https://www.otodom.pl/pl/oferta/… albo facebook.com/groups/…"
            className="min-w-0 flex-1 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)] outline-none focus:border-emerald-500/50"
          />
          <button
            type="button"
            disabled={busy || !portalLinkDraft.trim()}
            onClick={() => void savePortal()}
            className="rounded-full bg-emerald-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
          >
            {showPortalToClient ? "Zapisz i pokaż" : "Zapisz szkic"}
          </button>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-[var(--eos-text)]">
          <input
            type="checkbox"
            checked={showPortalToClient}
            onChange={(e) => setShowPortalToClient(e.target.checked)}
          />
          Pokaż klientowi od razu
        </label>
      </div>

      {linkedOfferId ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
            EstateOS™
          </p>
          <p className="mt-1 text-xs text-[var(--eos-muted)]">
            Wyróżnienie najpierw zostaje prywatne. Klient zobaczy je dopiero po potwierdzeniu.
          </p>
          <button
            type="button"
            disabled={busy || promoting}
            onClick={() => void promoteEstateos()}
            className="mt-3 rounded-full bg-[#C9A227] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#1c1408] disabled:opacity-50"
          >
            {promoting ? "Wyróżniam…" : "Wyróżnij na EstateOS™"}
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-[var(--eos-border)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">
            Plan: teraz / dalej
          </p>
          {stage ? (
            <span
              className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${stageChipClass(stage.id)}`}
            >
              {stage.kind === "auction" ? "Licytacja" : stage.kind === "open_house" ? "Dzień otwarty" : "Wydarzenie"}{" "}
              · {stage.label || SELLER_EVENT_STAGE_LABELS[stage.id as keyof typeof SELLER_EVENT_STAGE_LABELS]}
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={currentStep}
            onChange={(e) => setCurrentStep(e.target.value)}
            placeholder="Co teraz, np. Zdjęcia i opis"
            className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
          />
          <input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="Co dalej, np. Publikacja na Otodom"
            className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
          />
        </div>
        <textarea
          value={nextMessage}
          onChange={(e) => setNextMessage(e.target.value)}
          placeholder="Wiadomość widoczna dla klienta"
          rows={2}
          className="mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="date"
            value={nextDueAt}
            onChange={(e) => setNextDueAt(e.target.value)}
            className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
          />
          <label className="flex items-center gap-2 text-xs text-[var(--eos-text)]">
            <input
              type="checkbox"
              checked={nextVisible}
              onChange={(e) => setNextVisible(e.target.checked)}
            />
            Pokaż klientowi
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveNextStep()}
            className="rounded-full bg-[var(--eos-text)] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--eos-bg)] disabled:opacity-50"
          >
            Zapisz plan
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
            Wydarzenie sprzedaży
          </p>
          <p className="mt-1 text-xs text-[var(--eos-muted)]">
            Zaproponuj termin i warunki — klient zatwierdzi w panelu, potem wydarzenie pojawi się na ogłoszeniu.
          </p>
          {(sellerEvents?.openHouse.proposal || sellerEvents?.auction.proposal) ? (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-900">
              Czeka na akceptację klienta
              {sellerEvents?.auction.proposal
                ? `: ${sellerEvents.auction.proposal.title}`
                : sellerEvents?.openHouse.proposal
                  ? `: ${sellerEvents.openHouse.proposal.title}`
                  : ""}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !linkedOfferId || eventBusy}
              onClick={() => setEventMode(eventMode === "open_house" ? null : "open_house")}
              className="rounded-full border border-emerald-500/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 disabled:opacity-50"
            >
              Zaproponuj dzień otwarty
            </button>
            <button
              type="button"
              disabled={busy || !linkedOfferId || eventBusy}
              onClick={() => setEventMode(eventMode === "auction" ? null : "auction")}
              className="rounded-full border border-emerald-500/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 disabled:opacity-50"
            >
              Zaproponuj licytację
            </button>
          </div>

          {eventMode ? (
            <div className="mt-3 space-y-2 border-t border-emerald-500/15 pt-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-[var(--eos-muted)]">
                  Start
                  <input
                    type="datetime-local"
                    value={eventStartsAt}
                    onChange={(e) => setEventStartsAt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
                  />
                </label>
                <label className="text-xs text-[var(--eos-muted)]">
                  Koniec
                  <input
                    type="datetime-local"
                    value={eventEndsAt}
                    onChange={(e) => setEventEndsAt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
                  />
                </label>
              </div>
              {eventMode === "auction" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={startPrice}
                    onChange={(e) => setStartPrice(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="Cena startowa (zł)"
                    className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                  />
                  <input
                    value={reservePrice}
                    onChange={(e) => setReservePrice(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="Rezerwa (opcjonalnie)"
                    className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                  />
                </div>
              ) : null}
              <textarea
                value={eventMessage}
                onChange={(e) => setEventMessage(e.target.value)}
                placeholder="Wiadomość do klienta (opcjonalnie)"
                rows={2}
                className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
              />
              <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/60 px-3 py-2 text-xs text-[var(--eos-muted)]">
                <span className="font-bold text-[var(--eos-text)]">Podgląd dla klienta: </span>
                {previewMessage}
              </div>
              <button
                type="button"
                disabled={busy || eventBusy}
                onClick={() => void proposeEvent()}
                className="rounded-full bg-emerald-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
              >
                {eventBusy ? "Wysyłam…" : "Wyślij do akceptacji"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--eos-border)] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">
          Prośba o decyzję
        </p>
        <input
          value={decisionTitle}
          onChange={(e) => setDecisionTitle(e.target.value)}
          placeholder="Tytuł, np. Cena na Otodom"
          className="mt-3 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
        />
        <textarea
          value={decisionMessage}
          onChange={(e) => setDecisionMessage(e.target.value)}
          placeholder="Co klient ma potwierdzić"
          rows={2}
          className="mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void requestDecision()}
          className="mt-2 rounded-full border border-emerald-500/30 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 disabled:opacity-50"
        >
          Wyślij do klienta
        </button>
      </div>

      <FacebookGroupPromotePanel
        groups={facebookGroups}
        offers={facebookShareOffers}
        currentOfferId={linkedOfferId}
        busy={busy}
        onPrepare={async (payload) => {
          const json = await onAction("prepare_facebook_group_share", payload);
          if (!json?.success) return null;
          onToast("Otwarto Facebook. Wklej skopiowany link w grupie, potem potwierdź tutaj.");
          return json as { shareUrl?: string; facebookHref?: string; groupUrl?: string | null };
        }}
        onConfirm={async (payload) => {
          const json = await onAction("record_facebook_group_post", payload);
          if (!json?.success) return false;
          onToast(
            payload.visibleToClient
              ? "Zapisano link do posta na Facebooku. Klient otworzy ogłoszenie, nie samą grupę."
              : "Zapisano link do posta na Facebooku jako szkic.",
          );
          return true;
        }}
      />
    </div>
  );
}
