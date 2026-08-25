import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { subscribeDiscoveryUpdated } from '../lib/discovery/clientEvents';
import { fetchDiscoveryPulse, FALLBACK_DISCOVERY_PULSE, type DiscoveryPulsePayload } from '../services/discoveryService';
import { useAuthStore } from '../store/useAuthStore';
import { useIntelligencePreferenceStore } from '../store/useIntelligencePreferenceStore';

export type PulsePresentKind = 'progress' | 'milestone' | 'contradiction' | 'ready_peek' | 'manual';

type PulseChangeMeta = {
  previous: DiscoveryPulsePayload | null;
  next: DiscoveryPulsePayload;
  silent: boolean;
};

/**
 * Lite pulse for Intelligence tape — same /api/discovery/pulse as WWW.
 * Quiet when Intelligence is off or user is logged out.
 */
export function useDiscoveryPulse(opts?: {
  onPulseChange?: (meta: PulseChangeMeta) => void;
}) {
  const onPulseChange = opts?.onPulseChange;
  const token = useAuthStore((s) => s.token);
  const enabled = useIntelligencePreferenceStore((s) => s.enabled);
  const hydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const [pulse, setPulse] = useState<DiscoveryPulsePayload | null>(null);
  const prevRef = useRef<DiscoveryPulsePayload | null>(null);

  const reload = useCallback(
    async (silent = false) => {
      if (!hydrated || !enabled || !token) {
        setPulse(null);
        prevRef.current = null;
        return;
      }
      const next = (await fetchDiscoveryPulse(token)) || FALLBACK_DISCOVERY_PULSE;
      const previous = prevRef.current;
      onPulseChange?.({ previous, next, silent });
      prevRef.current = next;
      setPulse(next);
    },
    [enabled, hydrated, onPulseChange, token],
  );

  useEffect(() => {
    void reload(false);
  }, [reload]);

  useEffect(() => subscribeDiscoveryUpdated(() => void reload(true)), [reload]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload(true);
    });
    return () => sub.remove();
  }, [reload]);

  return { pulse, reload, ready: hydrated && enabled && Boolean(token) };
}
