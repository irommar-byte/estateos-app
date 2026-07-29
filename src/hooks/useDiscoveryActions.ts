import { useCallback, useRef, useState } from 'react';
import { dispatchDiscoveryUpdated } from '../lib/discovery/clientEvents';
import {
  postDiscoveryTasteEvent,
  type DiscoveryTasteAction,
} from '../services/discoveryService';
import { useAuthStore } from '../store/useAuthStore';

type RecordOptions = {
  offerId: number | string;
  eventType: DiscoveryTasteAction;
  reasonCode?: string;
  source?: string;
  onRequireAuth?: () => void;
};

type RecordResult = {
  ok: boolean;
  authRequired?: boolean;
};

/**
 * Mobile taste controls — posts to /api/mobile/v1/discovery/events (Bearer).
 */
export function useDiscoveryActions() {
  const token = useAuthStore((s) => s.token);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [lastByOffer, setLastByOffer] = useState<Record<number, DiscoveryTasteAction>>({});
  const openSentRef = useRef<Set<number>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());

  const record = useCallback(
    async (opts: RecordOptions): Promise<RecordResult> => {
      const id = Number(opts.offerId);
      if (!Number.isFinite(id) || id <= 0) return { ok: false };

      if (opts.eventType === 'OPEN' && openSentRef.current.has(id)) {
        return { ok: true };
      }

      const flightKey = `${id}:${opts.eventType}`;
      if (inFlightRef.current.has(flightKey)) return { ok: false };
      inFlightRef.current.add(flightKey);
      setBusyKey(flightKey);

      try {
        const result = await postDiscoveryTasteEvent({
          token,
          offerId: id,
          eventType: opts.eventType,
          reasonCode: opts.reasonCode,
          source: opts.source || 'mobile_offer_card',
        });

        if (result.authRequired) {
          opts.onRequireAuth?.();
          return { ok: false, authRequired: true };
        }
        if (!result.ok) return { ok: false };

        // SERIOUS/PRIORITY tropes are upserted server-side by
        // /api/mobile/v1/discovery/events — no second client write.

        if (opts.eventType === 'OPEN') {
          openSentRef.current.add(id);
        } else {
          setLastByOffer((prev) => ({ ...prev, [id]: opts.eventType }));
        }
        dispatchDiscoveryUpdated({ offerId: id, eventType: opts.eventType });
        return { ok: true };
      } catch {
        return { ok: false };
      } finally {
        inFlightRef.current.delete(flightKey);
        setBusyKey((prev) => (prev === flightKey ? null : prev));
      }
    },
    [token],
  );

  const lastAction = useCallback(
    (offerId: number | string) => {
      const id = Number(offerId);
      return Number.isFinite(id) ? lastByOffer[id] ?? null : null;
    },
    [lastByOffer],
  );

  const isBusy = useCallback(
    (offerId: number | string, eventType?: DiscoveryTasteAction) => {
      const id = Number(offerId);
      if (!Number.isFinite(id)) return false;
      if (!eventType) return busyKey?.startsWith(`${id}:`) ?? false;
      return busyKey === `${id}:${eventType}`;
    },
    [busyKey],
  );

  return { record, lastAction, isBusy };
}
