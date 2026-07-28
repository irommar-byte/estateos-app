import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDiscoveryActions } from '../../hooks/useDiscoveryActions';
import { dispatchIntelligenceDislikePrompt } from '../../lib/discovery/clientEvents';
import { shouldPromptCatalogDislikeViaBrain } from '../../utils/discoveryExperienceState';
import type { DiscoveryTasteAction } from '../../services/discoveryService';
import { DISCOVERY_COLORS } from './discoveryMotion';
import { useI18n } from '../../i18n';

type Variant = 'compact' | 'full';

type Props = {
  offerId: number | string;
  variant?: Variant;
  source?: string;
  trackOpen?: boolean;
  onRequireAuth?: () => void;
  isDark?: boolean;
  /** Pytanie o powód otwiera okienko mózgu (np. taśma Intelligence). */
  promptDislikeViaBrain?: boolean;
};

const ACTION_DEFS: Array<{
  type: Exclude<DiscoveryTasteAction, 'OPEN'>;
  labelKey: 'like' | 'dislike' | 'serious';
  Icon: typeof ThumbsUp;
  tone: 'like' | 'dislike' | 'serious';
}> = [
  { type: 'LIKE', labelKey: 'like', Icon: ThumbsUp, tone: 'like' },
  { type: 'DISLIKE', labelKey: 'dislike', Icon: ThumbsDown, tone: 'dislike' },
  { type: 'SERIOUS', labelKey: 'serious', Icon: Sparkles, tone: 'serious' },
];

const TONE = {
  like: { idle: 'rgba(52,211,153,0.18)', active: 'rgba(52,211,153,0.45)', icon: '#34D399' },
  dislike: { idle: 'rgba(251,113,133,0.16)', active: 'rgba(251,113,133,0.42)', icon: '#FB7185' },
  serious: { idle: 'rgba(251,191,36,0.16)', active: 'rgba(251,191,36,0.45)', icon: '#FBBF24' },
};

/**
 * Quiet taste controls for offer surfaces — WWW OfferDiscoveryActions parity.
 */
