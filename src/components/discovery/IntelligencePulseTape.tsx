import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDiscoveryPulse } from '../../hooks/useDiscoveryPulse';
import { useDiscoveryStore } from '../../store/useDiscoveryStore';
import { playIntelligenceChime } from '../../lib/discovery/intelligenceChime';
import { subscribeIntelligenceLearn } from '../../lib/discovery/clientEvents';
import { navigateDiscoveryHref } from '../../lib/discovery/navigateDiscoveryHref';
import { resolveDiscoveryEntryRoute } from '../../utils/discoveryExperienceState';

type Props = {
  navigation: any;
  surface?: 'market' | 'explore';
  /** `inline` — in-flow above „Wszystkie oferty”; `float` — absolute BR. */
  layout?: 'float' | 'inline';
};

type Mood = 'calm' | 'active' | 'alert' | 'celebrate';
type PresentReason = 'progress' | 'milestone' | 'contradiction' | 'ready_peek' | 'manual';

/** Core leaves clear air under CircularLabelRing arcs (EstateOS™ / Intelligence). */
const CORE = 58;
const RING_GAP = 11;
const HIT = CORE + RING_GAP * 2 + 22;
const BRAIN = 26;
const SESSION_PEEK_KEY = 'eos_intel_peek_v1';
const SESSION_MILESTONE_KEY = 'eos_intel_milestones_v1';

const REASON_COPY: Record<Exclude<PresentReason, 'manual'>, { badge: string; lead: string }> = {
  progress: { badge: 'Postęp', lead: 'Kierunek się właśnie wyostrzył.' },
  milestone: { badge: 'Gotowość', lead: 'Twój profil przekroczył nowy próg.' },
  contradiction: {
    badge: 'Korekta',
    lead: 'Sygnały się mieszają — warto spokojnie doprecyzować.',
  },
  ready_peek: {
    badge: 'Trop',
    lead: 'Masz wystarczająco wyraźny kierunek, by na chwilę zajrzeć.',
  },
};

const MILESTONES = [25, 50, 75, 90];

function resolveMood(
  progress: number,
  confidence: number,
  contradiction: number,
  spectacle: boolean,
): Mood {
  if (spectacle) return 'celebrate';
  if (contradiction >= 0.55) return 'alert';
  if (progress >= 35 || confidence >= 0.35) return 'active';
  return 'calm';
}

const MOOD: Record<Mood, { accent: string; soft: string; ring: string }> = {
  calm: { accent: '#34D399', soft: 'rgba(52,211,153,0.35)', ring: 'rgba(52,211,153,0.55)' },
  active: { accent: '#5AC8FA', soft: 'rgba(90,200,250,0.45)', ring: 'rgba(90,200,250,0.65)' },
  alert: { accent: '#FBBF24', soft: 'rgba(251,191,36,0.4)', ring: 'rgba(251,191,36,0.65)' },
  celebrate: { accent: '#A78BFA', soft: 'rgba(167,139,250,0.45)', ring: 'rgba(167,139,250,0.7)' },
};

function crossedMilestone(prev: number | null, next: number): number | null {
  if (typeof prev !== 'number') return null;
  for (const gate of MILESTONES) {
    if (prev < gate && next >= gate) return gate;
  }
  return null;
}

