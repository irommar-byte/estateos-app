import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  isDark?: boolean;
};

export default function AgencyClientCreateStepper({ step, total, title, subtitle, isDark }: Props) {
  const pct = total > 1 ? ((step - 1) / (total - 1)) * 100 : 100;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.stepKicker, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>
        KROK {step} / {total}
      </Text>
      <Text style={[styles.title, { color: isDark ? '#fff' : '#111' }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>{subtitle}</Text>
      ) : null}
      <View style={[styles.track, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
        <View style={[styles.fill, { width: `${Math.max(6, pct)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  stepKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, lineHeight: 28 },
  subtitle: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  track: { height: 5, borderRadius: 999, overflow: 'hidden', marginTop: 14 },
  fill: { height: '100%', borderRadius: 999, backgroundColor: '#34C759' },
});
