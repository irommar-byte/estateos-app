import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '../i18n';

type Props = {
  isDark?: boolean;
  compact?: boolean;
};

export default function LegalVerifiedShieldBadge({ isDark = false, compact = false }: Props) {
  const { t } = useI18n();
  const floatY = useSharedValue(0);
  const glow = useSharedValue(0.45);
  const tilt = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(withTiming(1, { duration: 1600 }), withTiming(0.35, { duration: 1600 })),
      -1,
      false,
    );
    tilt.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [floatY, glow, tilt]);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotateZ: `${tilt.value * 1.2}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.value * 0.45,
  }));

  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact]}
      accessibilityLabel={t('offer.detail.legalVerified.a11y')}
    >
      <Animated.View style={[styles.shieldOuter, shellStyle]}>
        <Animated.View style={[styles.shieldGlow, glowStyle]} />
        <LinearGradient
          colors={isDark ? ['#34d399', '#059669', '#064e3b'] : ['#6ee7b7', '#10b981', '#047857']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={[styles.shieldShell, compact && styles.shieldShellCompact]}
        >
          <View style={styles.shieldHighlight} />
          <ShieldCheck
            size={compact ? 20 : 24}
            color="#ffffff"
            strokeWidth={2.5}
            style={styles.shieldIcon}
          />
        </LinearGradient>
      </Animated.View>

      <View style={[styles.copyBlock, compact && styles.copyBlockCompact]}>
        <Text
          style={[
            styles.title,
            compact && styles.titleCompact,
            isDark ? styles.titleDark : styles.titleLight,
          ]}
          numberOfLines={2}
        >
          {t('offer.detail.legalVerified.label')}
        </Text>
        <Text
          style={[
            styles.subtitle,
            compact && styles.subtitleCompact,
            isDark ? styles.subtitleDark : styles.subtitleLight,
          ]}
          numberOfLines={1}
        >
          {t('offer.detail.legalVerified.sublabel')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 220,
  },
  wrapCompact: { gap: 8, maxWidth: 200 },
  shieldOuter: {
    marginTop: -6,
    marginBottom: -4,
    marginLeft: -2,
  },
  shieldGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 22,
    backgroundColor: 'rgba(16,185,129,0.35)',
  },
  shieldShell: {
    width: 46,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    overflow: 'visible',
  },
  shieldShellCompact: { width: 40, height: 46, borderRadius: 14 },
  shieldHighlight: {
    position: 'absolute',
    top: 4,
    left: 6,
    right: 6,
    height: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  shieldIcon: {
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  copyBlock: { flex: 1, minWidth: 0 },
  copyBlockCompact: { paddingTop: 2 },
  title: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    lineHeight: 13,
  },
  titleCompact: { fontSize: 9, letterSpacing: 0.7, lineHeight: 12 },
  titleDark: {
    color: '#ecfdf5',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  titleLight: {
    color: '#065f46',
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  subtitleCompact: { fontSize: 7 },
  subtitleDark: { color: 'rgba(167,243,208,0.88)' },
  subtitleLight: { color: 'rgba(4,120,87,0.82)' },
});
