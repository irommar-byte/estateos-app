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
import { useI18n } from '../i18n';

type Props = {
  isDark?: boolean;
  compact?: boolean;
};

export default function LegalVerifiedShieldBadge({ isDark = false, compact = false }: Props) {
  const { t } = useI18n();
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400 }),
        withTiming(0.45, { duration: 1400 }),
      ),
      -1,
      false,
    );
  }, [pulse, glow]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.88 + glow.value * 0.12,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + glow.value * 0.28,
  }));

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        isDark ? styles.badgeDark : styles.badgeLight,
      ]}
      accessibilityLabel={t('offer.detail.legalVerified.a11y')}
    >
      <Animated.View style={iconStyle}>
        <ShieldCheck
          size={compact ? 16 : 18}
          color={isDark ? '#34d399' : '#059669'}
          strokeWidth={2.4}
        />
      </Animated.View>
      <Animated.Text
        style={[
          styles.label,
          compact && styles.labelCompact,
          isDark ? styles.labelDark : styles.labelLight,
          labelStyle,
        ]}
      >
        {t('offer.detail.legalVerified.label')}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.2,
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 5,
  },
  badgeDark: {
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderColor: 'rgba(52,211,153,0.55)',
  },
  badgeLight: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(5,150,105,0.35)',
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'lowercase',
  },
  labelCompact: { fontSize: 9 },
  labelDark: { color: '#6ee7b7' },
  labelLight: { color: '#047857' },
});
