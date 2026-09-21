import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

export const DESCRIPTION_LENGTH_PRESETS = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000] as const;

type Props = {
  targetLength: number;
  useEmojis: boolean;
  onTargetLength: (value: number) => void;
  onUseEmojis: (value: boolean) => void;
  lengthLabel: string;
  emoticonsLabel: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  inputColor: string;
  accentColor?: string;
};

export default function AiDescriptionOptions({
  targetLength,
  useEmojis,
  onTargetLength,
  onUseEmojis,
  lengthLabel,
  emoticonsLabel,
  textColor,
  mutedColor,
  borderColor,
  inputColor,
  accentColor = '#34C759',
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.lengthLabel, { color: mutedColor }]}>{lengthLabel}</Text>
        <View style={styles.switchRow}>
          <Text style={[styles.emojiLabel, { color: textColor }]}>{emoticonsLabel}</Text>
          <Switch value={useEmojis} onValueChange={onUseEmojis} />
        </View>
      </View>
      <View style={styles.chips}>
        {DESCRIPTION_LENGTH_PRESETS.map((n) => {
          const active = targetLength === n;
          return (
            <Pressable
              key={n}
              onPress={() => onTargetLength(n)}
              style={[
                styles.chip,
                {
                  borderColor: active ? accentColor : borderColor,
                  backgroundColor: active ? `${accentColor}22` : inputColor,
                },
              ]}
            >
              <Text style={{ color: textColor, fontSize: 11, fontWeight: '800' }}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10, gap: 8 },
  header: { gap: 8 },
  lengthLabel: { fontSize: 12, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  emojiLabel: { fontSize: 13, fontWeight: '700', flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
