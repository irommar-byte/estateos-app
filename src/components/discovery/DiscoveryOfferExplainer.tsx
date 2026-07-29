import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Brain } from 'lucide-react-native';
import { fetchDiscoveryForYou } from '../../services/discoveryService';
import { useAuthStore } from '../../store/useAuthStore';
import { useIntelligencePreferenceStore } from '../../store/useIntelligencePreferenceStore';
import { subscribeDiscoveryUpdated } from '../../lib/discovery/clientEvents';
import { useI18n } from '../../i18n';
import { INTELLIGENCE_BRAIN_GLYPH_SOFT } from '../../lib/discovery/intelligenceBrand';

type Props = {
  offerId: number | string;
  isDark?: boolean;
  embedded?: boolean;
};

/**
 * One calm “why this listing” line on offer detail.
 */
function sentenceCase(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export default function DiscoveryOfferExplainer({ offerId, isDark = false, embedded = false }: Props) {
  const { t } = useI18n();
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

  const textMain = isDark ? 'rgba(229,236,241,0.94)' : 'rgba(28,28,30,0.86)';
  const badgeText = isDark ? 'rgba(245,245,247,0.78)' : 'rgba(28,28,30,0.72)';

  return (
    <View style={[styles.wrap, embedded ? styles.wrapEmbedded : null]}>
      <View style={styles.eyebrowRow}>
        <Brain size={11} color={isDark ? INTELLIGENCE_BRAIN_GLYPH_SOFT : '#1C1C1E'} strokeWidth={2.2} />
        <Text style={[styles.eyebrow, { color: badgeText }]}>{t('discovery.brand')}</Text>
      </View>
      <Text style={[styles.body, { color: textMain }]}>{sentenceCase(reason)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  wrapEmbedded: {
    marginBottom: 10,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  body: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
});
