import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';
import { useI18n } from '../../i18n';

type Props = {
  compact?: boolean;
  label?: string;
};

export default function InvestorProShimmerBadge({ compact = false, label }: Props) {
  const { t } = useI18n();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-72, 72],
  });

  const text = label || t('offer.badges.investorPro');

  return (
    <View style={[styles.shell, compact ? styles.shellCompact : null]}>
      <LinearGradient
        colors={['#3d4554', '#8b95a8', '#e8edf5', '#9aa5b8', '#4a5364']}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.innerBevel} pointerEvents="none" />
      <Animated.View
        pointerEvents="none"
        style={[styles.shimmerBeam, { transform: [{ translateX }, { skewX: '-18deg' }] }]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={styles.content}>
        <Crown size={compact ? 11 : 12} color="#F4F7FC" strokeWidth={2.4} />
        <Text style={[styles.text, compact ? styles.textCompact : null]}>{text}</Text>
        <Text style={[styles.proMark, compact ? styles.proMarkCompact : null]}>PRO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(220,228,240,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#C5D0E0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  shellCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  innerBevel: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.35)',
    borderBottomColor: 'rgba(0,0,0,0.25)',
  },
  shimmerBeam: {
    position: 'absolute',
    top: -8,
    bottom: -8,
    width: 42,
    opacity: 0.9,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: '#F8FAFD',
  },
  textCompact: {
    fontSize: 10,
  },
  proMark: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  proMarkCompact: {
    fontSize: 9,
  },
});
