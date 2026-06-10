import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ScrollingNewsLine from '../openHouse/ScrollingNewsLine';
import type { TabBarTickerMessage } from '../../contracts/tabBarTickerContract';
import { useTabBarTickerStore } from '../../store/useTabBarTickerStore';
import { navigateTabBarTickerAction } from '../../utils/tabBarTickerNavigate';
import { TAB_BAR_BASE_HEIGHT } from './TabBarBackground';

type Props = {
  isDark: boolean;
};

export const TAB_BAR_LIVE_GROOVE_HEIGHT = 28;
const GROOVE_H = TAB_BAR_LIVE_GROOVE_HEIGHT;
const OPEN_MS = 680;
const CLOSE_MS = 620;

/** Rynna wysuwa się poziomo na pełną szerokość ekranu — bez zmiany wysokości tab bara. */
export default function TabBarLiveTicker({ isDark }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const slideX = useRef(new Animated.Value(-screenWidth)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const phase = useTabBarTickerStore((s) => s.phase);
  const active = useTabBarTickerStore((s) => s.active);
  const tick = useTabBarTickerStore((s) => s.tick);
  const nextInfoAt = useTabBarTickerStore((s) => s.nextInfoAt);
  const setPhase = useTabBarTickerStore((s) => s.setPhase);
  const setActive = useTabBarTickerStore((s) => s.setActive);
  const consumeNext = useTabBarTickerStore((s) => s.consumeNext);
  const markInfoCycleDone = useTabBarTickerStore((s) => s.markInfoCycleDone);
  const pendingLen = useTabBarTickerStore((s) => s.pending.length);

  const infoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  const clearInfoTimer = useCallback(() => {
    if (infoTimerRef.current) {
      clearTimeout(infoTimerRef.current);
      infoTimerRef.current = null;
    }
  }, []);

  const tryStartNextRef = useRef<() => void>(() => {});

  const scheduleInfoRetry = useCallback(() => {
    clearInfoTimer();
    const delay = Math.max(800, useTabBarTickerStore.getState().nextInfoAt - Date.now());
    infoTimerRef.current = setTimeout(() => {
      infoTimerRef.current = null;
      tryStartNextRef.current();
    }, delay);
  }, [clearInfoTimer]);

  const runClose = useCallback(
    (msg: TabBarTickerMessage | null) => {
      setPhase('closing');
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideX, {
          toValue: screenWidth,
          duration: CLOSE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        slideX.setValue(-screenWidth);
        setActive(null);
        setPhase('idle');
        runningRef.current = false;
        if (msg?.priority === 'info') markInfoCycleDone();
        const hasPending = useTabBarTickerStore.getState().pending.length > 0;
        if (hasPending) {
          tryStartNextRef.current();
        } else {
          scheduleInfoRetry();
        }
      });
    },
    [slideX, textOpacity, screenWidth, setPhase, setActive, markInfoCycleDone, scheduleInfoRetry],
  );

  const runOpen = useCallback(
    (msg: TabBarTickerMessage) => {
      runningRef.current = true;
      setActive(msg);
      setPhase('opening');
      slideX.setValue(-screenWidth);
      textOpacity.setValue(0);
      Animated.timing(slideX, {
        toValue: 0,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setPhase('scrolling');
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }).start();
      });
    },
    [slideX, textOpacity, screenWidth, setActive, setPhase],
  );

  const tryStartNext = useCallback(() => {
    if (runningRef.current || useTabBarTickerStore.getState().phase !== 'idle') return;
    const msg = consumeNext();
    if (!msg) {
      scheduleInfoRetry();
      return;
    }
    clearInfoTimer();
    runOpen(msg);
  }, [consumeNext, runOpen, scheduleInfoRetry, clearInfoTimer]);

  tryStartNextRef.current = tryStartNext;

  useEffect(() => {
    slideX.setValue(-screenWidth);
  }, [screenWidth, slideX]);

  useEffect(() => {
    const boot = setTimeout(() => tryStartNextRef.current(), 2200);
    return () => {
      clearTimeout(boot);
      clearInfoTimer();
    };
  }, [clearInfoTimer]);

  useEffect(() => {
    if (phase === 'idle') tryStartNextRef.current();
  }, [tick, pendingLen, nextInfoAt, phase]);

  const onScrollDone = useCallback(() => {
    runClose(active);
  }, [active, runClose]);

  const onCtaPress = useCallback(() => {
    if (!active || phase === 'idle' || phase === 'closing') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const navigated = navigateTabBarTickerAction(active.action);
    if (navigated) runClose(active);
  }, [active, phase, runClose]);

  const textColor = isDark ? 'rgba(230,245,238,0.9)' : 'rgba(12,40,28,0.86)';
  const ctaBg = isDark ? 'rgba(16,185,129,0.24)' : 'rgba(16,185,129,0.16)';
  const ctaBorder = isDark ? 'rgba(16,185,129,0.48)' : 'rgba(16,185,129,0.38)';
  const ctaText = isDark ? '#6EE7B7' : '#047857';
  const channelBg = isDark ? 'rgba(14,18,16,0.94)' : 'rgba(248,250,249,0.96)';
  const grooveBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const showContent = phase !== 'idle' && !!active;

  return (
    <View
      style={[styles.overlayHost, { bottom: TAB_BAR_BASE_HEIGHT, height: GROOVE_H }]}
      pointerEvents={showContent ? 'box-none' : 'none'}
    >
      <Animated.View
        style={[
          styles.slidePanel,
          {
            width: screenWidth,
            transform: [{ translateX: slideX }],
          },
        ]}
      >
        <View
          style={[
            styles.grooveOuter,
            { backgroundColor: channelBg, borderTopColor: grooveBorder },
          ]}
        >
          <Animated.View style={[styles.channelRow, { opacity: textOpacity }]}>
            <View style={styles.scrollLane}>
              {phase === 'scrolling' && active ? (
                <ScrollingNewsLine
                  key={active.id}
                  text={active.bodyText}
                  repeat="once"
                  pxPerSec={active.scrollPxPerSec ?? 34}
                  height={GROOVE_H - 8}
                  textStyle={[styles.tickerText, { color: textColor }]}
                  onPassComplete={onScrollDone}
                />
              ) : null}
            </View>
            {showContent && active ? (
              <Pressable
                onPress={onCtaPress}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.ctaBtn,
                  { backgroundColor: ctaBg, borderColor: ctaBorder },
                  pressed && { opacity: 0.82, transform: [{ scale: 0.97 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${active.ctaLabel}, ${active.bodyText}`}
              >
                <Text style={[styles.ctaLabel, { color: ctaText }]} numberOfLines={1}>
                  {active.ctaLabel}
                </Text>
                <Ionicons name="chevron-forward" size={13} color={ctaText} />
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
    zIndex: 200,
    elevation: 200,
  },
  slidePanel: {
    height: '100%',
  },
  grooveOuter: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  channelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: GROOVE_H - 6,
  },
  scrollLane: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  tickerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.12,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingLeft: 9,
    paddingRight: 5,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 124,
  },
  ctaLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.15,
    flexShrink: 1,
  },
});
