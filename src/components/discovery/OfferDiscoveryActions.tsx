"use client";

import { useEffect, useState } from "react";
import { Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import {
  useDiscoveryActions,
  type DiscoveryUiAction,
} from "@/hooks/useDiscoveryActions";

type Variant = "compact" | "full";

type Props = {
  offerId: number | string;
  variant?: Variant;
  className?: string;
  source?: string;
  trackOpen?: boolean;
  onRequireAuth?: () => void;
};

const DISLIKE_REASONS: Array<{ code: string; label: string }> = [
  { code: "PRICE_TOO_HIGH", label: "Cena" },
  { code: "LOCATION_MISMATCH", label: "Lokalizacja" },
  { code: "LAYOUT_MISMATCH", label: "Układ" },
  { code: "QUALITY_LOW", label: "Jakość" },
];

const ACTIONS: Array<{
  type: Exclude<DiscoveryUiAction, "OPEN">;
  labelPl: string;
  Icon: typeof ThumbsUp;
  tone: "like" | "dislike" | "serious";
}> = [
  { type: "LIKE", labelPl: "Pasuje", Icon: ThumbsUp, tone: "like" },
  { type: "DISLIKE", labelPl: "Nie dla mnie", Icon: ThumbsDown, tone: "dislike" },
  { type: "SERIOUS", labelPl: "Na poważnie", Icon: Sparkles, tone: "serious" },
];

/**
 * Quiet, Apple-like taste controls for offer surfaces.
 * Dislike optionally opens a micro reason sheet (full) or fires plain DISLIKE (compact).
 */
export default function OfferDiscoveryActions({
  offerId,
  variant = "compact",
  className = "",
  source = "web_offer_card",
  trackOpen = false,
  onRequireAuth,
}: Props) {
  const { record, lastAction, isBusy } = useDiscoveryActions();
  const [flash, setFlash] = useState<DiscoveryUiAction | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const active = flash || lastAction(offerId);
  const id = Number(offerId);

  useEffect(() => {
    if (!trackOpen || !Number.isFinite(id) || id <= 0) return;
    void record({
      offerId: id,
      eventType: "OPEN",
      source: source || "web_offer_detail",
      onRequireAuth: undefined,
    });
  }, [trackOpen, id, record, source]);

  const commit = async (
    eventType: Exclude<DiscoveryUiAction, "OPEN">,
    reasonCode?: string,
  ) => {
    if (!Number.isFinite(id) || id <= 0 || isBusy(id)) return;
    setFlash(eventType);
    setReasonOpen(false);
    const result = await record({
      offerId: id,
      eventType,
      reasonCode,
      source,
      onRequireAuth,
    });
    if (!result.ok) {
      setFlash(null);
      return;
    }
    window.setTimeout(() => setFlash(null), 1600);
  };

  const handle = async (eventType: Exclude<DiscoveryUiAction, "OPEN">) => {
    if (eventType === "DISLIKE" && variant === "full") {
      setReasonOpen(true);
      return;
    }
    await commit(eventType);
  };

  const reasonSheet = reasonOpen ? (
    <div
      className="eos-discovery-reasons"
      role="dialog"
      aria-label="Dlaczego nie pasuje"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="eos-discovery-reasons__head">
        <span>Co nie pasuje?</span>
        <button
          type="button"
          aria-label="Zamknij"
          className="eos-discovery-reasons__close"
          onClick={() => setReasonOpen(false)}
        >
          <X size={14} />
        </button>
      </div>
      <div className="eos-discovery-reasons__grid">
        {DISLIKE_REASONS.map((r) => (
          <button
            key={r.code}
            type="button"
            disabled={isBusy(id)}
            className="eos-discovery-reasons__chip"
            onClick={() => void commit("DISLIKE", r.code)}
          >
            {r.label}
          </button>
        ))}
        <button
          type="button"
          disabled={isBusy(id)}
          className="eos-discovery-reasons__chip eos-discovery-reasons__chip--skip"
          onClick={() => void commit("DISLIKE")}
        >
          Pomiń
        </button>
      </div>
    </div>
  ) : null;

  if (variant === "full") {
    return (
      <div
        className={`eos-discovery-bar eos-discovery-bar--full ${className}`}
        role="group"
        aria-label="Twoja ocena oferty"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {ACTIONS.map(({ type, labelPl, Icon, tone }) => {
          const isActive = active === type;
          return (
            <button
              key={type}
              type="button"
              disabled={isBusy(id)}
              aria-pressed={isActive}
              aria-label={labelPl}
              onClick={() => void handle(type)}
              className={`eos-discovery-btn eos-discovery-btn--pill eos-discovery-btn--${tone} ${
                isActive ? "is-active" : ""
              }`}
            >
              <Icon size={16} className="eos-discovery-btn__icon" aria-hidden />
              <span className="eos-discovery-btn__label">{labelPl}</span>
            </button>
          );
        })}
        {reasonSheet}
      </div>
    );
  }

  return (
    <div
      className={`eos-discovery-tray ${className}`}
      role="group"
      aria-label="Oceń ofertę"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {ACTIONS.map(({ type, labelPl, Icon, tone }) => {
        const isActive = active === type;
        return (
          <button
            key={type}
            type="button"
            disabled={isBusy(id)}
            aria-pressed={isActive}
            aria-label={labelPl}
            title={labelPl}
            onClick={() => void handle(type)}
            className={`eos-discovery-btn eos-discovery-btn--icon eos-discovery-btn--${tone} ${
              isActive ? "is-active" : ""
            }`}
          >
            <Icon size={15} className="eos-discovery-btn__icon" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
