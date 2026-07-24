import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import RadarStatusBulb from './RadarStatusBulb';
import { useI18n } from '../../i18n';

export type LiveRadarHoldMode = null | 'disable' | 'enable';

type Chrome = {
  accent: string;
  borderColor: string;
  fill: string;
  iconBg: string;
};

type Props = {
  isDark: boolean;
  isActive: boolean;
  brandLabel: string;
  statusLive: string;
  statusInactive: string;
  hintDisable: string;
  hintEnable: string;
  hintHoldToDisable: string;
  hintInactive: string;
  scopeLine?: string;
  /** Kolor aktywnego radaru (Homes zielony / Cars niebieski). */
  activeAccent: string;
  onOpenCalibration: () => void;
  onHoldCompleteEnable: () => void;
  onHoldCompleteDisable: () => void;
};

const HOLD_SECONDS = 3;
const HOLD_MS = HOLD_SECONDS * 1000;

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return `rgba(14,165,233,${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildChrome(isActive: boolean, isDark: boolean, activeAccent: string): Chrome {
  if (isActive) {
    return {
      accent: activeAccent,
      borderColor: hexToRgba(activeAccent, isDark ? 0.55 : 0.42),
      fill: hexToRgba(activeAccent, isDark ? 0.28 : 0.2),
      iconBg: hexToRgba(activeAccent, isDark ? 0.38 : 0.26),
    };
  }
  return {
    accent: '#FF3B30',
    borderColor: isDark ? 'rgba(255,59,48,0.5)' : 'rgba(255,59,48,0.4)',
    fill: isDark ? 'rgba(255,59,48,0.22)' : 'rgba(255,59,48,0.14)',
    iconBg: isDark ? 'rgba(255,59,48,0.3)' : 'rgba(255,59,48,0.18)',
  };
}

/**
 * Wspólny przycisk Live Radar (Homes / Cars):
 * krótki tap = kalibracja, przytrzymaj 3 s = włącz / wyłącz.
 */
export default function LiveRadarControlPill({
  isDark,
  isActive,
  brandLabel,
  statusLive,
  statusInactive,
  hintDisable,
  hintEnable,
  hintHoldToDisable,
  hintInactive,
  scopeLine,
  activeAccent,
  onOpenCalibration,
  onHoldCompleteEnable,
  onHoldCompleteDisable,
}: Props) {
  const { t } = useI18n();
  const chrome = useMemo(
    () => buildChrome(isActive, isDark, activeAccent),
    [isActive, isDark, activeAccent],
  );

  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  const nudge = useRef(new Animated.Value(0)).current;
  const holdProgress = useRef(new Animated.Value(0)).current;

  const holdArmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdHapticRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdCompletedRef = useRef(false);
  const pressStartedAtRef = useRef(0);
  const [holdMode, setHoldMode] = React.useState<LiveRadarHoldMode>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = React.useState(HOLD_SECONDS);

  useEffect(() => {
    if (isActive || holdMode) {
      const duration = holdMode ? 260 : 1500;
      const stagger = holdMode ? 110 : 760;
      const loopA = Animated.loop(
        Animated.timing(pulseA, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      );
      const loopB = Animated.loop(
        Animated.sequence([
          Animated.delay(stagger),
          Animated.timing(pulseB, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      );
      pulseA.setValue(0);
      pulseB.setValue(0);
      loopA.start();
      loopB.start();
      return () => {
        loopA.stop();
        loopB.stop();
        pulseA.setValue(0);
        pulseB.setValue(0);
      };
    }
    pulseA.setValue(0);
    pulseB.setValue(0);
    return undefined;
  }, [isActive, holdMode, pulseA, pulseB]);

  useEffect(() => {
    const shouldBlink = !!holdMode || !isActive;
    if (!shouldBlink) {
      blink.setValue(1);
      return;
    }
    const half = holdMode ? 210 : 420;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: half, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0, duration: half, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, holdMode, blink]);

  useEffect(() => {
    if (isActive || holdMode) {
      nudge.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(nudge, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(700),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, holdMode, nudge]);

  const clearHold = () => {
    if (holdArmRef.current) {
      clearTimeout(holdArmRef.current);
      holdArmRef.current = null;
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdTickRef.current) {
      clearInterval(holdTickRef.current);
      holdTickRef.current = null;
    }
    if (holdHapticRef.current) {
      clearInterval(holdHapticRef.current);
      holdHapticRef.current = null;
    }
    holdProgress.stopAnimation();
    holdProgress.setValue(0);
    setHoldMode(null);
    setHoldSecondsLeft(HOLD_SECONDS);
  };

  const startHold = () => {
    if (holdMode) return;
    const mode: LiveRadarHoldMode = isActive ? 'disable' : 'enable';
    holdCompletedRef.current = false;
    setHoldMode(mode);
    setHoldSecondsLeft(HOLD_SECONDS);
    holdProgress.setValue(0);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.timing(holdProgress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    let left = HOLD_SECONDS;
    holdTickRef.current = setInterval(() => {
      left -= 1;
      setHoldSecondsLeft(Math.max(0, left));
      if (left <= 0 && holdTickRef.current) {
        clearInterval(holdTickRef.current);
        holdTickRef.current = null;
      }
    }, 1000);

    holdHapticRef.current = setInterval(() => {
      void Haptics.selectionAsync();
    }, 520);

    holdTimerRef.current = setTimeout(() => {
      holdCompletedRef.current = true;
      clearHold();
      void Haptics.notificationAsync(
        mode === 'enable'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
      if (mode === 'enable') onHoldCompleteEnable();
      else onHoldCompleteDisable();
    }, HOLD_MS);
  };

  const pulseColor = holdMode
    ? 'rgba(249,115,22,0.75)'
    : activeAccent === '#0EA5E9'
      ? 'rgba(14,165,233,0.55)'
      : 'rgba(16,185,129,0.55)';
  const pulseColorSoft = holdMode
    ? 'rgba(251,146,60,0.55)'
    : activeAccent === '#0EA5E9'
      ? 'rgba(56,189,248,0.42)'
      : 'rgba(16,185,129,0.42)';

  const scopeColor =
    activeAccent === '#0EA5E9'
      ? isDark
        ? 'rgba(56,189,248,0.92)'
        : 'rgba(3,105,161,0.95)'
      : isDark
        ? 'rgba(16,185,129,0.92)'
        : 'rgba(5,120,85,0.95)';

  return (
    <View style={styles.heroWrap}>
      {(isActive || holdMode) && (
        <View pointerEvents="none" style={styles.pulseLayer}>
          <Animated.View
            style={[
              styles.pulseWave,
              {
                borderColor: pulseColor,
                opacity: pulseA.interpolate({
                  inputRange: [0, 1],
                  outputRange: [holdMode ? 0.6 : 0.42, 0],
                }),
                transform: [
                  {
                    scale: pulseA.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, holdMode ? 2.2 : 1.85],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseWave,
              {
                borderColor: pulseColorSoft,
                opacity: pulseB.interpolate({
                  inputRange: [0, 1],
                  outputRange: [holdMode ? 0.48 : 0.34, 0],
                }),
                transform: [
                  {
                    scale: pulseB.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, holdMode ? 2.4 : 1.95],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      )}

      <Animated.View
        style={
          !isActive && !holdMode
            ? {
                transform: [
                  {
                    translateY: nudge.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, -4, 0],
                    }),
                  },
                  {
                    scale: nudge.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 1.028, 1],
                    }),
                  },
                ],
              }
            : undefined
        }
      >
        <Pressable
          onPressIn={() => {
            pressStartedAtRef.current = Date.now();
            if (holdArmRef.current) clearTimeout(holdArmRef.current);
            holdArmRef.current = setTimeout(() => {
              holdArmRef.current = null;
              startHold();
            }, 320);
          }}
          onPressOut={() => {
            if (!holdCompletedRef.current) clearHold();
          }}
          onPress={() => {
            if (holdCompletedRef.current) {
              holdCompletedRef.current = false;
              return;
            }
            if (Date.now() - pressStartedAtRef.current > 280) return;
            onOpenCalibration();
          }}
          style={({ pressed }) => [
            styles.btnWrapper,
            styles.calibrationBtn,
            {
              borderColor: holdMode ? 'rgba(249,115,22,0.9)' : chrome.borderColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.26 : 0.1,
              shadowRadius: 10,
              elevation: 5,
            },
            pressed && styles.pressed,
          ]}
        >
          <BlurView
            intensity={isDark ? 88 : 96}
            tint={isDark ? 'dark' : 'light'}
            style={[
              styles.pill,
              {
                backgroundColor: chrome.fill,
                overflow: 'hidden',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: chrome.borderColor,
              },
            ]}
          >
            {holdMode ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.holdFill,
                  {
                    backgroundColor: isDark ? 'rgba(249,115,22,0.32)' : 'rgba(249,115,22,0.26)',
                    width: holdProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            ) : null}
            <RadarStatusBulb
              active={isActive && !holdMode}
              blink={blink}
              tint={holdMode ? '#F97316' : chrome.accent}
              softBg={holdMode ? 'rgba(249,115,22,0.22)' : chrome.iconBg}
            />
            <View style={styles.textWrap}>
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                style={[styles.title, { color: holdMode ? '#F97316' : chrome.accent }]}
              >
                {brandLabel}
              </Text>
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                style={[
                  styles.status,
                  holdMode
                    ? { color: isDark ? '#FDBA74' : '#C2410C' }
                    : { color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.62)' },
                ]}
              >
                {holdMode === 'disable'
                  ? t('radar.home.calibrationHoldCountdown', { seconds: String(holdSecondsLeft) })
                  : holdMode === 'enable'
                    ? t('radar.home.calibrationHoldEnableCountdown', {
                        seconds: String(holdSecondsLeft),
                      })
                    : isActive
                      ? statusLive
                      : statusInactive}
              </Text>
              {!holdMode && isActive && scopeLine ? (
                <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.scope, { color: scopeColor }]}>
                  {scopeLine}
                </Text>
              ) : null}
            </View>
          </BlurView>
        </Pressable>

        <Text
          pointerEvents="none"
          numberOfLines={1}
          allowFontScaling={false}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[
            styles.hint,
            {
              color: holdMode
                ? isDark
                  ? 'rgba(253,186,116,0.92)'
                  : 'rgba(194,65,12,0.78)'
                : isActive
                  ? scopeColor
                  : isDark
                    ? 'rgba(255,180,174,0.78)'
                    : 'rgba(185,28,28,0.62)',
            },
          ]}
        >
          {holdMode === 'disable'
            ? hintDisable
            : holdMode === 'enable'
              ? hintEnable
              : isActive
                ? hintHoldToDisable
                : hintInactive}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 164,
    alignSelf: 'center',
  },
  pulseLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseWave: {
    position: 'absolute',
    width: 140,
    height: 70,
    borderRadius: 35,
    borderWidth: 1.5,
  },
  btnWrapper: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 164,
  },
  calibrationBtn: {
    borderWidth: 1.5,
    borderRadius: 20,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 8,
    width: '100%',
    minWidth: 0,
  },
  holdFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  textWrap: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 12, fontWeight: '900', letterSpacing: -0.2 },
  status: { fontSize: 9, fontWeight: '700', letterSpacing: 0.15 },
  scope: { marginTop: 1, fontSize: 9, fontWeight: '600', lineHeight: 11 },
  hint: {
    marginTop: 3,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: -0.1,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
});
