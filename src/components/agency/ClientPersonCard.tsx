import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const gold = isDark ? '#E8D5A3' : '#8A6A32';
  const luxuryBg = isDark ? 'rgba(232,213,163,0.08)' : '#F7F3EC';

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
        <Text style={[styles.monogramText, { color: accent }]}>{initials}</Text>
      </View>
      <Text style={[styles.name, { color: colors.text }]}>
        {firstName} {lastName}
      </Text>
      <Text style={[styles.clientId, { color: gold }]}>ID {clientId}</Text>
      <View style={styles.roleRow}>
        {personRoles.includes('SELLER') ? (
          <Text style={[styles.role, { color: '#34C759' }]}>Sprzedający</Text>
        ) : null}
        {dual ? <Text style={[styles.roleSep, { color: colors.secondary }]}>/</Text> : null}
        {personRoles.includes('BUYER') ? (
          <Text style={[styles.role, { color: '#FF9500' }]}>Kupujący</Text>
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
          <Text style={styles.portalText}>Panel klienta</Text>
        </Pressable>
      ) : null}

      <View style={[styles.luxuryWrap, { backgroundColor: luxuryBg, borderColor: isDark ? 'rgba(232,213,163,0.18)' : 'rgba(138,106,50,0.18)' }]}>
        {phone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${phone}`)} style={styles.luxuryBlock}>
            <Text style={[styles.luxuryKicker, { color: gold }]}>Telefon</Text>
            <Text style={[styles.luxuryValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
              {formatPhoneNumber(phone)}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.luxuryBlock}>
            <Text style={[styles.luxuryKicker, { color: gold }]}>Telefon</Text>
            <Text style={[styles.luxuryMuted, { color: colors.secondary }]}>Brak numeru</Text>
          </View>
        )}
        <View style={[styles.luxuryRule, { backgroundColor: isDark ? 'rgba(232,213,163,0.18)' : 'rgba(138,106,50,0.16)' }]} />
        {email ? (
          <Pressable onPress={() => Linking.openURL(`mailto:${email}`)} style={styles.luxuryBlock}>
            <Text style={[styles.luxuryKicker, { color: gold }]}>E-mail</Text>
            <Text style={[styles.luxuryEmail, { color: colors.text }]} numberOfLines={2}>
              {email}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.luxuryBlock}>
            <Text style={[styles.luxuryKicker, { color: gold }]}>E-mail</Text>
            <Text style={[styles.luxuryMuted, { color: colors.secondary }]}>Brak e-maila</Text>
          </View>
        )}
      </View>

      {(pesel || kwNumbers.length > 0) ? (
        <View style={[styles.group, { backgroundColor: colors.input }]}>
          {pesel ? (
            <View style={[styles.row, kwNumbers.length ? { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth } : null]}>
              <Text style={[styles.rowLabel, { color: colors.secondary }]}>PESEL</Text>
              <Text style={[styles.rowValue, { color: colors.text }]}>{pesel}</Text>
            </View>
          ) : null}
          {kwNumbers.map((item, index) => (
            <Pressable key={`kw-${item.kw}`} onPress={() => onOpenKw(item.kw)}>
              <View
                style={[
                  styles.row,
                  index < kwNumbers.length - 1 ? { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth } : null,
                ]}
              >
                <Text style={[styles.rowLabel, { color: colors.secondary }]}>KW</Text>
                <Text style={[styles.rowValue, { color: '#007AFF' }]} numberOfLines={1}>
                  {item.kw}
                </Text>
                <Ionicons name="open-outline" size={13} color="#007AFF" />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

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
  clientId: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  roleRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  role: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  roleSep: {
    fontSize: 13,
    fontWeight: '600',
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
  luxuryWrap: {
    alignSelf: 'stretch',
    marginTop: 18,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  luxuryBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  luxuryKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  luxuryValue: {
    marginTop: 6,
    fontSize: 28,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    letterSpacing: 0.6,
  },
  luxuryEmail: {
    marginTop: 6,
    fontSize: 18,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    letterSpacing: 0.2,
  },
  luxuryMuted: {
    marginTop: 6,
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontStyle: 'italic',
  },
  luxuryRule: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  group: {
    alignSelf: 'stretch',
    marginTop: 12,
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
