import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config/network';
import type { DelegatedOffer } from '../../services/leadTransferService';
import { formatCommissionRate, parseLeadConditions } from '../../types/leadTransfer';

type Props = {
  offers: DelegatedOffer[];
  isDark?: boolean;
};

function mediaUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw.startsWith('/') ? `${API_URL}${raw}` : raw;
}

function fmtPrice(value: number) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

export default function DelegatedOffersSection({ offers, isDark = false }: Props) {
  const colors = useMemo(
    () => ({
      card: isDark ? '#1C1C1E' : '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#000000',
      secondary: isDark ? '#8E8E93' : '#6C6C70',
      separator: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
      accent: '#007AFF',
      termsBg: isDark ? '#132318' : '#E8F8EC',
    }),
    [isDark],
  );

  if (offers.length === 0) return null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Ionicons name="eye" size={20} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Pod opieką agencji</Text>
          <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            Masz podgląd postępów i zapisane warunki — sprzedażą zajmuje się biuro.
          </Text>
        </View>
      </View>

      {offers.map((offer) => {
        const parsed = parseLeadConditions(offer.commissionTerms);
        return (
          <View
            key={offer.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}
          >
            <Pressable
              onPress={() => void Linking.openURL(`${API_URL}/oferta/${offer.id}`)}
              style={styles.preview}
            >
              {mediaUrl(offer.imageUrl) ? (
                <Image source={{ uri: mediaUrl(offer.imageUrl)! }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <Ionicons name="home" size={24} color="#8E8E93" />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }} numberOfLines={2}>
                  {offer.title}
                </Text>
                <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                  {[offer.city, offer.district].filter(Boolean).join(', ')}
                </Text>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17, marginTop: 6 }}>
                  {fmtPrice(offer.pricePln ?? offer.price)}
                </Text>
              </View>
            </Pressable>

            <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 10 }}>
              Biuro: {offer.agency.name || 'Agencja'}
            </Text>

            {offer.commissionRate != null ? (
              <View style={[styles.termsBox, { backgroundColor: colors.termsBg }]}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>
                  Prowizja: {formatCommissionRate(offer.commissionRate)}
                </Text>
                {parsed.isStructured && parsed.conditions.length > 0 ? (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {parsed.conditions.map((c, i) => (
                      <View key={c.id} style={styles.conditionRow}>
                        <Text style={styles.conditionIndex}>{i + 1}</Text>
                        <Text style={{ color: colors.secondary, fontSize: 13, flex: 1, lineHeight: 19 }}>
                          {c.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : parsed.rawText ? (
                  <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 6, lineHeight: 20 }}>
                    {parsed.rawText}
                  </Text>
                ) : null}
                {parsed.customNote ? (
                  <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
                    <Text style={{ fontWeight: '700', color: colors.text }}>Uwagi: </Text>
                    {parsed.customNote}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 8, gap: 12 },
  header: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800' },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  preview: { flexDirection: 'row', gap: 12 },
  image: { width: 80, height: 80, borderRadius: 12 },
  imagePlaceholder: {
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsBox: { borderRadius: 12, padding: 12, marginTop: 10 },
  conditionRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  conditionIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(52,199,89,0.15)',
    color: '#34C759',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 20,
    overflow: 'hidden',
  },
});
