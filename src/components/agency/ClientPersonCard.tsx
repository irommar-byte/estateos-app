import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPhoneNumber } from '../../utils/crmFormatters';

type KwRow = { kw: string; verified: boolean };

type Colors = {
  card: string;
  text: string;
  secondary: string;
  border: string;
  input: string;
};

export default function ClientPersonCard({
  firstName,
  lastName,
  type,
  phone,
  email,
  pesel,
  kwNumbers,
  sentCount,
  opinionCount,
  chatCount,
  portalUrl,
  colors,
  isDark,
  onOpenKw,
}: {
  firstName: string;
  lastName: string;
  type: 'BUYER' | 'SELLER';
  phone?: string | null;
  email?: string | null;
  pesel?: string | null;
  kwNumbers: KwRow[];
  sentCount: number;
  opinionCount: number;
  chatCount: number;
  portalUrl?: string | null;
  colors: Colors;
  isDark: boolean;
  onOpenKw: (kw: string) => void;
}) {
  const isBuyer = type === 'BUYER';
  const accent = isBuyer ? '#FF9500' : '#34C759';
  const initials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || 'K';
  const rows: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress?: () => void; verified?: boolean }[] = [];
  if (phone) {
    rows.push({
      key: 'phone',
      icon: 'call-outline',
      label: 'telefon',
      value: formatPhoneNumber(phone),
      onPress: () => Linking.openURL(`tel:${phone}`),
    });
  }
  rows.push({
    key: 'email',
    icon: 'mail-outline',
    label: 'mail',
    value: email || 'Brak e-maila',
    onPress: email ? () => Linking.openURL(`mailto:${email}`) : undefined,
  });
  if (pesel) {
    rows.push({ key: 'pesel', icon: 'card-outline', label: 'PESEL', value: pesel });
  }
  kwNumbers.forEach((item) => {
    rows.push({
      key: `kw-${item.kw}`,
      icon: item.verified ? 'shield-checkmark' : 'document-text-outline',
      label: 'KW',
      value: item.kw,
      verified: item.verified,
      onPress: () => onOpenKw(item.kw),
    });
  });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.45 : 0.1,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
        },
      ]}
    >
      <View style={[styles.monogram, { backgroundColor: isBuyer ? 'rgba(255,149,0,0.16)' : 'rgba(52,199,89,0.16)' }]}>
        <Text style={[styles.monogramText, { color: accent }]}>{initials}</Text>
      </View>
      <Text style={[styles.name, { color: colors.text }]}>{firstName} {lastName}</Text>
      <Text style={[styles.role, { color: accent }]}>{isBuyer ? 'Kupujący' : 'Sprzedający'}</Text>

      {portalUrl ? (
        <Pressable
          onPress={() =>
            Linking.openURL(portalUrl.startsWith('http') ? portalUrl : `https://estateos.pl${portalUrl}`)
          }
          style={[styles.portalBtn, { backgroundColor: colors.input, borderColor: colors.border }]}
        >
          <Ionicons name="person-circle-outline" size={16} color="#007AFF" />
          <Text style={styles.portalText}>Panel klienta</Text>
        </Pressable>
      ) : null}

      <View style={[styles.group, { backgroundColor: colors.input }]}>
        {rows.map((row, index) => {
          const content = (
            <View style={[styles.row, index < rows.length - 1 ? { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth } : null]}>
              <Text style={[styles.rowLabel, { color: colors.secondary }]}>{row.label}</Text>
              <Text
                style={[styles.rowValue, { color: row.onPress ? '#007AFF' : colors.text }]}
                numberOfLines={1}
              >
                {row.value}
              </Text>
              {row.key.startsWith('kw-') ? <Ionicons name="open-outline" size={13} color="#007AFF" /> : null}
            </View>
          );
          return row.onPress ? (
            <Pressable key={row.key} onPress={row.onPress}>
              {content}
            </Pressable>
          ) : (
            <View key={row.key}>{content}</View>
          );
        })}
      </View>

      <View style={styles.stats}>
        <View style={[styles.stat, { backgroundColor: colors.input }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{sentCount}</Text>
          <Text style={[styles.statLabel, { color: colors.secondary }]}>Wysłane</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: colors.input }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{opinionCount}</Text>
          <Text style={[styles.statLabel, { color: colors.secondary }]}>Z opinią</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: colors.input }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{chatCount}</Text>
          <Text style={[styles.statLabel, { color: colors.secondary }]}>Czat</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    marginBottom: 16,
    alignItems: 'center',
  },
  monogram: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  name: {
    marginTop: 14,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  role: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  portalBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  portalText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '700',
  },
  group: {
    alignSelf: 'stretch',
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: {
    width: 58,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  rowValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  stats: {
    alignSelf: 'stretch',
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