export default function OfferDiscoveryActions({
  offerId,
  variant = 'compact',
  source = 'mobile_offer_card',
  trackOpen = false,
  onRequireAuth,
  isDark = false,
  promptDislikeViaBrain = false,
}: Props) {
  const { t } = useI18n();
  const { record, lastAction, isBusy } = useDiscoveryActions();
  const [flash, setFlash] = useState<DiscoveryTasteAction | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const active = flash || lastAction(offerId);
  const id = Number(offerId);

  const dislikeReasons = [
    { code: 'PRICE_TOO_HIGH', label: t('discovery.dislike.price') },
    { code: 'LOCATION_MISMATCH', label: t('discovery.dislike.location') },
    { code: 'LAYOUT_MISMATCH', label: t('discovery.dislike.layout') },
    { code: 'QUALITY_LOW', label: t('discovery.dislike.quality') },
  ];

  const actions = ACTION_DEFS.map((action) => ({
    ...action,
    label: t(`discovery.actions.${action.labelKey}`),
  }));

  const theme = {
    pillBg: isDark ? 'rgba(44,52,60,0.86)' : 'rgba(241,245,249,0.95)',
    pillBorder: isDark ? 'rgba(179,193,207,0.2)' : 'rgba(17,24,39,0.12)',
    reasonsBg: isDark ? 'rgba(190,24,93,0.12)' : 'rgba(251,207,232,0.32)',
    reasonsBorder: isDark ? 'rgba(244,114,182,0.28)' : 'rgba(225,29,72,0.2)',
    reasonsText: isDark ? '#F9FAFB' : '#1F2937',
    closeIcon: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(31,41,55,0.58)',
    chipText: isDark ? DISCOVERY_COLORS.ivory : '#1F2937',
  };

  useEffect(() => {
    if (!trackOpen || !Number.isFinite(id) || id <= 0) return;
    void record({
      offerId: id,
      eventType: 'OPEN',
      source: source || 'mobile_offer_detail',
    });
  }, [trackOpen, id, record, source]);

  const commit = async (
    eventType: Exclude<DiscoveryTasteAction, 'OPEN'>,
    reasonCode?: string,
  ) => {
    if (!Number.isFinite(id) || id <= 0 || isBusy(id)) return;
    setFlash(eventType);
    setReasonOpen(false);
    void Haptics.selectionAsync();
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
    setTimeout(() => setFlash(null), 1600);
  };

  const handle = async (eventType: Exclude<DiscoveryTasteAction, 'OPEN'>) => {
    if (eventType === 'DISLIKE') {
      if (promptDislikeViaBrain) {
        if (!Number.isFinite(id) || id <= 0 || isBusy(id)) return;
        // Algorytm pyta rzadko (co 3. „nie dla mnie”) — inaczej zapisujemy od razu.
        if (shouldPromptCatalogDislikeViaBrain()) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          dispatchIntelligenceDislikePrompt({ offerId: id, source });
          return;
        }
        await commit('DISLIKE');
        return;
      }
      if (variant === 'full') {
        setReasonOpen(true);
        return;
      }
    }
    await commit(eventType);
  };

  const reasonSheet = reasonOpen ? (
    <View
      style={[
        styles.reasons,
        { borderColor: theme.reasonsBorder, backgroundColor: theme.reasonsBg },
      ]}
      accessibilityLabel={t('discovery.dislike.title')}
    >
      <View style={styles.reasonsHead}>
        <Text style={[styles.reasonsTitle, { color: theme.reasonsText }]}>{t('discovery.dislike.title')}</Text>
        <Pressable
          accessibilityLabel={t('discovery.closeA11y')}
          hitSlop={10}
          onPress={() => setReasonOpen(false)}
        >
          <Ionicons name="close" size={16} color={theme.closeIcon} />
        </Pressable>
      </View>
      <View style={styles.reasonsGrid}>
        {dislikeReasons.map((r) => (
          <Pressable
            key={r.code}
            disabled={isBusy(id)}
            style={[styles.chip, { backgroundColor: theme.pillBg, borderColor: theme.pillBorder }]}
            onPress={() => void commit('DISLIKE', r.code)}
          >
            <Text style={[styles.chipText, { color: theme.chipText }]}>{r.label}</Text>
          </Pressable>
        ))}
        <Pressable
          disabled={isBusy(id)}
          style={[styles.chip, styles.chipSkip, { backgroundColor: theme.pillBg, borderColor: theme.pillBorder }]}
          onPress={() => void commit('DISLIKE')}
        >
          <Text style={[styles.chipText, { color: theme.chipText }]}>{t('discovery.dislike.skipShort')}</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  if (variant === 'full') {
    return (
      <View style={styles.fullBar} accessibilityLabel={t('discovery.actions.like')}>
        <View style={styles.fullRow}>
          {actions.map(({ type, label, Icon, tone }) => {
            const isActive = active === type;
            const colors = TONE[tone];
            return (
              <Pressable
                key={type}
                disabled={isBusy(id)}
                accessibilityLabel={label}
                accessibilityState={{ selected: isActive }}
                onPress={() => void handle(type)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: isActive ? colors.active : theme.pillBg,
                    borderColor: isActive ? colors.icon : theme.pillBorder,
                  },
                ]}
              >
                <Icon size={16} color={colors.icon} />
                <Text style={[styles.pillLabel, { color: colors.icon }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {reasonSheet}
      </View>
    );
  }

  return (
    <View style={styles.tray} accessibilityLabel={t('discovery.actions.like')}>
      {actions.map(({ type, label, Icon, tone }) => {
        const isActive = active === type;
        const colors = TONE[tone];
        return (
          <Pressable
            key={type}
            disabled={isBusy(id)}
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}
            onPress={(e) => {
              e?.stopPropagation?.();
              void handle(type);
            }}
            style={[
              styles.iconBtn,
              {
                backgroundColor: isActive ? colors.active : 'rgba(8,10,14,0.72)',
                borderColor: isActive ? colors.icon : 'rgba(255,255,255,0.16)',
              },
            ]}
          >
            <Icon size={15} color={colors.icon} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(8,10,14,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fullBar: { gap: 10 },
  fullRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillLabel: { fontSize: 12, fontWeight: '800' },
  reasons: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  reasonsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reasonsTitle: { fontSize: 13, fontWeight: '800' },
  reasonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipSkip: {},
  chipText: { fontSize: 12, fontWeight: '700' },
});
