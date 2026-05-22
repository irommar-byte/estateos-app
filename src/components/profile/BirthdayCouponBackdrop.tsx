import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = { isDark: boolean };

/** Delikatne tło urodzinowe: tort, balony, konfetti — pod treścią karty. */
export default function BirthdayCouponBackdrop({ isDark }: Props) {
  const cakeLight = isDark ? '#FFD4A8' : '#FFB88A';
  const cakeMid = isDark ? '#FF9F6B' : '#FF8F5A';
  const cakeDark = isDark ? '#E8784A' : '#F07A45';
  const decor = isDark ? 'rgba(255,210,160,0.28)' : 'rgba(255,120,80,0.22)';
  const decorStrong = isDark ? 'rgba(255,220,180,0.38)' : 'rgba(255,90,60,0.28)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={[
          styles.glow,
          {
            backgroundColor: isDark ? 'rgba(255,159,120,0.14)' : 'rgba(255,183,120,0.32)',
            top: -30,
            right: -20,
          },
        ]}
      />
      <View
        style={[
          styles.glow,
          {
            backgroundColor: isDark ? 'rgba(255,105,180,0.1)' : 'rgba(255,143,180,0.18)',
            bottom: 20,
            left: -40,
            width: 120,
            height: 90,
          },
        ]}
      />

      <Ionicons
        name="balloon"
        size={34}
        color={decorStrong}
        style={[styles.decoIcon, { top: 4, right: 18, transform: [{ rotate: '12deg' }] }]}
      />
      <Ionicons
        name="balloon-outline"
        size={22}
        color={decor}
        style={[styles.decoIcon, { top: 28, right: 52, transform: [{ rotate: '-18deg' }] }]}
      />
      <Ionicons
        name="sparkles"
        size={16}
        color={decorStrong}
        style={[styles.decoIcon, { top: 14, left: 12 }]}
      />
      <Ionicons
        name="star"
        size={11}
        color={decor}
        style={[styles.decoIcon, { top: 42, left: 28 }]}
      />
      <Ionicons
        name="gift-outline"
        size={20}
        color={decor}
        style={[styles.decoIcon, { bottom: 36, left: 14 }]}
      />
      <Ionicons
        name="heart"
        size={16}
        color={decorStrong}
        style={[styles.decoIcon, { bottom: 48, right: 8, transform: [{ rotate: '24deg' }] }]}
      />

      <View style={[styles.cakeWrap, { bottom: 8, right: 10, opacity: isDark ? 0.55 : 0.42 }]}>
        <View style={[styles.cakeTier, { width: 52, height: 11, backgroundColor: cakeDark, bottom: 0 }]} />
        <View style={[styles.cakeTier, { width: 40, height: 9, backgroundColor: cakeMid, bottom: 11 }]} />
        <View style={[styles.cakeTier, { width: 28, height: 12, backgroundColor: cakeLight, bottom: 20 }]} />
        <View style={[styles.candle, { backgroundColor: '#FFF8E7' }]} />
        <View style={[styles.flame, { backgroundColor: '#FFD93D' }]} />
      </View>

      {[
        { top: 56, left: '62%' as const, c: '#FF6B9D', s: 5 },
        { top: 18, left: '38%' as const, c: '#FFD93D', s: 4 },
        { top: 72, left: '22%' as const, c: '#6ECBFF', s: 4 },
        { top: 8, left: '78%' as const, c: '#C77DFF', s: 3 },
      ].map((dot, i) => (
        <View
          key={`conf-${i}`}
          style={[
            styles.confetti,
            {
              top: dot.top,
              left: dot.left,
              width: dot.s,
              height: dot.s,
              borderRadius: dot.s / 2,
              backgroundColor: dot.c,
              opacity: isDark ? 0.45 : 0.35,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    width: 140,
    height: 100,
    borderRadius: 70,
  },
  decoIcon: {
    position: 'absolute',
  },
  cakeWrap: {
    position: 'absolute',
    width: 56,
    height: 38,
    alignItems: 'center',
  },
  cakeTier: {
    position: 'absolute',
    borderRadius: 4,
    alignSelf: 'center',
  },
  candle: {
    position: 'absolute',
    bottom: 32,
    width: 3,
    height: 10,
    borderRadius: 2,
  },
  flame: {
    position: 'absolute',
    bottom: 40,
    width: 6,
    height: 7,
    borderRadius: 3,
  },
  confetti: {
    position: 'absolute',
  },
});
