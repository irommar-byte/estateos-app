"use client";

import { useEffect, useState } from "react";
import { Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
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
  /** Fire OPEN once when the surface mounts (detail page). */
  trackOpen?: boolean;
  onRequireAuth?: () => void;
};

const ACTIONS: Array<{
  type: Exclude<DiscoveryUiAction, "OPEN">;
  labelPl: string;
  labelEn: string;
  Icon: typeof ThumbsUp;
  tone: "like" | "dislike" | "serious";
}> = [
  { type: "LIKE", labelPl: "Pasuje", labelEn: "Like", Icon: ThumbsUp, tone: "like" },
  { type: "DISLIKE", labelPl: "Nie dla mnie", labelEn: "Pass", Icon: ThumbsDown, tone: "dislike" },
  { type: "SERIOUS", labelPl: "Na poważnie", labelEn: "Serious", Icon: Sparkles, tone: "serious" },
];

/**
 * Quiet, Apple-like taste controls for offer surfaces.
 * Compact: glass capsule on card photo (hover / touch).
 * Full: labeled pills for offer detail.
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

  const handle = async (eventType: Exclude<DiscoveryUiAction, "OPEN">) => {
    if (!Number.isFinite(id) || id <= 0 || isBusy(id)) return;
    setFlash(eventType);
    const result = await record({
      offerId: id,
      eventType,
      source,
      onRequireAuth,
    });
    if (!result.ok) {
      setFlash(null);
      return;
    }
    window.setTimeout(() => setFlash(null), 1600);
  };

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
