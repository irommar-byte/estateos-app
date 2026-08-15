import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Brain } from 'lucide-react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import ApplePressable from '../ApplePressable';
import CircularLabelRing from '../CircularLabelRing';
import { DISCOVERY_COLORS } from './discoveryMotion';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDiscoveryPulse } from '../../hooks/useDiscoveryPulse';
import { useDiscoveryStore } from '../../store/useDiscoveryStore';
import { playIntelligenceChime } from '../../lib/discovery/intelligenceChime';
import {
  INTEL_ORB,
  INTEL_THRESHOLDS,
  MOOD_PALETTE,
  OIL_BASE,
  OIL_COOL,
  OIL_EDGE,
  OIL_HOT,
  SESSION_AUTO_BUDGET_KEY,
  SESSION_PEEK_KEY,
  STAGE_ORDER,
  confidenceLabel,
  crossedMilestone,
  resolveIntelligenceMood,
  resolveStageKey,
  type IntelligenceMood,
  type PresentReason,
} from '../../lib/discovery/intelligenceBrand';
import { INTEL_MOTION, hideDurationForReason } from '../../lib/discovery/intelligenceMotion';
import {
  consumeAutoBudget,
  hasDonePeek,
  markPeekDone,
  pickAutoPresent,
  readMilestones,
  writeMilestones,
  type SessionStorageLike,
} from '../../lib/discovery/intelligenceSession';
import {
  dispatchDiscoveryUpdated,
  dispatchIntelligenceSheetOpen,
  subscribeGuideOpen,
  subscribeIntelligenceDislikePrompt,
  subscribeIntelligenceLearn,
} from '../../lib/discovery/clientEvents';
import { navigateDiscoveryHref } from '../../lib/discovery/navigateDiscoveryHref';
import { resolveDiscoveryEntryRoute } from '../../utils/discoveryExperienceState';
import { useI18n } from '../../i18n';
import { useIsDarkTheme } from '../../store/useThemeStore';
import { postDiscoveryTasteEvent } from '../../services/discoveryService';
import { useAuthStore } from '../../store/useAuthStore';

type Props = {
  navigation: any;
  surface?: 'market' | 'explore';
  /** `inline` — in-flow above „Wszystkie oferty”; `float` — absolute BR. */
  layout?: 'float' | 'inline';
};

type SheetMode = 'pulse' | 'dislike_prompt' | 'thanks';

/** Core leaves clear air under CircularLabelRing arcs (EstateOS™ / Intelligence). */
const CORE = INTEL_ORB.lg;
const RING_GAP = 11;
/** Tight hit target — rings paint outside; parent uses box-none so map stays grabbable. */
const HIT = CORE + 10;
const BRAIN = 26;
/** Progress ring sits just outside the oil face, inside the label arcs. */
const PROGRESS_RING = CORE + 7;
const PROGRESS_STROKE = 2.4;
/** Swipe-down distance that dismisses the genie card. */
const SWIPE_CLOSE_PX = 80;

/** Session gates share one AsyncStorage adapter (www mirrors this with sessionStorage). */
const sessionStore: SessionStorageLike = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

/**
 * A "session" on www is one tab; on mobile it is one cold start.
 * Peek + auto budget reset per launch, milestone chimes stay spent for good.
 */
void AsyncStorage.multiRemove([SESSION_PEEK_KEY, SESSION_AUTO_BUDGET_KEY]).catch(() => {});

/** Thin stroke arc around the oil face — how far the profile has travelled. */
function ProgressRing({ progress, color }: { progress: number; color: string }) {
  const radius = (PROGRESS_RING - PROGRESS_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, progress)) / 100) * circumference;
  const center = PROGRESS_RING / 2;

  return (
    <View pointerEvents="none" style={styles.progressRingHost}>
      <Svg width={PROGRESS_RING} height={PROGRESS_RING}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={PROGRESS_STROKE}
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={PROGRESS_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${Math.max(0.01, circumference - filled)}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
    </View>
  );
}

/**
 * Circular Intelligence launcher face — gasoline-on-water, brighter blooms.
 * Idle-first: only the base oil breathes when nothing happened for a while.
 */
