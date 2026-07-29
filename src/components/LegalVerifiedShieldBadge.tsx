import React, { useEffect } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Shield, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '../i18n';

type Props = {
  isDark?: boolean;
  /** true = zielona świecąca; false = szara, bez animacji. */
  verified?: boolean;
  /** Owner + unverified: show tap CTA under label. */
  showTapHint?: boolean;
  onPress?: () => void;
};

/**
 * Centered EstateOS Quality Shield — verified (glow) or unverified (muted gray).
 */
export default function LegalVerifiedShieldBadge({
  isDark = false,
  verified = true,
  showTapHint = false,
  onPress,
}: Props) {
  const { t } = useI18n();
  const floatY = useSharedValue(0);
  const glow = useSharedValue(0.45);
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (!verified) {
      floatY.value = 0;
      glow.value = 0;
      tilt.value = 0;
      return;
    }
    floatY.value = withRepeat(
      withSequence(
        withTiming(-2.5, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
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
  }, [verified, floatY, glow, tilt]);

  const shellStyle = useAnimatedStyle(() => ({
    transform: verified
      ? [{ translateY: floatY.value }, { rotateZ: `${tilt.value * 1.2}deg` }]
      : [],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: verified ? 0.35 + glow.value * 0.45 : 0,
  }));

  const title = verified
    ? t('offer.detail.legalVerified.label')
    : t('offer.detail.legalVerified.unverifiedLabel');
  const subtitle = verified
    ? t('offer.detail.legalVerified.sublabel')
    : showTapHint
      ? t('offer.detail.legalVerified.tapToVerify')
      : null;

  const a11y = verified
    ? t('offer.detail.legalVerified.a11y')
    : showTapHint
      ? t('offer.detail.legalVerified.unverifiedA11yTap')
      : t('offer.detail.legalVerified.unverifiedA11y');

  const content = (
    <View
      style={styles.wrap}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={a11y}
    >
      <Animated.View style={[styles.shieldOuter, shellStyle]}>
        <Animated.View
          style={[
            styles.shieldGlow,
            glowStyle,
            !verified && styles.shieldGlowOff,
          ]}
        />
        {verified ? (
          <LinearGradient
            colors={isDark ? ['#34d399', '#059669', '#064e3b'] : ['#6ee7b7', '#10b981', '#047857']}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={styles.shieldShell}
          >
            <View style={styles.shieldHighlight} />
            <ShieldCheck size={20} color="#ffffff" strokeWidth={2.5} style={styles.shieldIcon} />
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.shieldShell,
              styles.shieldShellMuted,
              {
                backgroundColor: isDark ? 'rgba(142,142,147,0.22)' : 'rgba(142,142,147,0.18)',
                borderColor: isDark ? 'rgba(235,235,245,0.18)' : 'rgba(60,60,67,0.2)',
              },
            ]}
          >
            <Shield
              size={18}
              color={isDark ? 'rgba(235,235,245,0.42)' : '#8E8E93'}
              strokeWidth={2.2}
            />
          </View>
        )}
      </Animated.View>

      <Text
        style={[
          styles.title,
          verified
            ? isDark
              ? styles.titleVerifiedDark
              : styles.titleVerifiedLight
            : isDark
              ? styles.titleMutedDark
              : styles.titleMutedLight,
        ]}
        numberOfLines={2}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            verified
              ? isDark
                ? styles.subtitleVerifiedDark
                : styles.subtitleVerifiedLight
              : isDark
                ? styles.subtitleMutedDark
                : styles.subtitleMutedLight,
            showTapHint && !verified && styles.subtitleTap,
          ]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.82 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 114,
    paddingHorizontal: 0,
  },
  shieldOuter: {
    marginBottom: 3,
  },
  shieldGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 20,
    backgroundColor: 'rgba(16,185,129,0.35)',
  },
  shieldGlowOff: {
    backgroundColor: 'transparent',
  },
  shieldShell: {
    width: 38,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
    overflow: 'visible',
  },
  shieldShellMuted: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  shieldHighlight: {
    position: 'absolute',
    top: 3,
    left: 5,
    right: 5,
    height: 8,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  shieldIcon: {
    zIndex: 2,
  },
  title: {
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 9,
  },
  titleVerifiedDark: {
    color: '#ecfdf5',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  titleVerifiedLight: {
    color: '#065f46',
  },
  titleMutedDark: {
    color: 'rgba(235,235,245,0.45)',
  },
  titleMutedLight: {
    color: '#8E8E93',
  },
  subtitle: {
    marginTop: 1,
    fontSize: 6.5,
    fontWeight: '700',
    letterSpacing: 0.15,
    textAlign: 'center',
    lineHeight: 8,
  },
  subtitleVerifiedDark: { color: 'rgba(167,243,208,0.88)' },
  subtitleVerifiedLight: { color: 'rgba(4,120,87,0.82)' },
  subtitleMutedDark: { color: 'rgba(235,235,245,0.4)' },
  subtitleMutedLight: { color: '#AEAEB2' },
  subtitleTap: {
    fontWeight: '800',
    letterSpacing: 0.15,
  },
});
