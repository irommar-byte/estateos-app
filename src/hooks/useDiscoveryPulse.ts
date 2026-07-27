import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { fetchDiscoveryPulse, type DiscoveryPulsePayload } from '../services/discoveryService';
import { useAuthStore } from '../store/useAuthStore';
import { useIntelligencePreferenceStore } from '../store/useIntelligencePreferenceStore';

/**
 * Lite pulse for Inteligence tape — same /api/discovery/pulse as WWW.
 * Quiet when Inteligence is off or user is logged out.
 */
export function useDiscoveryPulse() {
  const token = useAuthStore((s) => s.token);
  const enabled = useIntelligencePreferenceStore((s) => s.enabled);
  const hydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const [pulse, setPulse] = useState<DiscoveryPulsePayload | null>(null);

  const reload = useCallback(async () => {
    if (!hydrated || !enabled || !token) {
      setPulse(null);
      return;
    }
    const next = await fetchDiscoveryPulse(token);
    setPulse(next);
  }, [enabled, hydrated, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => sub.remove();
  }, [reload]);

  return { pulse, reload, ready: hydrated && enabled && Boolean(token) };
}
