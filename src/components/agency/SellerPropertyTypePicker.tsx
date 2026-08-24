import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const SELLER_PROPERTY_TYPES = [
  { id: 'FLAT', label: 'Mieszkanie', icon: 'business-outline' as const },
  { id: 'HOUSE', label: 'Dom', icon: 'home-outline' as const },
  { id: 'PLOT', label: 'Działka', icon: 'leaf-outline' as const },
  { id: 'COMMERCIAL', label: 'Lokal', icon: 'storefront-outline' as const },
] as const;

export type SellerPropertyTypeId = (typeof SELLER_PROPERTY_TYPES)[number]['id'];

export function sellerPropertyTypeLabel(id: string): string {
  return SELLER_PROPERTY_TYPES.find((item) => item.id === id)?.label || 'Mieszkanie';
}

export default function SellerPropertyTypePicker({
  value,
  onChange,
  isDark,
  disabled,
}: {
  value: SellerPropertyTypeId | string;
  onChange: (id: SellerPropertyTypeId) => void;
  isDark?: boolean;
  disabled?: boolean;
}) {
  const muted = isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.55)';
  const selectedValue = SELLER_PROPERTY_TYPES.some((item) => item.id === value)
    ? (value as SellerPropertyTypeId)
    : SELLER_PROPERTY_TYPES.find((item) => item.label === value)?.id || 'FLAT';

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: muted }]}>TYP NIERUCHOMOŚCI</Text>
      <View style={styles.grid}>
        {SELLER_PROPERTY_TYPES.map((option) => {
          const selected = selectedValue === option.id;
          const floor = selected
            ? isDark
              ? (['#1A3A28', '#245C3C', '#163024'] as const)
              : (['#D8F3E4', '#A7F3D0', '#6EE7B7'] as const)
            : isDark
              ? (['#2A2A2C', '#1C1C1E', '#141416'] as const)
              : (['#FBFaf7', '#EBE8E1', '#E0DCD4'] as const);
          const ink = selected ? (isDark ? '#D1FAE5' : '#065F46') : isDark ? '#E5E5EA' : '#3A3A3C';
          return (
            <Pressable
              key={option.id}
              disabled={disabled}
              onPress={() => onChange(option.id)}
              style={[styles.cell, { opacity: disabled ? 0.55 : 1 }]}
            >
              <LinearGradient colors={[...floor]} style={styles.tile}>
                <View
                  pointerEvents="none"
                  style={[
                    styles.inset,
                    {
                      borderColor: selected
                        ? 'rgba(16,185,129,0.35)'
                        : isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(196,163,90,0.28)',
                    },
                  ]}
                />
                <Ionicons name={option.icon} size={20} color={ink} />
                <Text style={[styles.tileLabel, { color: ink }]}>{option.label}</Text>
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: '48%',
    flexGrow: 1,
  },
  tile: {
    minHeight: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  inset: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
