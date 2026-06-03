import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '../../i18n';
import { buildProMembershipCountdown } from '../../utils/investorProMembership';
import InsetMetalRecess from './InsetMetalRecess';

type Props = {
  proExpiresAt: unknown;
  isDark?: boolean;
};

export default function ProMembershipCountdownBar({ proExpiresAt, isDark = true }: Props) {
  const { t } = useI18n();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const countdown = useMemo(
    () => buildProMembershipCountdown(proExpiresAt),
    [proExpiresAt, tick]
  );

  if (!countdown) return null;

  const fillFlex = Math.max(0.04, countdown.progress);
  const statusText =
    countdown.labelKey === 'lastDay'
      ? t('profile.proExtras.countdown.lastDay', { hours: countdown.hoursLeft })
      : countdown.labelKey === 'endingSoon'
        ? t('profile.proExtras.countdown.endingSoon', { days: countdown.daysLeft })
        : t('profile.proExtras.countdown.active', { days: countdown.daysLeft });

  const expiryDate = new Date(countdown.expiresAtMs).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <InsetMetalRecess isDark={isDark} borderRadius={16} style={styles.wrapOuter} contentStyle={styles.wrapContent}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, isDark ? styles.labelDark : styles.labelLight]}>
          {t('profile.proExtras.countdown.title')}
        </Text>
        <Text style={[styles.meta, isDark ? styles.metaDark : styles.metaLight]}>{statusText}</Text>
      </View>
      <View style={[styles.track, isDark ? styles.trackDark : styles.trackLight]}>
        <View style={{ flex: fillFlex }}>
          <LinearGradient
            colors={['#6B7280', '#D1D5DB', '#F9FAFB', '#9CA3AF']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fill}
          />
        </View>
        <View style={{ flex: 1 - fillFlex }} />
      </View>
      <Text style={[styles.expiry, isDark ? styles.expiryDark : styles.expiryLight]}>
        {t('profile.proExtras.countdown.until', { date: expiryDate })}
      </Text>
    </InsetMetalRecess>
  );
}

const styles = StyleSheet.create({
  wrapOuter: {
    marginTop: 12,
  },
  wrapContent: {
    padding: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelDark: { color: 'rgba(255,255,255,0.55)' },
  labelLight: { color: 'rgba(0,0,0,0.45)' },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  metaDark: { color: 'rgba(255,255,255,0.82)' },
  metaLight: { color: 'rgba(0,0,0,0.72)' },
  track: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  trackDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  trackLight: { backgroundColor: 'rgba(0,0,0,0.06)' },
  fill: {
    height: '100%',
    borderRadius: 999,
    minWidth: 8,
  },
  expiry: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '500',
  },
  expiryDark: { color: 'rgba(255,255,255,0.38)' },
  expiryLight: { color: 'rgba(0,0,0,0.38)' },
});
