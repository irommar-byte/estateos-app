import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPeselDecode } from '../../lib/pesel';
import {
  dialCodeFor,
  flagEmojiFromIso2,
  formatNationalAsYouType,
  parseStoredPhoneToLine,
} from '../../utils/phoneRegions';

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

function formatPhoneParts(phone: string) {
  const line = parseStoredPhoneToLine(phone, 'PL');
  const iso = line.iso || 'PL';
  const digits = line.nationalDigits || '';
  const national =
    iso === 'PL' && digits.length === 9
      ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
      : formatNationalAsYouType(iso, digits) || digits || phone.trim();
  return {
    flag: flagEmojiFromIso2(iso),
    dial: `+${dialCodeFor(iso)}`,
    national,
  };
}

function FactRow({
  label,
  last,
  colors,
  onPress,
  children,
}: {
  label: string;
  last?: boolean;
  colors: Colors;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const inner = (
    <View style={[styles.row, !last ? { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth } : null]}>
      <Text style={[styles.rowLabel, appleType, { color: colors.secondary }]}>{label}</Text>
      {children}
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
  const ink = dual ? '#8A7A4A' : type === 'BUYER' ? '#A15C12' : '#1F6B45';
  const initials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || 'K';
  const peselHint = pesel ? formatPeselDecode(pesel) : null;
  const phoneParts = phone ? formatPhoneParts(phone) : null;
  const roleLabel = [
    personRoles.includes('SELLER') ? 'Sprzedający' : null,
    personRoles.includes('BUYER') ? 'Kupujący' : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? colors.border : 'rgba(60,60,67,0.08)',
          shadowColor: '#1C1917',
          shadowOpacity: isDark ? 0.5 : 0.07,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 14 },
        },
      ]}
    >
      <View style={styles.identity}>
        <View style={[styles.monogram, { borderColor: colors.border }]}>
          <Text style={[styles.monogramText, appleType, { color: ink }]}>{initials}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={[styles.name, appleType, { color: colors.text }]} numberOfLines={2}>
            {firstName} {lastName}
          </Text>
          <Text style={[styles.meta, appleType, { color: colors.secondary }]}>
            {roleLabel}
            <Text style={styles.metaDot}>  ·  </Text>
            Nr {clientId}
          </Text>
          {portalUrl ? (
            <Pressable
              onPress={() =>
                Linking.openURL(portalUrl.startsWith('http') ? portalUrl : `https://estateos.pl${portalUrl}`)
              }
              style={({ pressed }) => [styles.portalLink, { opacity: pressed ? 0.55 : 1 }]}
            >
              <Text style={[styles.portalText, appleType]}>Panel klienta</Text>
              <Ionicons name="open-outline" size={13} color="#8A8A8E" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.rule, { backgroundColor: colors.border }]} />

      <View style={styles.facts}>
        <FactRow
          label="Telefon"
          colors={colors}
          onPress={phone ? () => Linking.openURL(`tel:${phone}`) : undefined}
        >
          {phoneParts ? (
            <View style={styles.phoneValue}>
              <Text style={styles.flag}>{phoneParts.flag}</Text>
              <Text style={[styles.dial, appleType, { color: colors.secondary }]}>{phoneParts.dial}</Text>
              <Text style={[styles.national, appleType, { color: colors.text }]}>{phoneParts.national}</Text>
            </View>
          ) : (
            <Text style={[styles.rowValue, appleType, { color: colors.secondary, fontWeight: '400' }]}>Brak</Text>
          )}
        </FactRow>
        <FactRow
          label="E-mail"
          colors={colors}
          onPress={email ? () => Linking.openURL(`mailto:${email}`) : undefined}
        >
          <Text
            style={[styles.rowValue, appleType, { color: email ? colors.text : colors.secondary, fontWeight: email ? '500' : '400' }]}
            numberOfLines={2}
          >
            {email || 'Brak'}
          </Text>
        </FactRow>
        <FactRow label="PESEL" colors={colors} last={!kwNumbers.length}>
          {pesel ? (
            <View>
              <Text style={[styles.rowValue, appleType, { color: colors.text }]}>{pesel}</Text>
              {peselHint ? (
                <Text style={[styles.peselHint, appleType, { color: colors.secondary }]}>{peselHint}</Text>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.rowValue, appleType, { color: colors.secondary, fontWeight: '400' }]}>Brak</Text>
          )}
        </FactRow>
        {kwNumbers.map((item, index) => (
          <FactRow
            key={`kw-${item.kw}`}
            label="KW"
            last={index === kwNumbers.length - 1}
            colors={colors}
            onPress={() => onOpenKw(item.kw)}
          >
            <Text style={[styles.rowValue, appleType, { color: colors.text }]}>{item.kw}</Text>
          </FactRow>
        ))}
      </View>

      <View style={[styles.stats, { borderTopColor: colors.border }]}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, appleType, { color: colors.text }]}>{sentCount}</Text>
          <Text style={[styles.statLabel, appleType, { color: colors.secondary }]}>Wysłane</Text>
        </View>
        <View style={[styles.statRule, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, appleType, { color: colors.text }]}>{opinionCount}</Text>
          <Text style={[styles.statLabel, appleType, { color: colors.secondary }]}>Z opinią</Text>
        </View>
        <View style={[styles.statRule, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, appleType, { color: colors.text }]}>{chatCount}</Text>
          <Text style={[styles.statLabel, appleType, { color: colors.secondary }]}>Czat</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  monogram: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
  },
  monogramText: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.44,
    lineHeight: 26,
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.08,
  },
  metaDot: {
    fontWeight: '400',
  },
  portalLink: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  portalText: {
    color: '#6C6C70',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.08,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 18,
    marginBottom: 4,
  },
  facts: {
    alignSelf: 'stretch',
  },
  row: {
    paddingVertical: 13,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  rowValue: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.41,
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  phoneValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  flag: {
    fontSize: 15,
    lineHeight: 20,
  },
  dial: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  national: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  peselHint: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.08,
  },
  stats: {
    alignSelf: 'stretch',
    marginTop: 4,
    paddingTop: 14,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statRule: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    marginHorizontal: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.32,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
});
