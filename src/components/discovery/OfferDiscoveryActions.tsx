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
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDiscoveryActions } from '../../hooks/useDiscoveryActions';
import { dispatchIntelligenceDislikePrompt } from '../../lib/discovery/clientEvents';
import { shouldPromptCatalogDislikeViaBrain } from '../../utils/discoveryExperienceState';
import type { DiscoveryTasteAction } from '../../services/discoveryService';
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
}> = [
  { type: 'LIKE', labelKey: 'like', Icon: ThumbsUp },
  { type: 'DISLIKE', labelKey: 'dislike', Icon: ThumbsDown },
  { type: 'SERIOUS', labelKey: 'serious', Icon: Sparkles },
];

/** Black-glass taste chrome — WWW `.eos-discovery-btn` parity, no color disco. */
const LUX = {
  ink: '#0A0A0A',
  ivory: '#F5F5F7',
  iconIdle: 'rgba(255,255,255,0.94)',
  faceIdle: ['rgba(42,42,44,0.96)', 'rgba(8,8,8,0.94)'] as const,
  faceActive: ['#FFFFFF', '#E8E8ED'] as const,
  borderIdle: 'rgba(255,255,255,0.30)',
  borderActive: 'rgba(255,255,255,0.92)',
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
    <View style={styles.reasons} accessibilityLabel={t('discovery.dislike.title')}>
      <View style={styles.reasonsHead}>
        <Text style={styles.reasonsTitle}>{t('discovery.dislike.title')}</Text>
        <Pressable
          accessibilityLabel={t('discovery.closeA11y')}
          hitSlop={10}
          onPress={() => setReasonOpen(false)}
        >
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>
      <View style={styles.reasonsGrid}>
        {dislikeReasons.map((r) => (
          <Pressable
            key={r.code}
            disabled={isBusy(id)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            onPress={() => void commit('DISLIKE', r.code)}
          >
            <Text style={styles.chipText}>{r.label}</Text>
          </Pressable>
        ))}
        <Pressable
          disabled={isBusy(id)}
          style={({ pressed }) => [styles.chip, styles.chipSkip, pressed && styles.chipPressed]}
          onPress={() => void commit('DISLIKE')}
        >
          <Text style={[styles.chipText, styles.chipSkipText]}>{t('discovery.dislike.skipShort')}</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  if (variant === 'full') {
    return (
      <View style={styles.fullBar} accessibilityLabel={t('discovery.actions.like')}>
        <View style={styles.fullRow}>
          {actions.map(({ type, label, Icon }) => {
            const isActive = active === type;
            const ink = isActive ? LUX.ink : LUX.iconIdle;
            return (
              <Pressable
                key={type}
                disabled={isBusy(id)}
                accessibilityLabel={label}
                accessibilityState={{ selected: isActive }}
                onPress={() => void handle(type)}
                style={({ pressed }) => [
                  styles.pillOuter,
                  isActive && styles.pillOuterActive,
                  pressed && styles.pressedIn,
                ]}
              >
                <LinearGradient
                  colors={[...(isActive ? LUX.faceActive : LUX.faceIdle)]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={[
                    styles.pill,
                    {
                      borderColor: isActive ? LUX.borderActive : LUX.borderIdle,
                    },
                  ]}
                >
                  <View pointerEvents="none" style={styles.pillSheen} />
                  {isBusy(id) && isActive ? (
                    <ActivityIndicator size="small" color={ink} />
                  ) : (
                    <Icon size={14} color={ink} strokeWidth={2.15} />
                  )}
                  <Text
                    style={[styles.pillLabel, { color: ink }]}
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
    <View style={styles.trayOuter} accessibilityLabel={t('discovery.actions.like')}>
      <View style={styles.tray}>
        {Platform.OS === 'ios' ? (
          <BlurView
            pointerEvents="none"
            intensity={32}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {actions.map(({ type, label, Icon }) => {
          const isActive = active === type;
          const ink = isActive ? LUX.ink : LUX.iconIdle;
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
                styles.iconBtn,
                isActive && styles.iconBtnActive,
                pressed && !isActive && styles.iconBtnPressed,
                pressed && styles.pressedIn,
              ]}
            >
              {isBusy(id) && isActive ? (
                <ActivityIndicator size="small" color={ink} />
              ) : (
                <Icon size={15} color={ink} strokeWidth={2.1} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trayOuter: {
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 8,
  },
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconBtnActive: {
    backgroundColor: LUX.ivory,
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 7,
    ...Platform.select({
      android: { marginBottom: 1 },
      default: {},
    }),
  },
  pillOuterActive: {
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  pill: {
    flex: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 0,
  },
  pillSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  pillLabel: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  pressedIn: {
    transform: [{ translateY: 1 }, { scale: 0.97 }],
  },
  reasons: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(8,8,8,0.92)',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 10,
  },
  reasonsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reasonsTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  reasonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chipSkip: {
    borderStyle: 'dashed',
  },
  chipText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  chipSkipText: { color: 'rgba(255,255,255,0.55)' },
});
