import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPhoneNumber } from '../../utils/crmFormatters';

const appleType = Platform.select({
  ios: { fontFamily: 'System' as const },
  android: { fontFamily: 'sans-serif' as const },
  default: {},
});

type KwRow = { kw: string; verified: boolean };

type Colors = {
  card: string;
  text: string;
  secondary: string;
  border: string;
  input: string;
};

function FactRow({
  label,
  value,
  muted,
  last,
  colors,
  onPress,
  link,
}: {
  label: string;
  value: string;
  muted?: boolean;
  last?: boolean;
  colors: Colors;
  onPress?: () => void;
  link?: boolean;
}) {
  const inner = (
    <View style={[styles.row, !last ? { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth } : null]}>
      <Text style={[styles.rowLabel, appleType, { color: colors.secondary }]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          appleType,
          {
            color: muted ? colors.secondary : link ? '#007AFF' : colors.text,
            fontWeight: muted ? '400' : '600',
          },
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
      {link ? <Ionicons name="chevron-forward" size={13} color="#C7C7CC" /> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

export default function ClientPersonCard({
  clientId,
  firstName,
  lastName,
  type,
  roles,
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
  clientId: number;
  firstName: string;
  lastName: string;
  type: 'BUYER' | 'SELLER';
  roles?: Array<'BUYER' | 'SELLER'>;
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
  const personRoles = roles?.length ? roles : [type];
  const dual = personRoles.includes('BUYER') && personRoles.includes('SELLER');
  const accent = dual ? '#C9A227' : type === 'BUYER' ? '#FF9500' : '#34C759';
  const initials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || 'K';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.45 : 0.08,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
        },
      ]}
    >
      <View
        style={[
          styles.monogram,
          {
            backgroundColor: dual
              ? 'rgba(201,162,39,0.16)'
              : type === 'BUYER'
                ? 'rgba(255,149,0,0.16)'
                : 'rgba(52,199,89,0.16)',
          },
        ]}
      >
        <Text style={[styles.monogramText, appleType, { color: accent }]}>{initials}</Text>
      </View>
      <Text style={[styles.name, appleType, { color: colors.text }]}>
        {firstName} {lastName}
      </Text>
      <Text style={[styles.clientId, appleType, { color: colors.secondary }]}>ID {clientId}</Text>
      <View style={styles.roleRow}>
        {personRoles.includes('SELLER') ? (
          <Text style={[styles.role, appleType, { color: colors.secondary }]}>Sprzedający</Text>
        ) : null}
        {dual ? <Text style={[styles.roleSep, appleType, { color: colors.secondary }]}>·</Text> : null}
        {personRoles.includes('BUYER') ? (
          <Text style={[styles.role, appleType, { color: colors.secondary }]}>Kupujący</Text>
        ) : null}
      </View>

      {portalUrl ? (
        <Pressable
          onPress={() =>
            Linking.openURL(portalUrl.startsWith('http') ? portalUrl : `https://estateos.pl${portalUrl}`)
          }
          style={[styles.portalBtn, { backgroundColor: colors.input, borderColor: colors.border }]}
        >
          <Ionicons name="person-circle-outline" size={16} color="#007AFF" />
          <Text style={[styles.portalText, appleType]}>Panel klienta</Text>
        </Pressable>
      ) : null}

      <View style={[styles.group, { backgroundColor: colors.input }]}>
        <FactRow
          label="Telefon"
          value={phone ? formatPhoneNumber(phone) : 'Brak'}
          muted={!phone}
          colors={colors}
          onPress={phone ? () => Linking.openURL(`tel:${phone}`) : undefined}
          link={Boolean(phone)}
        />
        <FactRow
          label="E-mail"
          value={email || 'Brak'}
          muted={!email}
          colors={colors}
          onPress={email ? () => Linking.openURL(`mailto:${email}`) : undefined}
          link={Boolean(email)}
        />
        <FactRow
          label="PESEL"
          value={pesel || 'Brak'}
          muted={!pesel}
          colors={colors}
          last={!kwNumbers.length}
        />
        {kwNumbers.map((item, index) => (
          <FactRow
            key={`kw-${item.kw}`}
            label="KW"
            value={item.kw}
            last={index === kwNumbers.length - 1}
            colors={colors}
            onPress={() => onOpenKw(item.kw)}
            link
          />
        ))}
      </View>

      <View style={styles.stats}>
        <View style={[styles.stat, { backgroundColor: colors.input }]}>
          <Text style={[styles.statValue, appleType, { color: colors.text }]}>{sentCount}</Text>
          <Text style={[styles.statLabel, appleType, { color: colors.secondary }]}>Wysłane</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: colors.input }]}>
          <Text style={[styles.statValue, appleType, { color: colors.text }]}>{opinionCount}</Text>
          <Text style={[styles.statLabel, appleType, { color: colors.secondary }]}>Z opinią</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: colors.input }]}>
          <Text style={[styles.statValue, appleType, { color: colors.text }]}>{chatCount}</Text>
          <Text style={[styles.statLabel, appleType, { color: colors.secondary }]}>Czat</Text>
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
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  name: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  clientId: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.08,
  },
  roleRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  role: {
    fontSize: 13,
    fontWeight: '400',
  },
  roleSep: {
    fontSize: 13,
    fontWeight: '400',
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
    fontWeight: '600',
  },
  group: {
    alignSelf: 'stretch',
    marginTop: 18,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.24,
  },
  rowValue: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.41,
    textAlign: 'right',
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
    fontSize: 17,
    fontWeight: '600',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '400',
  },
});
