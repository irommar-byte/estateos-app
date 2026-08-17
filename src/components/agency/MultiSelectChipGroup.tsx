import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function MultiSelectChipGroup({
  label,
  options,
  selected,
  onToggle,
  isDark,
  disabled,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  isDark?: boolean;
  disabled?: boolean;
}) {
  const colors = {
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    input: isDark ? '#2C2C2E' : '#F2F2F7',
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    accent: '#34C759',
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
      <View style={styles.chipGrid}>
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <Pressable
              key={option}
              disabled={disabled}
              onPress={() => onToggle(option)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.accent : colors.input,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: active ? '#000000' : colors.text,
                    fontWeight: active ? '800' : '600',
                  },
                ]}
              >
                {active ? '✓ ' : ''}{option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
});
