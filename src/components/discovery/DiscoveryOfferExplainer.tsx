import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { fetchDiscoveryForYou } from '../../services/discoveryService';
import { useAuthStore } from '../../store/useAuthStore';
import { useIntelligencePreferenceStore } from '../../store/useIntelligencePreferenceStore';
import { subscribeDiscoveryUpdated } from '../../lib/discovery/clientEvents';

type Props = {
  offerId: number | string;
};

/**
 * One calm “why this listing” line on offer detail.
 */
export default function DiscoveryOfferExplainer({ offerId }: Props) {
  const token = useAuthStore((s) => s.token);
  const enabled = useIntelligencePreferenceStore((s) => s.enabled);
  const hydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !enabled || !token) {
      setReason(null);
      return;
    }
    const id = Number(offerId);
    if (!Number.isFinite(id) || id <= 0) return;
    let cancelled = false;

    const load = async () => {
      const data = await fetchDiscoveryForYou(token, { offerId: id, limit: 1 });
      if (cancelled) return;
      const line = data?.explain?.reason || null;
      if (typeof line === 'string' && line.trim()) setReason(line.trim());
      else setReason(null);
    };

    void load();
    const unsub = subscribeDiscoveryUpdated(() => void load());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [offerId, enabled, hydrated, token]);

  if (!hydrated || !enabled || !reason) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.eyebrowRow}>
        <Sparkles size={11} color="rgba(52,211,153,0.9)" />
        <Text style={styles.eyebrow}>EstateOS™ Inteligence</Text>
      </View>
      <Text style={styles.body}>{reason}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(16,185,129,0.2)',
    backgroundColor: 'rgba(16,185,129,0.07)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    color: 'rgba(52,211,153,0.9)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  body: {
    marginTop: 6,
    color: 'rgba(245,245,247,0.82)',
    fontSize: 14,
    lineHeight: 20,
  },
});
