import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

type ActionIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const ACTION_DEFS: Array<{
  type: Exclude<DiscoveryTasteAction, 'OPEN'>;
  labelKey: 'like' | 'dislike' | 'serious';
  Icon: ActionIcon;
  tone: 'like' | 'dislike' | 'serious';
}> = [
  { type: 'LIKE', labelKey: 'like', Icon: ThumbsUp, tone: 'like' },
  { type: 'DISLIKE', labelKey: 'dislike', Icon: ThumbsDown, tone: 'dislike' },
  { type: 'SERIOUS', labelKey: 'serious', Icon: Sparkles, tone: 'serious' },
];

const TONE = {
  like: {
    icon: '#059669',
    iconDark: '#34D399',
    shadow: '#10B981',
    face: ['#ECFDF5', '#D1FAE5', '#A7F3D0'] as const,
    faceDark: ['#064E3B', '#065F46', '#047857'] as const,
    faceActive: ['#6EE7B7', '#34D399', '#10B981'] as const,
    rim: 'rgba(16,185,129,0.55)',
    rimDark: 'rgba(52,211,153,0.45)',
  },
  dislike: {
    icon: '#E11D48',
    iconDark: '#FB7185',
    shadow: '#F43F5E',
    face: ['#FFF1F2', '#FFE4E6', '#FECDD3'] as const,
    faceDark: ['#4C0519', '#9F1239', '#BE123C'] as const,
    faceActive: ['#FDA4AF', '#FB7185', '#F43F5E'] as const,
    rim: 'rgba(244,63,94,0.5)',
    rimDark: 'rgba(251,113,133,0.45)',
  },
  serious: {
    icon: '#D97706',
    iconDark: '#FBBF24',
    shadow: '#F59E0B',
    face: ['#FFFBEB', '#FEF3C7', '#FDE68A'] as const,
    faceDark: ['#451A03', '#92400E', '#B45309'] as const,
    faceActive: ['#FCD34D', '#FBBF24', '#F59E0B'] as const,
    rim: 'rgba(245,158,11,0.55)',
    rimDark: 'rgba(251,191,36,0.45)',
  },
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
    reasonsBg: isDark ? 'rgba(190,24,93,0.12)' : 'rgba(251,207,232,0.32)',
    reasonsBorder: isDark ? 'rgba(244,114,182,0.28)' : 'rgba(225,29,72,0.2)',
    reasonsText: isDark ? '#F9FAFB' : '#1F2937',
    closeIcon: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(31,41,55,0.58)',
    chipText: isDark ? DISCOVERY_COLORS.ivory : '#1F2937',
    chipFace: isDark
      ? (['#2C2C2E', '#1C1C1E', '#111113'] as const)
      : (['#FFFFFF', '#F3F4F6', '#E5E7EB'] as const),
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
            style={({ pressed }) => [styles.chipOuter, pressed && styles.pressedIn]}
            onPress={() => void commit('DISLIKE', r.code)}
          >
            <LinearGradient
              colors={[...theme.chipFace]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.chip, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}
            >
              <Text style={[styles.chipText, { color: theme.chipText }]}>{r.label}</Text>
            </LinearGradient>
          </Pressable>
        ))}
        <Pressable
          disabled={isBusy(id)}
          style={({ pressed }) => [styles.chipOuter, pressed && styles.pressedIn]}
          onPress={() => void commit('DISLIKE')}
        >
          <LinearGradient
            colors={[...theme.chipFace]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.chip, styles.chipSkip, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}
          >
            <Text style={[styles.chipText, { color: theme.chipText }]}>{t('discovery.dislike.skipShort')}</Text>
          </LinearGradient>
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
            const face = isActive
              ? colors.faceActive
              : isDark
                ? colors.faceDark
                : colors.face;
            const iconColor = isDark ? colors.iconDark : colors.icon;
            const iconSize = 14;
            return (
              <Pressable
                key={type}
                disabled={isBusy(id)}
                accessibilityLabel={label}
                accessibilityState={{ selected: isActive }}
                onPress={() => void handle(type)}
                style={({ pressed }) => [
                  styles.pillOuter,
                  {
                    shadowColor: colors.shadow,
                    shadowOpacity: isActive ? 0.42 : isDark ? 0.35 : 0.28,
                  },
                  pressed && styles.pressedIn,
                ]}
              >
                <LinearGradient
                  colors={[...face]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={[
                    styles.pill,
                    {
                      borderColor: isDark ? colors.rimDark : colors.rim,
                      borderTopColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.95)',
                      borderBottomColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)',
                    },
                  ]}
                >
                  {isBusy(id) && isActive ? (
                    <ActivityIndicator size="small" color={iconColor} />
                  ) : (
                    <Icon size={iconSize} color={iconColor} strokeWidth={2.4} />
                  )}
                  <Text
                    style={[styles.pillLabel, { color: iconColor }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {label}
                  </Text>
                </LinearGradient>
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
        const face = isActive
          ? colors.faceActive
          : isDark
            ? colors.faceDark
            : colors.face;
        const iconColor = isDark ? colors.iconDark : colors.icon;
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
            style={({ pressed }) => [
              styles.iconBtnOuter,
              {
                shadowColor: colors.shadow,
                shadowOpacity: isActive ? 0.4 : 0.28,
              },
              pressed && styles.pressedIn,
            ]}
          >
            <LinearGradient
              colors={[...face]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[
                styles.iconBtn,
                {
                  borderColor: isDark ? colors.rimDark : colors.rim,
                  borderTopColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.9)',
                },
              ]}
            >
                    <Icon size={14} color={iconColor} strokeWidth={2.4} />
            </LinearGradient>
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
  iconBtnOuter: {
    borderRadius: 17,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fullBar: { gap: 10 },
  fullRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
    gap: 6,
    width: '100%',
  },
  pillOuter: {
    flex: 1,
    minWidth: 0,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 8,
    elevation: 6,
    ...Platform.select({
      android: { marginBottom: 1 },
      default: {},
    }),
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 0,
  },
  pillLabel: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(255,255,255,0.35)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 0.5,
  },
  pressedIn: {
    transform: [{ translateY: 1 }, { scale: 0.97 }],
    shadowOpacity: 0.14,
  },
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
  chipOuter: {
    borderRadius: 999,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 3,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.85)',
  },
  chipSkip: {},
  chipText: { fontSize: 12, fontWeight: '700' },
});
