"use client";

import { useEffect, useState } from "react";
import FacebookGroupPromotePanel, {
  type FacebookShareOffer,
} from "@/components/crm/FacebookGroupPromotePanel";
import type { FacebookGroupDestination } from "@/lib/crm/marketingChannel";

type NextStep = {
  currentStep: string;
  nextAction: string;
  clientMessage: string | null;
  dueAt: string | null;
  visibleToClient: boolean;
} | null;

type Props = {
  linkedOfferId: number | null;
  busy: boolean;
  sellerNextStep: NextStep;
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

export default function CrmSellerCollaborationPanel({
  linkedOfferId,
  busy,
  sellerNextStep,
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

  useEffect(() => {
    setCurrentStep(sellerNextStep?.currentStep || "");
    setNextAction(sellerNextStep?.nextAction || "");
    setNextMessage(sellerNextStep?.clientMessage || "");
    setNextDueAt(toDateInput(sellerNextStep?.dueAt));
    setNextVisible(sellerNextStep?.visibleToClient !== false);
  }, [sellerNextStep]);

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
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">
          Plan dla klienta
        </p>
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
