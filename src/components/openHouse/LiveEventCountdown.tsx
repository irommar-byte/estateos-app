import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import { getCountdownParts } from './openHouseLiveFormat';

type Props = {
  startsAt: string | null;
  accent?: string;
  muted?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function Unit({
  value,
  label,
  accent,
  muted,
}: {
  value: string;
  label: string;
  accent: string;
  muted: string;
}) {
  return (
    <View style={styles.unit}>
      <Text style={[styles.unitValue, { color: accent }]}>{value}</Text>
      <Text style={[styles.unitLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

export default function LiveEventCountdown({
  startsAt,
  accent = '#10B981',
  muted = 'rgba(16,185,129,0.65)',
}: Props) {
  const { t } = useI18n();
  const [parts, setParts] = useState(() => getCountdownParts(startsAt));

  useEffect(() => {
    const tick = () => setParts(getCountdownParts(startsAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startsAt]);

  if (parts.past) {
    return (
      <Text style={[styles.past, { color: muted }]}>{t('openHouse.live.countdownStarted')}</Text>
    );
  }

  return (
    <View style={styles.row}>
      <Unit value={pad2(parts.days)} label={t('openHouse.live.countdownDays')} accent={accent} muted={muted} />
      <Text style={[styles.sep, { color: accent }]}>:</Text>
      <Unit value={pad2(parts.hours)} label={t('openHouse.live.countdownHours')} accent={accent} muted={muted} />
      <Text style={[styles.sep, { color: accent }]}>:</Text>
      <Unit value={pad2(parts.minutes)} label={t('openHouse.live.countdownMinutes')} accent={accent} muted={muted} />
      <Text style={[styles.sep, { color: accent }]}>:</Text>
      <Unit value={pad2(parts.seconds)} label={t('openHouse.live.countdownSeconds')} accent={accent} muted={muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  unit: { alignItems: 'center', minWidth: 36 },
  unitValue: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  unitLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
  sep: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  past: { fontSize: 12, fontWeight: '700', marginTop: 8 },
});
