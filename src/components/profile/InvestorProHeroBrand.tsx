import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '../../i18n';
import ProfileGoldCrown from './ProfileGoldCrown';

type Props = {
  isDark: boolean;
  size?: 'md' | 'lg';
  /** false = czarno-biały, bez animacji (brak aktywnej subskrypcji). */
  lit?: boolean;
};

/**
 * INVESTOR PRO + brylant — metaliczna płytka z głębią 3D.
 * `lit=false` → desaturowany / statyczny; `lit=true` → złoto + mikro-animacja brylantua.
 */
export default function InvestorProHeroBrand({ isDark, size = 'lg', lit = true }: Props) {
  const { t } = useI18n();
  const large = size === 'lg';
  const title = t('profile.shop.investorProHeroTitle');

  const colors = !lit
    ? isDark
      ? (['#3A3A3C', '#2C2C2E', '#1C1C1E'] as const)
      : (['#F2F2F7', '#E5E5EA', '#D1D1D6'] as const)
    : isDark
      ? (['rgba(255,248,225,0.16)', 'rgba(180,83,9,0.12)', 'rgba(0,0,0,0.2)'] as const)
      : (['#FFFBEB', '#FEF3C7', '#FDE68A'] as const);

  const borderColor = !lit
    ? isDark
      ? 'rgba(255,255,255,0.14)'
      : 'rgba(0,0,0,0.12)'
    : 'rgba(180,83,9,0.35)';

  const titleColor = !lit
    ? isDark
      ? '#C7C7CC'
      : '#3A3A3C'
    : isDark
      ? '#FFF8E7'
      : '#78350F';

  const shadowColor = !lit ? '#000' : '#92400E';

  return (
    <View
      style={[
        styles.wrap,
        large && styles.wrapLg,
        {
          shadowColor,
          shadowOpacity: lit ? (large ? 0.32 : 0.28) : 0.1,
        },
        !lit && styles.wrapDim,
      ]}
    >
      <LinearGradient
        colors={[...colors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.plaque, large && styles.plaqueLg, { borderColor }]}
      >
        <View
          style={[styles.plaqueSheen, !lit && styles.plaqueSheenDim]}
          pointerEvents="none"
        />
        <View
          style={[
            styles.plaqueRim,
            isDark && styles.plaqueRimDark,
            !lit && styles.plaqueRimDim,
          ]}
          pointerEvents="none"
        />
        <ProfileGoldCrown size={large ? 32 : 26} animate={lit} muted={!lit} />
        <View style={styles.titleStack}>
          <Text
            style={[
              styles.titleShadow,
              large && styles.titleLg,
              { color: lit ? (isDark ? 'rgba(0,0,0,0.55)' : 'rgba(120,53,15,0.35)') : 'transparent' },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.title,
              large && styles.titleLg,
              {
                color: titleColor,
                textShadowColor: lit
                  ? isDark
                    ? 'rgba(0,0,0,0.65)'
                    : 'rgba(120,53,15,0.35)'
                  : 'transparent',
              },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    marginBottom: 6,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  wrapLg: {
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 18,
      },
      android: { elevation: 10 },
      default: {},
    }),
  },
  wrapDim: {
    ...Platform.select({
      ios: { shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
      default: {},
    }),
  },
  plaque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  plaqueLg: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  plaqueSheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '55%',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  plaqueSheenDim: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  plaqueRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  plaqueRimDark: {
    borderColor: 'rgba(255,248,225,0.22)',
  },
  plaqueRimDim: {
    borderColor: 'rgba(255,255,255,0.12)',
  },
  titleStack: {
    position: 'relative',
    justifyContent: 'center',
  },
  titleShadow: {
    position: 'absolute',
    left: 0,
    top: 1.5,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.8,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  titleLg: {
    fontSize: 30,
    letterSpacing: -1,
  },
});
