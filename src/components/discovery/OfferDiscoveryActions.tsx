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
import { Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDiscoveryActions } from '../../hooks/useDiscoveryActions';
import { dispatchIntelligenceDislikePrompt } from '../../lib/discovery/clientEvents';
import { shouldPromptCatalogDislikeViaBrain } from '../../utils/discoveryExperienceState';
import type { DiscoveryTasteAction } from '../../services/discoveryService';
import { useI18n } from '../../i18n';
import TasteConfettiBurst from './TasteConfettiBurst';

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

type ActionIcon = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}>;

const ACTION_DEFS: Array<{
  type: Exclude<DiscoveryTasteAction, 'OPEN'>;
  labelKey: 'like' | 'dislike' | 'serious';
  Icon: ActionIcon;
}> = [
  { type: 'LIKE', labelKey: 'like', Icon: ThumbsUp },
  { type: 'DISLIKE', labelKey: 'dislike', Icon: ThumbsDown },
  { type: 'SERIOUS', labelKey: 'serious', Icon: Sparkles },
];

const LUX = {
  ink: '#0A0A0A',
  ivory: '#F5F5F7',
  iconIdle: 'rgba(255,255,255,0.96)',
};

/**
 * Apple-glass taste controls — transparent frost, lasting selected state, luxury burst.
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
  const [reasonOpen, setReasonOpen] = useState(false);
  const [burst, setBurst] = useState<{ type: Exclude<DiscoveryTasteAction, 'OPEN'>; nonce: number } | null>(
    null,
  );
  const active = lastAction(offerId);
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
    setReasonOpen(false);
    void Haptics.selectionAsync();
    const result = await record({
      offerId: id,
      eventType,
      reasonCode,
      source,
      onRequireAuth,
    });
    if (!result.ok) return;
    setBurst({ type: eventType, nonce: Date.now() });
  };

  const handle = async (eventType: Exclude<DiscoveryTasteAction, 'OPEN'>) => {
    if (eventType === 'DISLIKE') {
      if (promptDislikeViaBrain) {
        if (!Number.isFinite(id) || id <= 0 || isBusy(id)) return;
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
      style={[styles.reasons, isDark ? styles.reasonsDark : styles.reasonsLight]}
      accessibilityLabel={t('discovery.dislike.title')}
    >
      <View style={styles.reasonsHead}>
        <Text style={[styles.reasonsTitle, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,10,0.45)' }]}>
          {t('discovery.dislike.title')}
        </Text>
        <Pressable
          accessibilityLabel={t('discovery.closeA11y')}
          hitSlop={10}
          onPress={() => setReasonOpen(false)}
        >
          <Ionicons name="close" size={16} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(10,10,10,0.45)'} />
        </Pressable>
      </View>
      <View style={styles.reasonsGrid}>
        {dislikeReasons.map((r) => (
          <Pressable
            key={r.code}
            disabled={isBusy(id)}
            style={({ pressed }) => [
              styles.chip,
              isDark ? styles.chipDark : styles.chipLight,
              pressed && (isDark ? styles.chipPressedDark : styles.chipPressedLight),
            ]}
            onPress={() => void commit('DISLIKE', r.code)}
          >
            <Text style={[styles.chipText, { color: isDark ? '#FFFFFF' : '#0A0A0A' }]}>{r.label}</Text>
          </Pressable>
        ))}
        <Pressable
          disabled={isBusy(id)}
          style={({ pressed }) => [
            styles.chip,
            styles.chipSkip,
            isDark ? styles.chipDark : styles.chipLight,
            pressed && (isDark ? styles.chipPressedDark : styles.chipPressedLight),
          ]}
          onPress={() => void commit('DISLIKE')}
        >
          <Text
            style={[
              styles.chipText,
              { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,10,0.45)' },
            ]}
          >
            {t('discovery.dislike.skipShort')}
          </Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  if (variant === 'full') {
    const idleInk = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,10,0.58)';
    return (
      <View style={styles.fullBar} accessibilityLabel={t('discovery.actions.like')}>
        <View style={[styles.segmentTrack, isDark && styles.segmentTrackDark]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              pointerEvents="none"
              intensity={isDark ? 28 : 40}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          {actions.map(({ type, label, Icon }) => {
            const isActive = active === type;
            const ink = isActive ? LUX.ink : idleInk;
            return (
              <Pressable
                key={type}
                disabled={isBusy(id)}
                accessibilityLabel={label}
                accessibilityState={{ selected: isActive }}
                onPress={() => void handle(type)}
                style={({ pressed }) => [
                  styles.segment,
                  isActive && styles.segmentActive,
                  pressed && !isActive && styles.segmentPressed,
                ]}
              >
                {isBusy(id) && isActive ? (
                  <ActivityIndicator size="small" color={ink} />
                ) : (
                  <Icon
                    size={13}
                    color={ink}
                    strokeWidth={isActive ? 2.35 : 2}
                    fill={isActive ? ink : 'transparent'}
                  />
                )}
                <Text
                  style={[styles.segmentLabel, { color: ink }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  {label}
                </Text>
                {burst?.type === type ? <TasteConfettiBurst nonce={burst.nonce} /> : null}
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
      <View style={styles.trayClip} pointerEvents="none">
        {Platform.OS === 'ios' ? (
          <BlurView intensity={42} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}
      </View>
      <View style={styles.trayRow}>
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
                <Icon
                  size={15}
                  color={ink}
                  strokeWidth={isActive ? 2.4 : 2.1}
                  fill={isActive ? ink : 'transparent'}
                />
              )}
              {burst?.type === type ? <TasteConfettiBurst nonce={burst.nonce} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trayOuter: {
    position: 'relative',
    borderRadius: 999,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  trayClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  trayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  iconBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.98)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 0,
    elevation: 2,
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  fullBar: { gap: 10, overflow: 'visible' },
  segmentTrack: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    minHeight: 44,
    borderRadius: 14,
    overflow: 'hidden',
    padding: 3,
    gap: 2,
    backgroundColor: 'rgba(118,118,128,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  segmentTrackDark: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  segment: {
    flex: 1,
    minWidth: 0,
    overflow: 'visible',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 9,
    borderRadius: 11,
  },
  segmentActive: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentPressed: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  segmentLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  pressedIn: {
    transform: [{ translateY: 1 }, { scale: 0.97 }],
  },
  reasons: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  reasonsLight: {
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(118,118,128,0.08)',
  },
  reasonsDark: {
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(18,18,20,0.55)',
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
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  reasonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipLight: {
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  chipDark: {
    borderColor: 'rgba(255,255,255,0.20)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  chipPressedLight: {
    backgroundColor: 'rgba(255,255,255,1)',
  },
  chipPressedDark: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  chipSkip: {
    borderStyle: 'dashed',
  },
  chipText: { fontSize: 12, fontWeight: '700' },
});
