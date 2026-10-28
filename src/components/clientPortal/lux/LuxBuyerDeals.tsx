import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LUX_SERIF, plnFormat, type LuxPalette } from './luxTheme';
import { LuxCard, LuxKicker } from './LuxUI';
import type { LuxBuyerDeal } from './types';
import { resolveMediaUrl } from '../../../utils/userAvatar';

const OFFER_STATUS: Record<NonNullable<LuxBuyerDeal['yourOffer']>['status'], string> = {
  open: 'czeka na odpowiedź sprzedającego',
  accepted: 'przyjęta',
  rejected: 'odrzucona',
  countered: 'sprzedający zaproponował inną kwotę',
  withdrawn: 'wycofana',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Panel kupującego: nieruchomości, przy których jest w procesie — etapy, cena, terminy. */
export default function LuxBuyerDeals({ deals, palette }: { deals: LuxBuyerDeal[]; palette: LuxPalette }) {
  if (!deals.length) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <LuxKicker palette={palette}>{deals.length === 1 ? 'Twoja nieruchomość' : 'Twoje nieruchomości'}</LuxKicker>
      {deals.map((deal) => {
        const cover = resolveMediaUrl(deal.imageUrl);
        return (
          <LuxCard key={deal.offerId} palette={palette} style={{ marginTop: 10 }}>
            <View style={styles.head}>
              {cover ? <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" /> : null}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: LUX_SERIF, fontSize: 18, color: palette.ink }} numberOfLines={2}>
                  {deal.title}
                </Text>
                {deal.address ? <Text style={{ fontSize: 13, color: palette.muted, marginTop: 2 }}>{deal.address}</Text> : null}
                <Text style={{ fontSize: 13, color: palette.good, fontWeight: '700', marginTop: 4 }}>{deal.status}</Text>
              </View>
            </View>
            <View style={styles.phases}>
              {deal.phases.map((phase, index) => (
                <View key={phase.id} style={styles.phase}>
                  <View style={styles.railRow}>
                    <View style={[styles.rail, { backgroundColor: index === 0 ? 'transparent' : deal.phases[index - 1].done ? palette.good : palette.border }]} />
                    <View
                      style={[
                        styles.dot,
                        phase.done
                          ? { backgroundColor: palette.good, borderColor: palette.good }
                          : phase.current
                            ? { backgroundColor: palette.warn, borderColor: palette.warn }
                            : { borderColor: palette.border, backgroundColor: palette.card },
                      ]}
                    >
                      {phase.done ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
                    </View>
                    <View style={[styles.rail, { backgroundColor: index === deal.phases.length - 1 ? 'transparent' : phase.done ? palette.good : palette.border }]} />
                  </View>
                  <Text style={{ fontSize: 11, color: phase.current ? palette.ink : palette.muted, fontWeight: phase.current ? '700' : '500', marginTop: 4, textAlign: 'center' }}>
                    {phase.label}
                    {phase.skipped ? '\npominięte' : ''}
                  </Text>
                </View>
              ))}
            </View>
            {deal.agreedPrice || deal.yourOffer || deal.reservedUntil ? (
              <View style={[styles.box, { backgroundColor: palette.cardAlt }]}>
                {deal.agreedPrice ? (
                  <Text style={{ fontSize: 14, color: palette.ink }}>Uzgodniona cena: {plnFormat(deal.agreedPrice)}</Text>
                ) : deal.yourOffer ? (
                  <Text style={{ fontSize: 14, color: palette.ink }}>
                    Twoja propozycja: {plnFormat(deal.yourOffer.amount)} — {OFFER_STATUS[deal.yourOffer.status]}
                  </Text>
                ) : null}
                {deal.reservedUntil ? (
                  <Text style={{ fontSize: 13, color: palette.muted, marginTop: 4 }}>
                    Zarezerwowane dla Ciebie do {new Date(deal.reservedUntil).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {deal.dates.map((item) => (
              <View key={item.label} style={[styles.dateRow, { borderTopColor: palette.border }]}>
                <Text style={{ fontSize: 13, color: palette.muted }}>{item.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: item.done ? palette.good : palette.ink }}>
                  {item.done ? '✓ ' : ''}
                  {when(item.at)}
                </Text>
              </View>
            ))}
          </LuxCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 12 },
  cover: { width: 64, height: 64, borderRadius: 12 },
  phases: { flexDirection: 'row', marginTop: 14 },
  phase: { flex: 1, alignItems: 'center' },
  railRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  rail: { flex: 1, height: 2 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  box: { borderRadius: 12, padding: 12, marginTop: 12 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 6 },
});
