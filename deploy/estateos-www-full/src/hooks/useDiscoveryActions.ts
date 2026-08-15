"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dispatchDiscoveryUpdated } from "@/lib/discovery/clientEvents";
import {
  peekTasteMemory,
  rememberTaste,
  subscribeTasteMemory,
} from "@/lib/discovery/tasteMemory";

export type DiscoveryUiAction = "LIKE" | "DISLIKE" | "SERIOUS" | "OPEN";

type RecordOptions = {
  offerId: number | string;
  eventType: DiscoveryUiAction;
  reasonCode?: string;
  source?: string;
  onRequireAuth?: () => void;
};

type RecordResult = {
  ok: boolean;
  authRequired?: boolean;
};

/**
 * Client helper for WWW Discovery decisions.
 * Posts to /api/discovery/events and broadcasts discovery:updated for Guide refresh.
 */
export function useDiscoveryActions() {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [lastByOffer, setLastByOffer] = useState(peekTasteMemory);
  const openSentRef = useRef<Set<number>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => subscribeTasteMemory(setLastByOffer), []);

  const record = useCallback(async (opts: RecordOptions): Promise<RecordResult> => {
    const id = Number(opts.offerId);
    if (!Number.isFinite(id) || id <= 0) return { ok: false };

    if (opts.eventType === "OPEN" && openSentRef.current.has(id)) {
      return { ok: true };
    }

    const flightKey = `${id}:${opts.eventType}`;
    if (inFlightRef.current.has(flightKey)) return { ok: false };
    inFlightRef.current.add(flightKey);
    setBusyKey(flightKey);

    try {
      const idempotencyKey =
        opts.eventType === "OPEN"
          ? `web-open-${id}-${new Date().toISOString().slice(0, 10)}`
          : `web-${opts.eventType.toLowerCase()}-${id}-${Date.now()}`;

      const res = await fetch("/api/discovery/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: opts.eventType,
          offerId: id,
          reasonCode: opts.reasonCode || undefined,
          source: opts.source || "web_offer_card",
          idempotencyKey,
        }),
      });

      if (res.status === 401) {
        opts.onRequireAuth?.();
        return { ok: false, authRequired: true };
      }
      if (!res.ok) return { ok: false };

      if (opts.eventType === "OPEN") {
        openSentRef.current.add(id);
      } else if (
        opts.eventType === "LIKE" ||
        opts.eventType === "DISLIKE" ||
        opts.eventType === "SERIOUS"
      ) {
        rememberTaste(id, opts.eventType);
      }
      dispatchDiscoveryUpdated({ offerId: id, eventType: opts.eventType });
      return { ok: true };
    } catch {
      return { ok: false };
    } finally {
      inFlightRef.current.delete(flightKey);
      setBusyKey((prev) => (prev === flightKey ? null : prev));
    }
  }, []);

  const lastAction = useCallback(
    (offerId: number | string) => {
      const id = Number(offerId);
      return Number.isFinite(id) ? lastByOffer[id] ?? null : null;
    },
    [lastByOffer],
  );

  const isBusy = useCallback(
    (offerId: number | string, eventType?: DiscoveryUiAction) => {
      const id = Number(offerId);
      if (!Number.isFinite(id)) return false;
      if (!eventType) return busyKey?.startsWith(`${id}:`) ?? false;
      return busyKey === `${id}:${eventType}`;
    },
    [busyKey],
  );

  return { record, lastAction, isBusy };
}