function SiriBrainCore({
  ringColor,
  active = true,
  reduceMotion = false,
}: {
  ringColor: string;
  active?: boolean;
  reduceMotion?: boolean;
}) {
  const spinA = useRef(new Animated.Value(0)).current;
  const spinB = useRef(new Animated.Value(0)).current;
  const spinC = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const full = active && !reduceMotion;

  useEffect(() => {
    if (reduceMotion) {
      breathe.setValue(0.5);
      drift.setValue(0.5);
      return;
    }

    const spinLoop = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
    const breatheLoop = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );

    const loops: Animated.CompositeAnimation[] = [
      spinLoop(spinA, full ? INTEL_MOTION.oilSpinAMs : INTEL_MOTION.oilSpinAMs * 4),
    ];
    if (full) {
      loops.push(
        spinLoop(spinB, INTEL_MOTION.oilSpinBMs),
        spinLoop(spinC, INTEL_MOTION.oilSpinCMs),
        breatheLoop(breathe, INTEL_MOTION.oilBreatheMs),
        breatheLoop(drift, INTEL_MOTION.oilDriftMs),
      );
    } else {
      breathe.setValue(0.5);
      drift.setValue(0.5);
    }

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [breathe, drift, full, reduceMotion, spinA, spinB, spinC]);

  const rotateA = spinA.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateB = spinB.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const rotateC = spinC.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const swirlScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1.28] });
  const blobShift = drift.interpolate({ inputRange: [0, 1], outputRange: [-6, 8] });
  const blobShiftAlt = drift.interpolate({ inputRange: [0, 1], outputRange: [7, -5] });

  return (
    <View style={[styles.core, { borderColor: ringColor }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.siriSwirl,
          {
            opacity: 1,
            transform: [{ scale: swirlScale }, { rotate: rotateA }],
          },
        ]}
      >
        <LinearGradient
          colors={[...OIL_BASE]}
          start={{ x: 0.05, y: 0.1 }}
          end={{ x: 0.95, y: 0.9 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      {full ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.oilBlob,
              styles.oilBlobHot,
              {
                opacity: 0.92,
                transform: [
                  { translateX: blobShift },
                  { translateY: blobShiftAlt },
                  { rotate: rotateB },
                  { scale: 1.15 },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={[...OIL_HOT]}
              locations={[0, 0.28, 0.55, 0.78, 1]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.oilBlob,
              styles.oilBlobCool,
              {
                opacity: 0.78,
                transform: [
                  { translateX: blobShiftAlt },
                  { translateY: blobShift },
                  { rotate: rotateC },
                  { scale: 1.05 },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={[...OIL_COOL]}
              locations={[0, 0.3, 0.58, 0.8, 1]}
              start={{ x: 1, y: 0.15 }}
              end={{ x: 0, y: 0.9 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.siriSwirlAlt,
              {
                opacity: 0.55,
                transform: [{ rotate: rotateB }, { scale: 1.35 }],
              },
            ]}
          >
            <LinearGradient
              colors={[...OIL_EDGE]}
              locations={[0, 0.18, 0.36, 0.52, 0.68, 0.84, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        </>
      ) : null}
      <View pointerEvents="none" style={styles.siriSheen} />
      <View pointerEvents="none" style={styles.siriHighlight} />
      <LivingBrain accent="#FFFFFF" animated={!reduceMotion} />
    </View>
  );
}

/** Compact oil face for the sheet header — same gasoline skin, no swirl cost. */
function OilFace({
  size,
  brainSize = INTEL_ORB.md,
  reduceMotion = false,
}: {
  size: number;
  brainSize?: number;
  reduceMotion?: boolean;
}) {
  return (
    <View style={[styles.oilFace, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={[...OIL_BASE]}
        start={{ x: 0.05, y: 0.1 }}
        end={{ x: 0.95, y: 0.9 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[...OIL_HOT]}
        locations={[0, 0.28, 0.55, 0.78, 1]}
        start={{ x: 0.9, y: 0 }}
        end={{ x: 0.1, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { opacity: 0.5 }]}
      />
      <View pointerEvents="none" style={styles.siriSheen} />
      <View
        pointerEvents="none"
        style={[
          styles.oilFaceHighlight,
          { width: size * 0.42, height: size * 0.26, left: size * 0.14 },
        ]}
      />
      <LivingBrain accent="#FFFFFF" size={brainSize} animated={!reduceMotion} />
    </View>
  );
}

function navigatePulseAction(navigation: any, action: string | undefined, firstEntrySeen: boolean) {
  const act = String(action || 'DISCOVERY').toUpperCase();
  if (act === 'DIRECTION') {
    navigation?.navigate?.('DiscoveryDirection');
    return;
  }
  if (act === 'LUSTRO' || act === 'PROFILE') {
    navigation?.navigate?.('DiscoveryDirection');
    return;
  }
  if (act === 'DISCOVERY' || !action) {
    navigation?.navigate?.(resolveDiscoveryEntryRoute(firstEntrySeen));
    return;
  }
  navigateDiscoveryHref(navigation, null, action);
}

/** Tight orbits — neurons stay inside the brain silhouette. */
const NEURONS = [
  { id: 'n1', r: 8, phase: 0, cw: true },
  { id: 'n2', r: 10, phase: 0.22, cw: false },
  { id: 'n3', r: 7, phase: 0.45, cw: true },
  { id: 'n4', r: 11, phase: 0.68, cw: false },
  { id: 'n5', r: 9, phase: 0.86, cw: true },
];

function LivingBrain({
  accent,
  size = BRAIN,
  animated = true,
}: {
  accent: string;
  size?: number;
  animated?: boolean;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const clipW = size * 0.82;
  const clipH = size * 0.64;

  useEffect(() => {
    if (!animated) {
      pulse.setValue(0);
      return;
    }
    const orbit = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: INTEL_MOTION.neuronOrbitMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: INTEL_MOTION.neuronPulseMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: INTEL_MOTION.neuronPulseMs,
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
  }, [animated, pulse, spin]);

  const brainScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <View style={[styles.brainStage, { width: size + 4, height: size + 4 }]}>
      <Animated.View style={{ transform: [{ scale: brainScale }], zIndex: 1 }}>
        <Brain size={size} color={accent} strokeWidth={2} />
      </Animated.View>

      <View
        pointerEvents="none"
        style={[
          styles.neuronClip,
          {
            width: clipW,
            height: clipH,
            borderRadius: clipH / 2,
          },
        ]}
      >
        <Svg width={clipW} height={clipH} style={StyleSheet.absoluteFill}>
          {NEURONS.map((n, i) => {
            const a0 = Math.PI * 2 * n.phase + i * 0.4;
            const cx = clipW / 2;
            const cy = clipH / 2;
            return (
              <Line
                key={`l-${n.id}`}
                x1={cx + Math.cos(a0) * (n.r * 0.3)}
                y1={cy + Math.sin(a0) * (n.r * 0.3)}
                x2={cx + Math.cos(a0 + 1.05) * n.r}
                y2={cy + Math.sin(a0 + 1.05) * n.r}
                stroke={accent}
                strokeOpacity={0.4}
                strokeWidth={1.15}
              />
            );
          })}
        </Svg>
        {NEURONS.map((n) => {
          const rotate = spin.interpolate({
            inputRange: [0, 1],
            outputRange: n.cw ? ['0deg', '360deg'] : ['0deg', '-360deg'],
          });
          return (
            <View
              key={n.id}
              pointerEvents="none"
              style={[
                styles.neuronOrbit,
                {
                  width: n.r * 2,
                  height: n.r * 2,
                  left: clipW / 2 - n.r,
                  top: clipH / 2 - n.r,
                  transform: [{ rotate: `${Math.round(n.phase * 360)}deg` }],
                },
              ]}
            >
              <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ rotate }] }]}>
                <View style={[styles.neuron, { backgroundColor: accent, shadowColor: accent }]} />
              </Animated.View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * EstateOS™ Intelligence launcher — clear chrome, genie sheet, living brain.
 */
export default function IntelligencePulseTape({
  navigation,
  surface = 'explore',
  layout = 'float',
}: Props) {
  const { t } = useI18n();
  const isDark = useIsDarkTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const token = useAuthStore((s) => s.token);
  const firstEntrySeen = useDiscoveryStore((s) => s.firstEntrySeen);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>('pulse');
  const [pendingDislike, setPendingDislike] = useState<{ offerId: number; source?: string } | null>(
    null,
  );
  const [presentReason, setPresentReason] = useState<PresentReason | null>(null);
  const [orbNotice, setOrbNotice] = useState<Exclude<PresentReason, 'manual'> | null>(null);
  const [spectacle, setSpectacle] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  /** Idle-first oil: full multi-layer swirl only around real interaction. */
  const [orbActive, setOrbActive] = useState(true);
  const genie = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const aura = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const splashA = useRef(new Animated.Value(0)).current;
  const splashB = useRef(new Animated.Value(0)).current;
  const splashC = useRef(new Animated.Value(0)).current;
  const whisperOp = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spectacleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetVisibleRef = useRef(false);
  const reduceMotionRef = useRef(false);
  const peekArmedRef = useRef(false);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const apply = (value: boolean) => {
      if (!alive) return;
      reduceMotionRef.current = Boolean(value);
      setReduceMotion(Boolean(value));
    };
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(apply)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', apply);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  /** Haptics are motion too — silent when the user asked for stillness. */
  const impact = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    if (reduceMotionRef.current) return;
    void Haptics.impactAsync(style);
  }, []);

  const bumpActivity = useCallback(() => {
    setOrbActive(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setOrbActive(false), INTEL_MOTION.idleAfterMs);
  }, []);

  useEffect(() => {
    bumpActivity();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [bumpActivity]);

  const clearHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const runGenieOut = useCallback(
    (after?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      clearHide();
      Animated.timing(genie, {
        toValue: 0,
        duration: reduceMotionRef.current ? 0 : INTEL_MOTION.genieOutMs,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setSheetVisible(false);
        sheetVisibleRef.current = false;
        dispatchIntelligenceSheetOpen(false);
        dragY.setValue(0);
        setPresentReason(null);
        setSheetMode('pulse');
        setPendingDislike(null);
        setSpectacle(false);
        closingRef.current = false;
        bumpActivity();
        after?.();
      });
    },
    [bumpActivity, clearHide, dragY, genie],
  );

  const runGenieIn = useCallback(() => {
    closingRef.current = false;
    setSheetVisible(true);
    sheetVisibleRef.current = true;
    dispatchIntelligenceSheetOpen(true);
    dragY.setValue(0);
    genie.setValue(0);
    if (reduceMotionRef.current) {
      genie.setValue(1);
      return;
    }
    Animated.spring(genie, {
      toValue: 1,
      friction: INTEL_MOTION.genieInFriction,
      tension: INTEL_MOTION.genieInTension,
      useNativeDriver: true,
    }).start();
  }, [dragY, genie]);

  /** Swipe the card down to send it back into the orb. */
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.4,
        onPanResponderMove: (_evt, gesture) => {
          if (gesture.dy <= 0) return;
          dragY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy >= SWIPE_CLOSE_PX) {
            runGenieOut();
            return;
          }
          Animated.spring(dragY, {
            toValue: 0,
            friction: INTEL_MOTION.genieInFriction,
            tension: INTEL_MOTION.genieInTension,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          dragY.setValue(0);
        },
      }),
    [dragY, runGenieOut],
  );

  const scheduleHide = useCallback(
    (ms: number) => {
      clearHide();
      hideTimerRef.current = setTimeout(() => {
        runGenieOut();
      }, ms);
    },
    [clearHide, runGenieOut],
  );

  const playOrbSplash = useCallback(() => {
    if (reduceMotionRef.current) return;
    const runSplash = (ring: Animated.Value, delayMs: number) => {
      ring.setValue(0);
      return Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(ring, {
          toValue: 1,
          duration: INTEL_MOTION.splashMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
    };
    Animated.parallel([
      runSplash(splashA, 0),
      runSplash(splashB, INTEL_MOTION.splashStaggerMs),
      runSplash(splashC, INTEL_MOTION.splashStaggerMs * 2),
    ]).start();
  }, [splashA, splashB, splashC]);

  /** Auto attention stays on the orb — never covers the catalog. */
  const nudgeOrb = useCallback(
    (kind: Exclude<PresentReason, 'manual'>) => {
      if (sheetVisibleRef.current) return;
      bumpActivity();
      setOrbNotice(kind);
      impact(Haptics.ImpactFeedbackStyle.Light);
      playOrbSplash();
      whisperOp.stopAnimation();
      whisperOp.setValue(0);
      Animated.sequence([
        Animated.timing(whisperOp, {
          toValue: 1,
          duration: reduceMotionRef.current ? 0 : 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(2800),
        Animated.timing(whisperOp, {
          toValue: 0,
          duration: reduceMotionRef.current ? 0 : 420,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [bumpActivity, impact, playOrbSplash, whisperOp],
  );

  const presentGently = useCallback(
    (kind: PresentReason, milestoneGate?: number | null) => {
      bumpActivity();
      if (kind === 'manual') {
        setPresentReason(null);
        setSheetMode('pulse');
        runGenieIn();
        scheduleHide(hideDurationForReason('manual'));
        return;
      }
      setSheetMode('pulse');
      setPresentReason(kind);
      setSpectacle(kind === 'progress' || kind === 'milestone');
      const celebrate = kind === 'milestone' && (milestoneGate ?? 0) >= 90;
      void playIntelligenceChime(
        celebrate ? 'celebrate' : kind === 'progress' || kind === 'milestone' ? 'progress' : 'suggest',
      );
      runGenieIn();
      scheduleHide(hideDurationForReason(kind));
      if (spectacleTimerRef.current) clearTimeout(spectacleTimerRef.current);
      spectacleTimerRef.current = setTimeout(() => setSpectacle(false), INTEL_MOTION.spectacleHoldMs);
    },
    [bumpActivity, runGenieIn, scheduleHide],
  );

  const presentDislikePrompt = useCallback(
    (detail: { offerId: number; source?: string }) => {
      clearHide();
      closingRef.current = false;
      setPendingDislike(detail);
      setPresentReason(null);
      setSheetMode('dislike_prompt');
      runGenieIn();
    },
    [clearHide, runGenieIn],
  );

  const submitDislikeFeedback = useCallback(
    async (reasonCode?: string) => {
      if (!pendingDislike) return;
      if (!token) {
        navigation?.navigate?.('Login');
        runGenieOut();
        return;
      }
      if (!reduceMotionRef.current) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const result = await postDiscoveryTasteEvent({
        token,
        offerId: pendingDislike.offerId,
        eventType: 'DISLIKE',
        reasonCode,
        source: pendingDislike.source || 'mobile_catalog_for_you',
      });
      if (result.authRequired) {
        navigation?.navigate?.('Login');
        runGenieOut();
        return;
      }
      if (result.ok) {
        dispatchDiscoveryUpdated({
          offerId: pendingDislike.offerId,
          eventType: 'DISLIKE',
        });
      }
      setSheetMode('thanks');
      scheduleHide(1500);
    },
    [navigation, pendingDislike, runGenieOut, scheduleHide, token],
  );

  const onPulseChange = useCallback(
    async ({
      previous,
      next,
    }: {
      previous: import('../../services/discoveryService').DiscoveryPulsePayload | null;
      next: import('../../services/discoveryService').DiscoveryPulsePayload;
      silent: boolean;
    }) => {
      // Sparse Apple-style: only speak when something meaningful changed — not on every nudge.
      if (sheetVisibleRef.current) return;
      const prevProgress = previous?.progress ?? null;
      const gate = crossedMilestone(prevProgress, next.progress);
      const seen = gate != null ? await readMilestones(sessionStore) : [];
      const reason = pickAutoPresent({
        prevProgress,
        nextProgress: next.progress,
        prevContradiction: previous?.contradictionIndex ?? null,
        nextContradiction: next.contradictionIndex,
        milestoneGate: gate,
        milestoneAlreadySeen: gate != null && seen.includes(gate),
      });
      if (!reason) return;
      if (sheetVisibleRef.current) return;
      if (!(await consumeAutoBudget(sessionStore))) return;
      if (reason === 'milestone' && gate != null) {
        await writeMilestones(sessionStore, [...seen, gate]);
      }
      nudgeOrb(reason);
    },
    [nudgeOrb],
  );

  const { pulse, ready } = useDiscoveryPulse({ onPulseChange });

  /** Boot peek: one quiet hello when the direction is already meaningful. */
  useEffect(() => {
    if (!ready || !pulse || peekArmedRef.current) return;
    const meaningful =
      pulse.progress >= INTEL_THRESHOLDS.peekProgress ||
      pulse.confidence >= INTEL_THRESHOLDS.peekConfidence;
    if (!meaningful) return;
    peekArmedRef.current = true;
    const contradiction = pulse.contradictionIndex >= INTEL_THRESHOLDS.contradiction;
    // Timer lives in a ref so a pulse refresh mid-delay does not cancel the peek.
    peekTimerRef.current = setTimeout(() => {
      void (async () => {
        if (sheetVisibleRef.current) return;
        if (await hasDonePeek(sessionStore)) return;
        if (!(await consumeAutoBudget(sessionStore))) return;
        await markPeekDone(sessionStore);
        nudgeOrb(contradiction ? 'contradiction' : 'ready_peek');
      })();
    }, INTEL_MOTION.bootPeekDelayMs);
  }, [nudgeOrb, pulse, ready]);

  useEffect(
    () => subscribeIntelligenceDislikePrompt((detail) => {
      if (!detail?.offerId) return;
      impact(Haptics.ImpactFeedbackStyle.Medium);
      presentDislikePrompt(detail);
    }),
    [impact, presentDislikePrompt],
  );

  useEffect(
    () =>
      subscribeGuideOpen(() => {
        if (sheetVisibleRef.current) return;
        impact(Haptics.ImpactFeedbackStyle.Light);
        presentGently('manual');
      }),
    [impact, presentGently],
  );

  useEffect(
    () => () => {
      clearHide();
      if (spectacleTimerRef.current) clearTimeout(spectacleTimerRef.current);
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
      dispatchIntelligenceSheetOpen(false);
    },
    [clearHide],
  );

  const mood = useMemo<IntelligenceMood>(() => {
    if (!pulse) return 'calm';
    return resolveIntelligenceMood({
      progress: pulse.progress,
      confidence: pulse.confidence,
      contradictionIndex: pulse.contradictionIndex,
      spectacle,
    });
  }, [pulse, spectacle]);
  const colors = MOOD_PALETTE[mood];
  const reasonMeta =
    presentReason && presentReason !== 'manual'
      ? {
          badge: t(`discovery.pulse.${presentReason === 'ready_peek' ? 'readyPeek' : presentReason}Badge`),
          lead: t(`discovery.pulse.${presentReason === 'ready_peek' ? 'readyPeek' : presentReason}Lead`),
        }
      : null;

  const dislikeReasons = [
    { code: 'PRICE_TOO_HIGH', label: t('discovery.dislike.price') },
    { code: 'LOCATION_MISMATCH', label: t('discovery.dislike.location') },
    { code: 'LAYOUT_MISMATCH', label: t('discovery.dislike.layout') },
    { code: 'QUALITY_LOW', label: t('discovery.dislike.quality') },
  ];

  const activeStage = resolveStageKey(pulse?.stage, pulse?.progress ?? 0);
  const activeStageIndex = STAGE_ORDER.indexOf(activeStage);
  const progressPct = Math.max(0, Math.min(100, Math.round(pulse?.progress ?? 0)));
  const stageName = t(`discovery.stages.${activeStage}`);
  const orbA11y = orbNotice
    ? `${t('discovery.brand')} · ${t(
        `discovery.pulse.${orbNotice === 'ready_peek' ? 'readyPeek' : orbNotice}Badge`,
      )}`
    : `${t('discovery.brand')} · ${stageName} · ${progressPct}%`;
  const noticeBadge = orbNotice
    ? t(`discovery.pulse.${orbNotice === 'ready_peek' ? 'readyPeek' : orbNotice}Badge`)
    : '';

  /** Confidence wording mirrors www — i18n when present, PL fallback otherwise. */
  const confidenceText = (() => {
    const bucket = confidenceLabel(pulse?.confidence ?? 0);
    const key = `discovery.pulse.confidence.${bucket}`;
    const label = t(key);
    if (label !== key) return label;
    if (bucket === 'start') return 'Start';
    if (bucket === 'outline') return 'Zarys';
    if (bucket === 'clear') return 'Wyraźny kierunek';
    return 'Silny sygnał';
  })();

  const contradictionOn = (pulse?.contradictionIndex ?? 0) >= INTEL_THRESHOLDS.contradiction;
  const contradictionText = (() => {
    const key = contradictionOn ? 'discovery.pulse.contradictionOn' : 'discovery.pulse.contradictionOff';
    const label = t(key);
    if (label !== key) return label;
    return contradictionOn ? 'Sygnały się mieszają' : 'Sygnały spójne';
  })();

  /** Screen readers hear the orb ping instead of a covering card. */
  useEffect(() => {
    if (!orbNotice || sheetVisible) return;
    const lead = t(
      `discovery.pulse.${orbNotice === 'ready_peek' ? 'readyPeek' : orbNotice}Lead`,
    );
    AccessibilityInfo.announceForAccessibility?.(`${t('discovery.brand')} · ${lead}`);
  }, [orbNotice, sheetVisible, t]);

  const sheetSurface = isDark ? 'rgba(10,10,12,0.92)' : 'rgba(255,255,255,0.96)';
  const sheetText = isDark ? '#FFFFFF' : '#111827';
  const sheetMuted = isDark ? 'rgba(245,245,247,0.62)' : 'rgba(17,24,39,0.55)';
  const sheetBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(17,24,39,0.1)';
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.05)';
  const stageDoneBg = isDark ? 'rgba(90,200,250,0.22)' : 'rgba(14,165,233,0.12)';
  const stageCurrentBg = isDark ? 'rgba(90,200,250,0.38)' : 'rgba(14,165,233,0.2)';
  const stageIdleBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.04)';

  useEffect(() => {
    if (reduceMotion) {
      aura.setValue(0.45);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(aura, {
          toValue: 1,
          duration: INTEL_MOTION.auraMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(aura, {
          toValue: 0,
          duration: INTEL_MOTION.auraMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [aura, reduceMotion]);

  /** Progress bar fills once per sheet open — the card breathing in. */
  useEffect(() => {
    if (!sheetVisible) {
      bar.setValue(0);
      return;
    }
    Animated.timing(bar, {
      toValue: 1,
      duration: reduceMotion ? 0 : INTEL_MOTION.progressBarMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [bar, reduceMotion, sheetVisible]);

  /** Water-splash ripples when like / dislike / serious teach the model. */
  useEffect(() => {
    return subscribeIntelligenceLearn((detail) => {
      if (!detail?.kind || detail.kind === 'open' || detail.kind === 'other') return;
      impact(Haptics.ImpactFeedbackStyle.Light);
      bumpActivity();
      playOrbSplash();
    });
  }, [bumpActivity, impact, playOrbSplash]);

  const open = useCallback(() => {
    impact(Haptics.ImpactFeedbackStyle.Light);
    const pending = orbNotice;
    setOrbNotice(null);
    whisperOp.stopAnimation();
    whisperOp.setValue(0);
    presentGently(pending || 'manual');
  }, [impact, orbNotice, presentGently, whisperOp]);

  const close = useCallback(() => {
    if (!reduceMotionRef.current) void Haptics.selectionAsync();
    runGenieOut();
  }, [runGenieOut]);

  const runPrimary = useCallback(() => {
    runGenieOut(() => {
      impact(Haptics.ImpactFeedbackStyle.Medium);
      const action = pulse?.primaryCta?.action;
      const href = pulse?.primaryCta?.href;
      if (href) navigateDiscoveryHref(navigation, href, action);
      else navigatePulseAction(navigation, action, firstEntrySeen);
    });
  }, [
    firstEntrySeen,
    impact,
    navigation,
    pulse?.primaryCta?.action,
    pulse?.primaryCta?.href,
    runGenieOut,
  ]);

  const runSecondary = useCallback(() => {
    runGenieOut(() => {
      impact(Haptics.ImpactFeedbackStyle.Light);
      const action = pulse?.secondaryCta?.action;
      const href = pulse?.secondaryCta?.href;
      if (href) navigateDiscoveryHref(navigation, href, action);
      else navigatePulseAction(navigation, action, firstEntrySeen);
    });
  }, [
    firstEntrySeen,
    impact,
    navigation,
    pulse?.secondaryCta?.action,
    pulse?.secondaryCta?.href,
    runGenieOut,
  ]);

  const runGuide = useCallback(
    (dest: 'discovery' | 'tropes' | 'direction') => {
      runGenieOut(() => {
        impact(Haptics.ImpactFeedbackStyle.Light);
        if (dest === 'discovery') {
          navigation?.navigate?.(resolveDiscoveryEntryRoute(firstEntrySeen));
          return;
        }
        if (dest === 'tropes') {
          navigation?.navigate?.('DiscoveryTropes');
          return;
        }
        navigation?.navigate?.('DiscoveryDirection');
      });
    },
    [firstEntrySeen, impact, navigation, runGenieOut],
  );

  if (!ready || !pulse) return null;

  // Float: bottom-right above tab bar. Inline: parent docks above „Wszystkie oferty”.
  const TAB = 95;
  const bottom = TAB + Math.max(insets.bottom, 8) + (surface === 'market' ? 10 : 18);
  const right = 10;
  const top = height - bottom - HIT;
  const sheetWidth = Math.min(336, width - 28);
  const bubbleCenterX =
    layout === 'inline' ? width - 12 - HIT / 2 : width - right - HIT / 2;
  const bubbleCenterY =
    layout === 'inline' ? height - (TAB + Math.max(insets.bottom, 8) + 220) : top + HIT / 2;
  const sheetTop =
    layout === 'float' && (sheetMode === 'dislike_prompt' || sheetMode === 'thanks')
      ? Math.max(insets.top + 40, bubbleCenterY - 300)
      : Math.max(insets.top + 56, Math.min(bubbleCenterY - 260, height * 0.12));
  const sheetLeft = (width - sheetWidth) / 2;
  const sheetCenterX = sheetLeft + sheetWidth / 2;
  const sheetCenterY = sheetTop + 160;
  const originDX = bubbleCenterX - sheetCenterX;
  const originDY = bubbleCenterY - sheetCenterY;

  const glowOpacity = aura.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });
  const glowScale = aura.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  const splashStyle = (ring: Animated.Value, peak: number) => ({
    opacity: ring.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 0.75, 0] }),
    transform: [
      {
        scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.85, peak] }),
      },
    ],
  });

  const genieStyle = {
    opacity: genie.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.85, 1] }),
    transform: [
      { translateX: genie.interpolate({ inputRange: [0, 1], outputRange: [originDX, 0] }) },
      {
        translateY: Animated.add(
          genie.interpolate({ inputRange: [0, 1], outputRange: [originDY, 0] }),
          dragY,
        ),
      },
      { scaleX: genie.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.12, 0.72, 1] }) },
      { scaleY: genie.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.04, 0.88, 1] }) },
    ],
  };

  const orbHostStyle =
    layout === 'inline'
      ? [styles.rootInline, { width: HIT, height: HIT }]
      : [styles.root, { top, right, width: HIT, height: HIT }];

  return (
    <>
      <View pointerEvents="box-none" style={orbHostStyle}>
        <ApplePressable
          onPress={open}
          style={styles.hit}
          accessibilityLabel={orbA11y}
          accessibilityHint={confidenceText}
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
          <Animated.View
            pointerEvents="none"
            style={[styles.splashRing, { borderColor: colors.accent }, splashStyle(splashA, 1.55)]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.splashRing, { borderColor: colors.accent }, splashStyle(splashB, 1.85)]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.splashRing, { borderColor: colors.ring }, splashStyle(splashC, 2.15)]}
          />
          <View style={styles.ringHost} pointerEvents="none">
            <CircularLabelRing
              text="EstateOS™"
              arcPosition="top"
              buttonDiameter={CORE}
              gap={RING_GAP - 1}
              fontSize={8.6}
              letterSpacing={1.35}
              arcFraction={0.52}
              color="#FFE08A"
              strokeColor="rgba(0,0,0,0.72)"
              strokeWidth={1.15}
            />
            <CircularLabelRing
              text="Intelligence"
              arcPosition="bottom"
              buttonDiameter={CORE}
              gap={RING_GAP - 1}
              fontSize={8.2}
              letterSpacing={1.05}
              arcFraction={0.54}
              color="#FFFFFF"
              strokeColor="rgba(0,0,0,0.72)"
              strokeWidth={1.15}
            />
          </View>
          <ProgressRing progress={progressPct} color={colors.accent} />
          <SiriBrainCore ringColor={colors.ring} active={orbActive} reduceMotion={reduceMotion} />
          {orbNotice ? (
            <View
              pointerEvents="none"
              style={[styles.noticePip, { backgroundColor: colors.accent, borderColor: isDark ? '#000' : '#fff' }]}
            />
          ) : null}
        </ApplePressable>
        {orbNotice && noticeBadge ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.noticeWhisper,
              layout === 'inline' ? styles.noticeWhisperInline : styles.noticeWhisperFloat,
              { opacity: whisperOp, backgroundColor: isDark ? 'rgba(12,12,14,0.92)' : 'rgba(255,255,255,0.94)' },
            ]}
          >
            <Text style={[styles.noticeWhisperText, { color: colors.accent }]} numberOfLines={1}>
              {noticeBadge}
            </Text>
          </Animated.View>
        ) : null}
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
            {...swipe.panHandlers}
            accessibilityLiveRegion={presentReason && presentReason !== 'manual' ? 'polite' : 'none'}
            style={[
              styles.sheetWrap,
              { top: sheetTop, left: sheetLeft, width: sheetWidth },
              genieStyle,
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <BlurView
                intensity={isDark ? 96 : 88}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.sheet, { borderColor: colors.ring, backgroundColor: sheetSurface }]}
              >
                <View pointerEvents="none" style={[styles.grabber, { backgroundColor: sheetBorder }]} />
                <View style={[styles.sheetGlow, { backgroundColor: colors.soft }]} />

                {sheetMode === 'dislike_prompt' ? (
                  <>
                    <View style={styles.sheetHead}>
                      <View style={[styles.orbLg, { borderColor: colors.accent }]}>
                        <OilFace size={46} brainSize={26} reduceMotion={reduceMotion} />
                      </View>
                      <View style={styles.sheetHeadCopy}>
                        <Text style={[styles.sheetKicker, { color: sheetMuted }]}>{t('discovery.brand')}</Text>
                        <Text style={[styles.sheetStage, { color: sheetText }]}>{t('discovery.dislike.title')}</Text>
                      </View>
                      <ApplePressable
                        onPress={close}
                        haptic="none"
                        style={styles.closeBtn}
                        accessibilityLabel={t('discovery.closeA11y')}
                      >
                        <Ionicons name="close" size={16} color={sheetText} />
                      </ApplePressable>
                    </View>
                    <Text style={[styles.dislikeLead, { color: sheetMuted }]}>{t('discovery.dislike.lead')}</Text>
                    <View style={styles.dislikeChips}>
                      {dislikeReasons.map((reason) => (
                        <ApplePressable
                          key={reason.code}
                          haptic="light"
                          style={[styles.dislikeChip, { backgroundColor: chipBg, borderColor: sheetBorder }]}
                          onPress={() => void submitDislikeFeedback(reason.code)}
                        >
                          <Text style={[styles.dislikeChipText, { color: sheetText }]}>{reason.label}</Text>
                        </ApplePressable>
                      ))}
                    </View>
                    <ApplePressable
                      style={styles.dislikeSkip}
                      haptic="none"
                      onPress={() => void submitDislikeFeedback()}
                    >
                      <Text style={[styles.dislikeSkipText, { color: sheetMuted }]}>{t('discovery.dislike.skip')}</Text>
                    </ApplePressable>
                  </>
                ) : sheetMode === 'thanks' ? (
                  <>
                    <View style={styles.sheetHead}>
                      <View style={[styles.orbLg, { borderColor: colors.accent }]}>
                        <OilFace size={46} brainSize={26} reduceMotion={reduceMotion} />
                      </View>
                      <View style={styles.sheetHeadCopy}>
                        <Text style={[styles.sheetKicker, { color: sheetMuted }]}>{t('discovery.brand')}</Text>
                        <Text style={[styles.sheetStage, { color: sheetText }]}>{t('discovery.thanks.title')}</Text>
                      </View>
                    </View>
                    <Text style={[styles.thanksBody, { color: sheetMuted }]}>{t('discovery.thanks.body')}</Text>
                  </>
                ) : pulse ? (
                  <>
                    <View style={styles.sheetHead}>
                      <View style={[styles.orbLg, { borderColor: colors.accent }]}>
                        <OilFace size={46} brainSize={26} reduceMotion={reduceMotion} />
                      </View>
                      <View style={styles.sheetHeadCopy}>
                        <Text style={[styles.sheetKicker, { color: sheetMuted }]}>{t('discovery.brand')}</Text>
                        <Text style={[styles.sheetStage, { color: sheetText }]}>{stageName}</Text>
                      </View>
                      <ApplePressable
                        onPress={close}
                        haptic="none"
                        style={styles.closeBtn}
                        accessibilityLabel={t('discovery.closeA11y')}
                      >
                        <Ionicons name="close" size={16} color={sheetText} />
                      </ApplePressable>
                    </View>

                    {reasonMeta ? (
                      <View style={[styles.reasonBadge, { backgroundColor: chipBg }]}>
                        <Text style={[styles.reasonBadgeText, { color: colors.accent }]}>{reasonMeta.badge}</Text>
                        <Text style={[styles.reasonLead, { color: sheetMuted }]}>{reasonMeta.lead}</Text>
                      </View>
                    ) : null}

                    <Text style={[styles.direction, { color: sheetText }]} numberOfLines={2}>
                      {pulse.directionLine || pulse.suggestion}
                    </Text>

                    <View style={styles.progressTrack}>
                      <Animated.View
                        style={[
                          styles.progressFill,
                          {
                            backgroundColor: colors.accent,
                            width: bar.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', `${progressPct}%`],
                            }),
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.signalRow}>
                      <Text style={[styles.signalText, { color: sheetText }]}>
                        {progressPct}% · {confidenceText}
                      </Text>
                      <View style={styles.signalStatus}>
                        <View
                          style={[
                            styles.signalDot,
                            { backgroundColor: contradictionOn ? MOOD_PALETTE.alert.accent : colors.accent },
                          ]}
                        />
                        <Text
                          style={[
                            styles.signalText,
                            { color: contradictionOn ? MOOD_PALETTE.alert.accent : sheetMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {contradictionText}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.stageRow}>
                      {STAGE_ORDER.map((key, index) => {
                        const done = index < activeStageIndex;
                        const current = index === activeStageIndex;
                        return (
                          <View
                            key={key}
                            style={[
                              styles.stageChip,
                              {
                                backgroundColor: current ? stageCurrentBg : done ? stageDoneBg : stageIdleBg,
                                borderColor: current ? colors.accent : sheetBorder,
                              },
                            ]}
                          >
                            {done ? (
                              <Ionicons name="checkmark" size={11} color={colors.accent} />
                            ) : current ? (
                              <View style={[styles.stageDot, { backgroundColor: colors.accent }]} />
                            ) : null}
                            <Text
                              style={[
                                styles.stageChipText,
                                {
                                  color: current || done ? sheetText : sheetMuted,
                                  fontWeight: current ? '800' : '600',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {t(`discovery.stages.${key}`)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={[styles.progressMeta, { color: sheetMuted }]}>
                      {t('discovery.stages.meta')}
                      {pulse.decisionCount != null && pulse.decisionCount > 0
                        ? ` · ${t('discovery.stages.decisions', { count: pulse.decisionCount })}`
                        : ''}
                    </Text>
                    <Text style={[styles.progressHint, { color: sheetMuted }]}>{t('discovery.stages.hint')}</Text>

                    <Text style={[styles.suggestion, { color: sheetMuted }]} numberOfLines={4}>
                      {pulse.suggestion}
                    </Text>

                    <ApplePressable style={[styles.cta, { backgroundColor: colors.accent }]} onPress={runPrimary} haptic="medium">
                      <Text style={styles.ctaText}>
                        {(() => {
                          const action = pulse.primaryCta?.action;
                          if (action) {
                            const key = `discovery.cta.${action}`;
                            const label = t(key);
                            if (label !== key) return label;
                          }
                          return pulse.primaryCta?.label || t('discovery.pulse.continueDiscovery');
                        })()}
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color="#061018" />
                    </ApplePressable>

                    {pulse.secondaryCta ? (
                      <ApplePressable
                        style={[styles.ctaSecondary, { borderColor: colors.ring }]}
                        onPress={runSecondary}
                        haptic="light"
                      >
                        <Text style={[styles.ctaSecondaryText, { color: sheetText }]} numberOfLines={1}>
                          {(() => {
                            const action = pulse.secondaryCta?.action;
                            if (action) {
                              const key = `discovery.cta.${action}`;
                              const label = t(key);
                              if (label !== key) return label;
                            }
                            return pulse.secondaryCta?.label || t('discovery.cta.DIRECTION');
                          })()}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                      </ApplePressable>
                    ) : null}

                    <View style={[styles.guideDivider, { backgroundColor: sheetBorder }]} />
                    <Text style={[styles.guideSupport, { color: sheetMuted }]}>
                      {t('discovery.guide.supportSub')}
                    </Text>
                    {(
                      [
                        {
                          key: 'discovery' as const,
                          icon: 'compass-outline' as const,
                          label: t('discovery.guide.findSpace'),
                        },
                        {
                          key: 'tropes' as const,
                          icon: 'bookmark-outline' as const,
                          label: t('discovery.guide.showTropes'),
                        },
                        {
                          key: 'direction' as const,
                          icon: 'navigate-outline' as const,
                          label: t('discovery.guide.nextStep'),
                        },
                      ] as const
                    ).map((item) => (
                      <ApplePressable
                        key={item.key}
                        onPress={() => runGuide(item.key)}
                        haptic="light"
                        style={[styles.guideRow, { backgroundColor: chipBg, borderColor: sheetBorder }]}
                      >
                        <Ionicons name={item.icon} size={16} color={colors.accent} />
                        <Text style={[styles.guideRowText, { color: sheetText }]} numberOfLines={2}>
                          {item.label}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={sheetMuted} />
                      </ApplePressable>
                    ))}
                  </>
                ) : null}
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
    overflow: 'visible',
  },
  rootInline: {
    zIndex: 55,
    elevation: 55,
    alignSelf: 'flex-end',
    marginRight: 10,
    marginBottom: 2,
    overflow: 'visible',
  },
  hit: {
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  noticePip: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    zIndex: 6,
  },
  noticeWhisper: {
    position: 'absolute',
    top: 16,
    maxWidth: 128,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  noticeWhisperFloat: {
    right: HIT + 8,
  },
  noticeWhisperInline: {
    right: HIT + 8,
  },
  noticeWhisperText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  aura: {
    position: 'absolute',
    width: CORE + 16,
    height: CORE + 16,
    borderRadius: (CORE + 16) / 2,
  },
  splashRing: {
    position: 'absolute',
    width: CORE + 10,
    height: CORE + 10,
    borderRadius: (CORE + 10) / 2,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  ringHost: {
    position: 'absolute',
    width: CORE + RING_GAP * 2,
    height: CORE + RING_GAP * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingHost: {
    position: 'absolute',
    width: PROGRESS_RING,
    height: PROGRESS_RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  siriSwirl: {
    position: 'absolute',
    width: CORE * 1.85,
    height: CORE * 1.85,
  },
  siriSwirlAlt: {
    position: 'absolute',
    width: CORE * 1.7,
    height: CORE * 1.7,
  },
  siriSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  siriHighlight: {
    position: 'absolute',
    top: 3,
    left: 8,
    width: CORE * 0.42,
    height: CORE * 0.28,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  oilBlob: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },
  oilBlobHot: {
    width: CORE * 1.15,
    height: CORE * 0.78,
    top: CORE * 0.08,
    left: -CORE * 0.12,
  },
  oilBlobCool: {
    width: CORE * 0.95,
    height: CORE * 0.88,
    bottom: -CORE * 0.08,
    right: -CORE * 0.18,
  },
  oilFace: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
  },
  oilFaceHighlight: {
    position: 'absolute',
    top: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  brainStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  neuronClip: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  neuronOrbit: {
    position: 'absolute',
  },
  neuron: {
    position: 'absolute',
    right: -1.5,
    top: '50%',
    marginTop: -1.5,
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    shadowOpacity: 0.95,
    shadowRadius: 3.5,
    shadowOffset: { width: 0, height: 0 },
  },
  modalRoot: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheetWrap: {
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.42,
    shadowRadius: 28,
    elevation: 18,
    borderRadius: 26,
  },
  sheet: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,12,0.94)',
    padding: 16,
  },
  sheetGlow: { ...StyleSheet.absoluteFillObject, opacity: 0.22 },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: -6,
    marginBottom: 10,
    opacity: 0.9,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orbLg: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  progressFill: { height: '100%', borderRadius: 2 },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  signalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  signalDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  signalText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  stageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 14,
  },
  stageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '48%',
  },
  stageChipText: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  stageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  progressMeta: {
    color: 'rgba(245,245,247,0.55)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  progressHint: {
    color: 'rgba(245,245,247,0.42)',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },
  suggestion: {
    color: 'rgba(244,232,204,0.88)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  reasonBadge: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reasonBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  reasonLead: {
    marginTop: 4,
    color: 'rgba(245,245,247,0.78)',
    fontSize: 13,
    lineHeight: 18,
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
  ctaText: { color: '#061018', fontSize: 14, fontWeight: '900' },
  ctaSecondary: {
    marginTop: 8,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
  },
  ctaSecondaryText: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  guideDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 16,
    marginBottom: 10,
    opacity: 0.9,
  },
  guideSupport: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  guideRow: {
    minHeight: 42,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 6,
  },
  guideRowText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  dislikeLead: {
    color: 'rgba(245,245,247,0.72)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  dislikeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  dislikeChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dislikeChipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dislikeSkip: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 8,
  },
  dislikeSkipText: {
    color: 'rgba(245,245,247,0.55)',
    fontSize: 12,
    fontWeight: '700',
  },
  thanksBody: {
    color: 'rgba(244,232,204,0.92)',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    fontWeight: '600',
  },
});
