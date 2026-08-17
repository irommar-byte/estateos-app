import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function WheelNumberPicker({
  label,
  options,
  value,
  onSelect,
  isDark,
  disabled,
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onSelect: (val: string) => void;
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
        {options.map((item) => {
          const active = value === item.value;
          return (
            <Pressable
              key={item.value}
              disabled={disabled}
              onPress={() => onSelect(item.value)}
              style={[
                styles.wheelItem,
                {
                  backgroundColor: active ? colors.accent : colors.input,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.wheelText,
                  {
                    color: active ? '#000' : colors.text,
                    fontWeight: active ? '900' : '700',
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
  scrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 10,
  },
  wheelItem: {
    minWidth: 46,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelText: {
    fontSize: 14,
  },
});
