import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Radar,
  Radio,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react-native';

type IconProps = {
  color: string;
  size?: number;
};

function useLoop(factory: () => Animated.CompositeAnimation, deps: unknown[] = []) {
  useEffect(() => {
    const loop = Animated.loop(factory());
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Broadcasting rings — a meeting is happening right now. */
export function LiveMeetingIcon({ color, size = 18 }: IconProps) {
  const wave = useRef(new Animated.Value(0)).current;

  useLoop(
    () =>
      Animated.timing(wave, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    [wave],
  );

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: color,
            opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.8] }) }],
          },
        ]}
      />
      <Radio size={size} color={color} strokeWidth={2.3} />
    </View>
  );
}

/** Calendar with a sweeping hand — something is booked for today. */
export function TodayCalendarIcon({ color, size = 18 }: IconProps) {
  const sweep = useRef(new Animated.Value(0)).current;

  useLoop(
    () =>
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(500),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(400),
      ]),
    [sweep],
  );

  const translateY = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY }] }]}>
      <CalendarClock size={size} color={color} strokeWidth={2.2} />
    </Animated.View>
  );
}

/** Rotating radar dish — matches waiting to be sent. */
export function RadarPulseIcon({ color, size = 18 }: IconProps) {
  const spin = useRef(new Animated.Value(0)).current;

  useLoop(
    () =>
      Animated.timing(spin, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    [spin],
  );

  return (
    <Animated.View
      style={[
        styles.wrap,
        { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
      ]}
    >
      <Radar size={size} color={color} strokeWidth={2.2} />
    </Animated.View>
  );
}

/** Orbiting sparkles, mirroring the Pro tools import icon. */
export function SparkleOrbitIcon({ color, size = 18 }: IconProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;

  useLoop(
    () =>
      Animated.timing(spin, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    [spin],
  );

  useLoop(
    () =>
      Animated.sequence([
        Animated.timing(orbit, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(orbit, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    [orbit],
  );

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const orbitX = orbit.interpolate({ inputRange: [0, 1], outputRange: [-3, 3] });
  const orbitY = orbit.interpolate({ inputRange: [0, 1], outputRange: [3, -3] });

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Sparkles size={size} color={color} strokeWidth={2.6} />
      </Animated.View>
      <Animated.View
        style={[styles.orbitTopLeft, { transform: [{ translateX: orbitX }, { translateY: orbitY }] }]}
      >
        <Sparkles size={9} color={color} strokeWidth={2.6} />
      </Animated.View>
      <Animated.View
        style={[
          styles.orbitBottomRight,
          { transform: [{ translateX: Animated.multiply(orbitX, -1) }, { translateY: Animated.multiply(orbitY, -1) }] },
        ]}
      >
        <Sparkles size={8} color={color} strokeWidth={2.6} />
      </Animated.View>
    </View>
  );
}

/** Ticking clock — the countdown block. */
export function TickingClockIcon({ color, size = 18 }: IconProps) {
  const tick = useRef(new Animated.Value(0)).current;

  useLoop(
    () =>
      Animated.sequence([
        Animated.timing(tick, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(tick, { toValue: 0, duration: 880, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    [tick],
  );

  const rotate = tick.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '7deg'] });

  return (
    <Animated.View style={[styles.wrap, { transform: [{ rotate }] }]}>
      <Clock3 size={size} color={color} strokeWidth={2.2} />
    </Animated.View>
  );
}

/** Breathing roster — client counters. */
export function ClientsBreathIcon({ color, size = 18 }: IconProps) {
  const breath = useRef(new Animated.Value(0)).current;

  useLoop(
    () =>
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    [breath],
  );

  return (
    <Animated.View
      style={[
        styles.wrap,
        { transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] },
      ]}
    >
      <Users size={size} color={color} strokeWidth={2.2} />
    </Animated.View>
  );
}

/** Nudging plus — invitation to add the first client. */
export function AddClientNudgeIcon({ color, size = 18 }: IconProps) {
  const nudge = useRef(new Animated.Value(0)).current;

  useLoop(
    () =>
      Animated.sequence([
        Animated.timing(nudge, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(900),
      ]),
    [nudge],
  );

  return (
    <Animated.View
      style={[
        styles.wrap,
        { transform: [{ translateY: nudge.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] },
      ]}
    >
      <UserPlus size={size} color={color} strokeWidth={2.3} />
    </Animated.View>
  );
}

/** Calm settling check — everything is on plan. */
export function OnTrackCheckIcon({ color, size = 18 }: IconProps) {
  const glow = useRef(new Animated.Value(0)).current;

  useLoop(
    () =>
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    [glow],
  );

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: color,
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.35] }) }],
          },
        ]}
      />
      <CheckCircle2 size={size} color={color} strokeWidth={2.3} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  orbitTopLeft: { position: 'absolute', top: 0, left: 0 },
  orbitBottomRight: { position: 'absolute', bottom: 0, right: 1 },
});
