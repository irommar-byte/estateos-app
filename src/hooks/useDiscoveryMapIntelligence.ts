/**
 * For-you offer ids for map pin affinity.
 * Ambient whisper copy removed — floating Intelligence pulse is the single voice.
 */
import { useEffect, useMemo, useState } from 'react';
import { subscribeDiscoveryUpdated } from '../lib/discovery/clientEvents';
import { fetchDiscoveryForYou } from '../services/discoveryService';
import { useAuthStore } from '../store/useAuthStore';
import { useIntelligencePreferenceStore } from '../store/useIntelligencePreferenceStore';

export function useDiscoveryMapIntelligence(opts?: {
  transaction?: 'SALE' | 'RENT' | '';
  enabled?: boolean;
}) {
  const token = useAuthStore((s) => s.token);
  const intelligenceEnabled = useIntelligencePreferenceStore((s) => s.enabled);
  const hydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const active = opts?.enabled !== false && hydrated && intelligenceEnabled && Boolean(token);
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    if (!active || !token) {
      setIds([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const data = await fetchDiscoveryForYou(token, {
        limit: 24,
        transaction: opts?.transaction || '',
      });
      if (cancelled) return;
      setIds((data.items || []).map((item) => Number(item.offerId)).filter((n) => Number.isFinite(n) && n > 0));
    };
    void load();
    const unsub = subscribeDiscoveryUpdated(() => void load());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [active, opts?.transaction, token]);

  const forYouIds = useMemo(() => new Set(ids), [ids]);

  return { forYouIds, whisperBody: null as string | null, active };
}
