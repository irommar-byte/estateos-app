import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type MatchReason = { tone: 'good' | 'warn' | 'bad'; label: string };

const COLOR: Record<MatchReason['tone'], string> = { good: '#2F9E6A', warn: '#C98A1B', bad: '#C2412D' };
const MARK: Record<MatchReason['tone'], string> = { good: '✓', warn: '–', bad: '✕' };

/** Powody dopasowania — ten sam silnik na serwerze dla klienta, agenta i WWW. */
export default function MatchReasonChips({
  reasons,
  max = 4,
  textColor,
  style,
}: {
  reasons?: MatchReason[] | null;
  max?: number;
  textColor: string;
  style?: object;
}) {
  if (!reasons?.length) return null;
  return (
    <View style={[styles.row, style]}>
      {reasons.slice(0, max).map((r, i) => {
        const c = COLOR[r.tone] || COLOR.good;
        return (
          <View key={`${r.label}-${i}`} style={[styles.chip, { backgroundColor: `${c}1A`, borderColor: `${c}4D` }]}>
            <Text style={[styles.mark, { color: c }]}>{MARK[r.tone] || '✓'}</Text>
            <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
              {r.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  mark: { fontSize: 10, fontWeight: '900' },
  label: { fontSize: 11, fontWeight: '700' },
});