async function readMilestones(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_MILESTONE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

async function writeMilestones(next: number[]) {
  try {
    await AsyncStorage.setItem(SESSION_MILESTONE_KEY, JSON.stringify(next));
  } catch {
    // quiet
  }
}

function navigatePulseAction(navigation: any, action: string | undefined, firstEntrySeen: boolean) {
  const act = String(action || 'DISCOVERY').toUpperCase();
  if (act === 'DIRECTION') {
    navigation?.navigate?.('DiscoveryDirection');
    return;
  }
  if (act === 'LUSTRO' || act === 'PROFILE') {
    navigation?.navigate?.('DiscoveryLustro');
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

function LivingBrain({ accent, size = BRAIN }: { accent: string; size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const clipW = size * 0.82;
  const clipH = size * 0.64;

  useEffect(() => {
    const orbit = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 5200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1300,
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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const firstEntrySeen = useDiscoveryStore((s) => s.firstEntrySeen);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [presentReason, setPresentReason] = useState<PresentReason | null>(null);
  const [spectacle, setSpectacle] = useState(false);
  const genie = useRef(new Animated.Value(0)).current;
  const aura = useRef(new Animated.Value(0)).current;
  const splashA = useRef(new Animated.Value(0)).current;
  const splashB = useRef(new Animated.Value(0)).current;
  const splashC = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spectacleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootPeekDoneRef = useRef(false);
  const sheetVisibleRef = useRef(false);

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
        duration: 420,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setSheetVisible(false);
        sheetVisibleRef.current = false;
        setPresentReason(null);
        setSpectacle(false);
        closingRef.current = false;
        after?.();
      });
    },
    [clearHide, genie],
  );

  const runGenieIn = useCallback(() => {
    closingRef.current = false;
    setSheetVisible(true);
    sheetVisibleRef.current = true;
    genie.setValue(0);
    Animated.spring(genie, {
      toValue: 1,
      friction: 7,
      tension: 68,
      useNativeDriver: true,
    }).start();
  }, [genie]);

  const scheduleHide = useCallback(
    (ms: number) => {
      clearHide();
      hideTimerRef.current = setTimeout(() => {
        runGenieOut();
      }, ms);
    },
    [clearHide, runGenieOut],
  );

  const presentGently = useCallback(
    (kind: PresentReason) => {
      if (kind === 'manual') {
        setPresentReason(null);
        runGenieIn();
        scheduleHide(9000);
        return;
      }
      setPresentReason(kind);
      setSpectacle(kind === 'progress' || kind === 'milestone');
      void playIntelligenceChime(kind === 'progress' || kind === 'milestone' ? 'progress' : 'suggest');
      runGenieIn();
      scheduleHide(kind === 'contradiction' ? 9000 : kind === 'ready_peek' ? 7500 : 8200);
      if (spectacleTimerRef.current) clearTimeout(spectacleTimerRef.current);
      spectacleTimerRef.current = setTimeout(() => setSpectacle(false), 2400);
    },
    [runGenieIn, scheduleHide],
  );

  const onPulseChange = useCallback(
    async ({
      previous,
      next,
      silent,
    }: {
      previous: import('../../services/discoveryService').DiscoveryPulsePayload | null;
      next: import('../../services/discoveryService').DiscoveryPulsePayload;
      silent: boolean;
    }) => {
      const prevProgress = previous?.progress ?? null;
      const prevContra = previous?.contradictionIndex ?? null;
      const increased = typeof prevProgress === 'number' && next.progress > prevProgress + 0.5;
      const milestone = crossedMilestone(prevProgress, next.progress);
      const contraRising =
        typeof prevContra === 'number' && prevContra < 0.55 && next.contradictionIndex >= 0.55;

      if (!silent || increased || milestone != null || contraRising) {
        if (contraRising) {
          presentGently('contradiction');
        } else if (milestone != null) {
          const seen = await readMilestones();
          if (!seen.includes(milestone)) {
            await writeMilestones([...seen, milestone]);
            presentGently('milestone');
          } else if (increased) {
            presentGently('progress');
          }
        } else if (increased) {
          presentGently('progress');
        }
      }
    },
    [presentGently],
  );

  const { pulse, ready } = useDiscoveryPulse({ onPulseChange });

  useEffect(() => {
    if (!ready || !pulse || bootPeekDoneRef.current || sheetVisibleRef.current) return;
    const meaningful = pulse.progress >= 40 || pulse.confidence >= 0.32;
    if (!meaningful) return;

    let cancelled = false;
    void (async () => {
      try {
        const seen = await AsyncStorage.getItem(SESSION_PEEK_KEY);
        if (seen === '1') {
          bootPeekDoneRef.current = true;
          return;
        }
      } catch {
        // quiet
      }
      bootPeekDoneRef.current = true;
      setTimeout(() => {
        if (cancelled) return;
        void AsyncStorage.setItem(SESSION_PEEK_KEY, '1').catch(() => {});
        presentGently(pulse.contradictionIndex >= 0.55 ? 'contradiction' : 'ready_peek');
      }, 2200);
    })();

    return () => {
      cancelled = true;
    };
  }, [presentGently, pulse, ready]);

  useEffect(
    () => () => {
      clearHide();
      if (spectacleTimerRef.current) clearTimeout(spectacleTimerRef.current);
    },
    [clearHide],
  );

  const mood = useMemo(() => {
    if (!pulse) return 'calm' as Mood;
    return resolveMood(pulse.progress, pulse.confidence, pulse.contradictionIndex, spectacle);
  }, [pulse, spectacle]);
  const colors = MOOD[mood];
  const reasonMeta =
    presentReason && presentReason !== 'manual' ? REASON_COPY[presentReason] : null;

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

  /** Water-splash ripples when like / dislike / serious teach the model. */
  useEffect(() => {
    const runSplash = (ring: Animated.Value, delayMs: number) => {
      ring.setValue(0);
      return Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(ring, {
          toValue: 1,
          duration: 780,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
    };

    return subscribeIntelligenceLearn((detail) => {
      if (!detail?.kind || detail.kind === 'open' || detail.kind === 'other') return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.parallel([
        runSplash(splashA, 0),
        runSplash(splashB, 90),
        runSplash(splashC, 180),
      ]).start();
    });
  }, [splashA, splashB, splashC]);

  const open = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    presentGently('manual');
  }, [presentGently]);

  const close = useCallback(() => {
    void Haptics.selectionAsync();
    runGenieOut();
  }, [runGenieOut]);

  const runPrimary = useCallback(() => {
    runGenieOut(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const action = pulse?.primaryCta?.action;
      const href = pulse?.primaryCta?.href;
      if (href) navigateDiscoveryHref(navigation, href, action);
      else navigatePulseAction(navigation, action, firstEntrySeen);
    });
  }, [firstEntrySeen, navigation, pulse?.primaryCta?.action, pulse?.primaryCta?.href, runGenieOut]);

  const runSecondary = useCallback(() => {
    runGenieOut(() => {
      const href = pulse?.secondaryCta?.href || '/lustro';
      navigateDiscoveryHref(navigation, href, pulse?.secondaryCta?.action || 'LUSTRO');
    });
  }, [navigation, pulse?.secondaryCta?.action, pulse?.secondaryCta?.href, runGenieOut]);

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
  const sheetTop = Math.max(insets.top + 72, Math.min(bubbleCenterY - 220, height * 0.22));
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
      { translateY: genie.interpolate({ inputRange: [0, 1], outputRange: [originDY, 0] }) },
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
          accessibilityLabel="EstateOS Intelligence"
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
              gap={RING_GAP}
              fontSize={7.2}
              letterSpacing={1.2}
              arcFraction={0.48}
              color={DISCOVERY_COLORS.gold}
              strokeColor="rgba(0,0,0,0.55)"
              strokeWidth={0.6}
            />
            <CircularLabelRing
              text="Intelligence"
              arcPosition="bottom"
              buttonDiameter={CORE}
              gap={RING_GAP}
              fontSize={6.8}
              letterSpacing={0.95}
              arcFraction={0.5}
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
              { top: sheetTop, left: sheetLeft, width: sheetWidth },
              genieStyle,
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <BlurView intensity={96} tint="dark" style={[styles.sheet, { borderColor: colors.ring }]}>
                <View style={[styles.sheetGlow, { backgroundColor: colors.soft }]} />
                <View style={styles.sheetHead}>
                  <View style={[styles.orbLg, { borderColor: colors.accent }]}>
                    <LivingBrain accent={colors.accent} size={28} />
                  </View>
                  <View style={styles.sheetHeadCopy}>
                    <Text style={styles.sheetKicker}>EstateOS™ Intelligence</Text>
                    <Text style={styles.sheetStage}>{pulse.stageLabel}</Text>
                  </View>
                  <ApplePressable onPress={close} haptic="none" style={styles.closeBtn} accessibilityLabel="Zamknij">
                    <Ionicons name="close" size={16} color="#FFF" />
                  </ApplePressable>
                </View>

                {reasonMeta ? (
                  <View style={styles.reasonBadge}>
                    <Text style={[styles.reasonBadgeText, { color: colors.accent }]}>{reasonMeta.badge}</Text>
                    <Text style={styles.reasonLead}>{reasonMeta.lead}</Text>
                  </View>
                ) : null}

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
                <ApplePressable style={styles.secondaryCta} onPress={runSecondary} haptic="none">
                  <Text style={styles.secondaryCtaText}>
                    {pulse.secondaryCta?.label || 'Lustro preferencji'}
                  </Text>
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
  rootInline: {
    zIndex: 55,
    elevation: 55,
    alignSelf: 'flex-end',
    marginRight: 10,
    marginBottom: 2,
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
  splashRing: {
    position: 'absolute',
    width: CORE + 10,
    height: CORE + 10,
    borderRadius: (CORE + 10) / 2,
    borderWidth: 2,
    backgroundColor: 'transparent',
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
  sheetWrap: { position: 'absolute' },
  sheet: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,12,0.9)',
    padding: 16,
  },
  sheetGlow: { ...StyleSheet.absoluteFillObject, opacity: 0.22 },
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
  secondaryCta: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryCtaText: {
    color: 'rgba(245,245,247,0.7)',
    fontSize: 13,
    fontWeight: '800',
  },
});
