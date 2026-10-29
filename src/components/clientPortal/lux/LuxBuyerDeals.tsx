import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LUX_SERIF, plnFormat, type LuxPalette } from './luxTheme';
import { LuxButton, LuxCard, LuxField, LuxKicker } from './LuxUI';
import { luxAction } from './luxApi';
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

/** Kontroferta sprzedającego z zegarem 48 h: przyjmij / zaproponuj / zrezygnuj — trafia do agenta. */
function PendingOffer({ deal, token, palette, onChanged }: { deal: LuxBuyerDeal; token: string; palette: LuxPalette; onChanged: () => void }) {
  const offer = deal.pendingOffer!;
  const [counter, setCounter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const hours = Math.max(0, Math.round((new Date(offer.deadline).getTime() - Date.now()) / 3_600_000));
  const send = async (kind: 'accept' | 'counter' | 'reject') => {
    const amount = kind === 'counter' ? Number(counter.replace(/\D/g, '')) : null;
    if (kind === 'counter' && !amount) return Alert.alert('Twoja kwota', 'Wpisz kwotę.');
    setBusy(kind);
    try {
      await luxAction(token, 'respond_deal_offer', { dealId: deal.dealId, offerId: offer.id, kind, amount });
      Alert.alert('Odpowiedź wysłana', 'Agent przekaże ją sprzedającemu.');
      onChanged();
    } catch (e) {
      Alert.alert('Nie udało się wysłać', e instanceof Error ? e.message : 'Spróbuj ponownie.');
    } finally {
      setBusy(null);
    }
  };
  if (offer.answered) {
    return <Text style={{ fontSize: 13, color: palette.muted, marginTop: 12 }}>Twoja odpowiedź jest u agenta.</Text>;
  }
  return (
    <View style={[styles.box, { backgroundColor: palette.cardAlt, borderWidth: 1, borderColor: palette.warn }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, color: palette.ink }}>
          Sprzedający proponuje <Text style={{ fontWeight: '700' }}>{plnFormat(offer.amount)}</Text>
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: palette.warn }}>{hours} h</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <LuxButton palette={palette} label="Przyjmuję" busy={busy === 'accept'} onPress={() => void send('accept')} style={{ flex: 1 }} />
        <LuxButton
          palette={palette}
          label="Rezygnuję"
          variant="ghost"
          busy={busy === 'reject'}
          onPress={() =>
            Alert.alert('Zrezygnować?', 'Agent dostanie Twoją decyzję.', [
              { text: 'Anuluj', style: 'cancel' },
              { text: 'Rezygnuję', style: 'destructive', onPress: () => void send('reject') },
            ])
          }
          style={{ flex: 1 }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <LuxField palette={palette} value={counter} onChangeText={setCounter} keyboardType="number-pad" placeholder="Twoja kwota" suffix="zł" />
        </View>
        <LuxButton palette={palette} label="Proponuję" variant="ghost" busy={busy === 'counter'} onPress={() => void send('counter')} />
      </View>
    </View>
  );
}

/** Panel kupującego: nieruchomości, przy których jest w procesie — etapy, cena, terminy. */
export default function LuxBuyerDeals({ deals, palette, token, onChanged }: { deals: LuxBuyerDeal[]; palette: LuxPalette; token: string; onChanged: () => void }) {
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
            {deal.pendingOffer && !deal.agreedPrice ? <PendingOffer deal={deal} token={token} palette={palette} onChanged={onChanged} /> : null}
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
