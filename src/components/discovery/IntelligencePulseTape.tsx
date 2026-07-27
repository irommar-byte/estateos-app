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
import { Brain } from 'lucide-react-native';
import Svg, { Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import ApplePressable from '../ApplePressable';
import CircularLabelRing from '../CircularLabelRing';
import { DISCOVERY_COLORS } from './discoveryMotion';
import { useDiscoveryPulse } from '../../hooks/useDiscoveryPulse';
import { useDiscoveryStore } from '../../store/useDiscoveryStore';
import { resolveDiscoveryEntryRoute } from '../../utils/discoveryExperienceState';

type Props = {
  navigation: any;
  surface?: 'market' | 'explore';
};

type Mood = 'calm' | 'active' | 'alert';

const CORE = 52;
const RING_GAP = 11;
const HIT = CORE + RING_GAP * 2 + 22;

function resolveMood(progress: number, confidence: number, contradiction: number): Mood {
  if (contradiction >= 0.55) return 'alert';
  if (progress >= 35 || confidence >= 0.35) return 'active';
  return 'calm';
}

const MOOD: Record<Mood, { accent: string; soft: string; ring: string }> = {
  calm: { accent: '#34D399', soft: 'rgba(52,211,153,0.35)', ring: 'rgba(52,211,153,0.55)' },
  active: { accent: '#5AC8FA', soft: 'rgba(90,200,250,0.45)', ring: 'rgba(90,200,250,0.65)' },
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

const NEURONS = [
  { id: 'n1', r: 17, size: 2200, size: 0 },
  { id: 'n2', r: 20, size: 2800, phase: 0.33 },
  { id: 'n3', r: 15, speed: 3400, phase: 0.66 },
  { id: 'n4', r: 22, speed: 4000, phase: 0.18 },
];

function LivingBrain({ accent }: { accent: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const orbit = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 7200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    orbit.start();
    breathe.start();
    return () => {
      orbit.stop();
      breathe.stop();
    };
  }, [pulse, spin]);

  const brainScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={styles.brainStage}>
      <Svg width={44} height={44} style={StyleSheet.absoluteFill}>
        {NEURONS.map((n, i) => {
          const a0 = (Math.PI * 2 * n.phase) + i * 0.4;
          const x1 = 22 + Math.cos(a0) * (n.r * 0.35);
          const y1 = 22 + Math.sin(a0) * (n.r * 0.35);
          const x2 = 22 + Math.cos(a0 + 0.9) * n.r;
          const y2 = 22 + Math.sin(a0 + 0.9) * n.r;
          return (
            <Line
              key={`l-${n.id}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={accent}
              strokeOpacity={0.28}
              strokeWidth={1}
            />
          );
        })}
      </Svg>
      {NEURONS.map((n, i) => {
        const rotate = spin.interpolate({
          inputRange: [0, 1],
          outputRange: [`${n.phase * 360}deg`, `${n.phase * 360 + (i % 2 === 0 ? 360 : -360)}deg`],
        });
        return (
          <Animated.View
            key={n.id}
            pointerEvents="none"
            style={[
              styles.neuronOrbit,
              {
                width: n.r * 2,
                height: n.r * 2,
                marginLeft: -n.r,
                marginTop: -n.r,
                transform: [{ rotate }],
              },
            ]}
          >
            <View style={[styles.neuron, { backgroundColor: accent, shadowColor: accent }]} />
          </Animated.View>
        );
      })}
      <Animated.View style={{ transform: [{ scale: brainScale }] }}>
        <Brain size={20} color={accent} strokeWidth={2.2} />
      </Animated.View>
    </View>
  );
}

/**
 * EstateOS™ Inteligence launcher — clear of map chrome, genie sheet, living brain.
 */
export default function IntelligencePulseTape({ navigation, surface = 'explore' }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { pulse, ready } = useDiscoveryPulse();
  const firstEntrySeen = useDiscoveryStore((s) => s.firstEntrySeen);
  const [sheetVisible, setSheetVisible] = useState(false);
  const genie = useRef(new Animated.Value(0)).current;
  const aura = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);

  const mood = useMemo(() => {
    if (!pulse) return 'calm' as Mood;
    return resolveMood(pulse.progress, pulse.confidence, pulse.contradictionIndex);
  }, [pulse]);
  const colors = MOOD[mood];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(aura, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(aura, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [aura]);

  const runGenieIn = useCallback(() => {
    closingRef.current = false;
    setSheetVisible(true);
    genie.setValue(0);
    Animated.spring(genie, {
      toValue: 1,
      friction: 7,
      tension: 68,
      useNativeDriver: true,
    }).start();
  }, [genie]);

  const runGenieOut = useCallback(
    (after?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      Animated.timing(genie, {
        toValue: 0,
        duration: 420,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setSheetVisible(false);
        closingRef.current = false;
        after?.();
      });
    },
    [genie],
  );

  const open = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    runGenieIn();
  }, [runGenieIn]);

  const close = useCallback(() => {
    void Haptics.selectionAsync();
    runGenieOut();
  }, [runGenieOut]);

  const runPrimary = useCallback(() => {
    runGenieOut(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      navigatePulseAction(navigation, pulse?.primaryCta?.action, firstEntrySeen);
    });
  }, [firstEntrySeen, navigation, pulse?.primaryCta?.action, runGenieOut]);

  if (!ready || !pulse) return null;

  // Clear of Search / Live Radar / Guide — left under Guide on explore, under Homes chrome on market.
  const top =
    surface === 'market'
      ? insets.top + (Platform.OS === 'ios' ? 108 : 100)
      : insets.top + (Platform.OS === 'ios' ? 168 : 158);
  const left = 12;
  const sheetWidth = Math.min(336, width - 28);
  const bubbleCenterX = left + HIT / 2;
  const bubbleCenterY = top + HIT / 2;
  const sheetTop = Math.min(top + HIT + 8, height * 0.28);
  const sheetLeft = (width - sheetWidth) / 2;
  const sheetCenterX = sheetLeft + sheetWidth / 2;
  const sheetCenterY = sheetTop + 160;
  const originDX = bubbleCenterX - sheetCenterX;
  const originDY = bubbleCenterY - sheetCenterY;

  const glowOpacity = aura.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });
  const glowScale = aura.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  // macOS genie: suck toward the brain bubble (scale + squash + travel).
  const genieStyle = {
    opacity: genie.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.85, 1] }),
    transform: [
      {
        translateX: genie.interpolate({ inputRange: [0, 1], outputRange: [originDX, 0] }),
      },
      {
        translateY: genie.interpolate({ inputRange: [0, 1], outputRange: [originDY, 0] }),
      },
      {
        scaleX: genie.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.12, 0.72, 1] }),
      },
      {
        scaleY: genie.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.04, 0.88, 1] }),
      },
    ],
  };

  return (
    <>
      <View pointerEvents="box-none" style={[styles.root, { top, left, width: HIT, height: HIT }]}>
        <ApplePressable
          onPress={open}
          style={styles.hit}
          accessibilityLabel="EstateOS Inteligence"
          haptic="none"
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.aura,
              {
                backgroundColor: colors.soft,
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
          <View style={styles.ringHost} pointerEvents="none">
            <CircularLabelRing
              text="EstateOS™"
              arcPosition="top"
              buttonDiameter={CORE}
              gap={RING_GAP}
              fontSize={7.5}
              letterSpacing={1.4}
              arcFraction={0.5}
              color={DISCOVERY_COLORS.gold}
              strokeColor="rgba(0,0,0,0.55)"
              strokeWidth={0.6}
            />
            <CircularLabelRing
              text="Intelligence"
              arcPosition="bottom"
              buttonDiameter={CORE}
              gap={RING_GAP}
              fontSize={7.2}
              letterSpacing={1.1}
              arcFraction={0.52}
              color="#F5F5F7"
              strokeColor="rgba(0,0,0,0.55)"
              strokeWidth={0.6}
            />
          </View>
          <BlurView intensity={92} tint="dark" style={[styles.core, { borderColor: colors.ring }]}>
            <LivingBrain accent={colors.accent} />
          </BlurView>
        </ApplePressable>
      </View>

      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={close}
      >
        <View style={styles.modalRoot} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={close}>
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: 'rgba(0,0,0,0.34)',
                  opacity: genie.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                },
              ]}
            />
          </Pressable>
          <Animated.View
            style={[
              styles.sheetWrap,
              {
                top: sheetTop,
                left: sheetLeft,
                width: sheetWidth,
              },
              genieStyle,
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <BlurView intensity={96} tint="dark" style={[styles.sheet, { borderColor: colors.ring }]}>
                <View style={[styles.sheetGlow, { backgroundColor: colors.soft }]} />
                <View style={styles.sheetHead}>
                  <View style={[styles.orbLg, { borderColor: colors.accent }]}>
                    <LivingBrain accent={colors.accent} />
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
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    zIndex: 55,
    elevation: 55,
  },
  hit: {
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aura: {
    position: 'absolute',
    width: CORE + 16,
    height: CORE + 16,
    borderRadius: (CORE + 16) / 2,
  },
  ringHost: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(8,8,10,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brainStage: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neuronOrbit: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  neuron: {
    position: 'absolute',
    right: -2,
    top: '50%',
    marginTop: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrap: {
    position: 'absolute',
  },
  sheet: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,12,0.9)',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    overflow: 'hidden',
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
