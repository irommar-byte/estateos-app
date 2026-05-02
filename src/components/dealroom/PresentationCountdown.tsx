import React, { useEffect, useMemo, useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';

type Props = {
  /** ISO daty startu prezentacji */
  presentationIso: string;
  /** Tekst pomocniczy nad odliczaniem */
  label?: string;
  /** Stonowany styl (modal) vs jaśniejszy (panel czatu) */
  variant?: 'panel' | 'modal';
};

function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, '0');
}

function computeParts(msLeft: number) {
  if (msLeft <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const days = Math.floor(msLeft / 86400000);
  const hours = Math.floor((msLeft % 86400000) / 3600000);
  const minutes = Math.floor((msLeft % 3600000) / 60000);
  const seconds = Math.floor((msLeft % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

export default function PresentationCountdown({
  presentationIso,
  label = 'Do prezentacji pozostało',
  variant = 'panel',
}: Props) {
  const targetMs = useMemo(() => new Date(presentationIso).getTime(), [presentationIso]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(targetMs)) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const msLeft = useMemo(() => targetMs - Date.now(), [targetMs, tick]);
  const parts = computeParts(msLeft);

  if (!Number.isFinite(targetMs) || msLeft <= 0) return null;

  const colors =
    variant === 'modal'
      ? { main: '#d1d5db', dim: '#9ca3af' }
      : { main: 'rgba(52, 199, 89, 0.95)', dim: 'rgba(235, 235, 245, 0.55)' };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.dim }]}>{label}</Text>
      <View style={styles.row}>
        <Text style={[styles.num, { color: colors.main }]}>{parts.days}</Text>
        <Text style={[styles.unit, { color: colors.dim }]}> dni · </Text>
        <Text style={[styles.num, { color: colors.main }]}>{pad2(parts.hours)}</Text>
        <Text style={[styles.sep, { color: colors.dim }]}>:</Text>
        <Text style={[styles.num, { color: colors.main }]}>{pad2(parts.minutes)}</Text>
        <Text style={[styles.sep, { color: colors.dim }]}>:</Text>
        <Text style={[styles.num, { color: colors.main }]}>{pad2(parts.seconds)}</Text>
      </View>
      <Text style={[styles.sub, { color: colors.dim }]}>godziny · minuty · sekundy</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  num: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 13, fontWeight: '600' },
  sep: { fontSize: 16, fontWeight: '700', marginHorizontal: 1 },
  sub: { fontSize: 10, marginTop: 4, fontWeight: '500' },
});
