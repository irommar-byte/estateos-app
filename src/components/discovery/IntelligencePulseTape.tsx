import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import ApplePressable from '../ApplePressable';
import { DISCOVERY_COLORS } from './discoveryMotion';
import { useDiscoveryPulse } from '../../hooks/useDiscoveryPulse';
import { useDiscoveryStore } from '../../store/useDiscoveryStore';
import { resolveDiscoveryEntryRoute } from '../../utils/discoveryExperienceState';

type Props = {
  navigation: any;
  /** market = gallery chrome; explore = Live Radar / map chrome */
  surface?: 'market' | 'explore';
};

type Mood = 'calm' | 'active' | 'alert';

function resolveMood(progress: number, confidence: number, contradiction: number): Mood {
  if (contradiction >= 0.55) return 'alert';
  if (progress >= 35 || confidence >= 0.35) return 'active';
  return 'calm';
}

const MOOD: Record<Mood, { accent: string; soft: string; ring: string }> = {
  calm: { accent: '#34D399', soft: 'rgba(52,211,153,0.35)', ring: 'rgba(52,211,153,0.55)' },
  active: { accent: '#5AC8FA', soft: 'rgba(90,200,250,0.38)', ring: 'rgba(90,200,250,0.6)' },
  alert: { accent: '#FBBF24', soft: 'rgba(251,191,36,0.4)', ring: 'rgba(251,191,36,0.65)' },
};

function navigatePulseAction(navigation: any, action: string | undefined, firstEntrySeen: boolean) {
  const discoveryRoute = resolveDiscoveryEntryRoute(firstEntrySeen);
  switch (String(action || 'DISCOVERY').toUpperCase()) {
    case 'TROPES':
      navigation?.navigate?.('DiscoveryTropes');
      return;
    case 'DIRECTION':
    case 'LUSTRO':
    case 'PROFILE':
      navigation?.navigate?.('DiscoveryResume');
      return;
    case 'MAP':
      navigation?.navigate?.('MainTabs', { screen: 'Explore' });
      return;
    case 'CONTACT':
      navigation?.navigate?.('MainTabs', { screen: 'Wiadomości' });
      return;
    case 'DISCOVERY':
    default:
      navigation?.navigate?.(discoveryRoute);
  }
}

/**
 * Compact Inteligence island — below app chrome, never in the status-bar /
 * system Dynamic Island band, and never over bottom offer previews.
 */
export default function IntelligencePulseTape({ navigation, surface = 'explore' }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { pulse, ready } = useDiscoveryPulse();
  const firstEntrySeen = useDiscoveryStore((s) => s.firstEntrySeen);
  const [expanded, setExpanded] = useState(false);
  const breathe = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  const mood = useMemo(() => {
    if (!pulse) return 'calm' as Mood;
    return resolveMood(pulse.progress, pulse.confidence, pulse.contradictionIndex);
  }, [pulse]);
  const colors = MOOD[mood];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  useEffect(() => {
    Animated.spring(pop, {
      toValue: expanded ? 1 : 0,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [expanded, pop]);

  const open = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(true);
  }, []);

  const close = useCallback(() => {
    void Haptics.selectionAsync();
    setExpanded(false);
  }, []);

  const runPrimary = useCallback(() => {
    setExpanded(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigatePulseAction(navigation, pulse?.primaryCta?.action, firstEntrySeen);
  }, [firstEntrySeen, navigation, pulse?.primaryCta?.action]);

  if (!ready || !pulse) return null;

  // Below Homes/Cars (market) or Live Radar row (explore) — never status-bar DI slot.
  const chromeBelowSafe =
    surface === 'market'
      ? Platform.OS === 'ios'
        ? 52
        : 48
      : Platform.OS === 'ios'
        ? 102
        : 96;
  const top = insets.top + chromeBelowSafe;
  const sheetWidth = Math.min(340, width - 28);
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });
  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <>
      <View pointerEvents="box-none" style={[styles.root, { top }]}>
        <ApplePressable
          onPress={open}
          style={styles.islandHit}
          accessibilityLabel="EstateOS Inteligence"
          haptic="none"
        >
          <View style={styles.islandOuter}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.islandAura,
                {
                  backgroundColor: colors.soft,
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                },
              ]}
            />
            <BlurView intensity={90} tint="dark" style={[styles.island, { borderColor: colors.ring }]}>
              <View style={styles.orb}>
                <Ionicons name="sparkles" size={12} color={colors.accent} />
              </View>
              <Text style={styles.islandLabel} numberOfLines={1}>
                Inteligence
              </Text>
              <View style={[styles.progressDot, { backgroundColor: colors.accent }]} />
            </BlurView>
          </View>
        </ApplePressable>
      </View>

      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Animated.View
            style={[
              styles.sheetWrap,
              {
                top: top + 44,
                left: (width - sheetWidth) / 2,
                width: sheetWidth,
                opacity: pop,
                transform: [
                  {
                    translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }),
                  },
                  {
                    scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
                  },
                ],
              },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <BlurView intensity={96} tint="dark" style={[styles.sheet, { borderColor: colors.ring }]}>
                <View style={[styles.sheetGlow, { backgroundColor: colors.soft }]} />
                <View style={styles.sheetHead}>
                  <View style={[styles.orbLg, { borderColor: colors.accent }]}>
                    <Ionicons name="sparkles" size={16} color={colors.accent} />
                  </View>
                  <View style={styles.sheetHeadCopy}>
                    <Text style={styles.sheetKicker}>EstateOS™ Inteligence</Text>
                    <Text style={styles.sheetStage}>{pulse.stageLabel}</Text>
                  </View>
                  <ApplePressable onPress={close} haptic="none" style={styles.closeBtn} accessibilityLabel="Zamknij">
                    <Ionicons name="close" size={16} color="#FFF" />
                  </ApplePressable>
                </View>

                <Text style={styles.direction} numberOfLines={2}>
                  {pulse.directionLine || pulse.suggestion}
                </Text>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.max(8, pulse.progress)}%`,
                        backgroundColor: colors.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressMeta}>{pulse.progress}% gotowości kierunku</Text>

                <Text style={styles.suggestion} numberOfLines={4}>
                  {pulse.suggestion}
                </Text>

                <ApplePressable style={[styles.cta, { backgroundColor: colors.accent }]} onPress={runPrimary} haptic="medium">
                  <Text style={styles.ctaText}>{pulse.primaryCta?.label || 'Kontynuuj Discovery'}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#061018" />
                </ApplePressable>
              </BlurView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 60,
    alignItems: 'center',
  },
  islandHit: {
    alignItems: 'center',
  },
  islandOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  islandAura: {
    position: 'absolute',
    width: 148,
    height: 40,
    borderRadius: 20,
  },
  island: {
    minWidth: 126,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  orb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  islandLabel: {
    color: '#F5F5F7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheetWrap: {
    position: 'absolute',
  },
  sheet: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,12,0.88)',
    padding: 16,
  },
  sheetGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.22,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orbLg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetHeadCopy: { flex: 1, minWidth: 0 },
  sheetKicker: {
    color: DISCOVERY_COLORS.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sheetStage: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  direction: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 14,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressMeta: {
    color: 'rgba(245,245,247,0.55)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  suggestion: {
    color: 'rgba(244,232,204,0.88)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  cta: {
    marginTop: 16,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaText: {
    color: '#061018',
    fontSize: 14,
    fontWeight: '900',
  },
});
