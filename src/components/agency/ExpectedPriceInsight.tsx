import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import OfferPriceRcnScale from '../offer/OfferPriceRcnScale';
import { fetchMarketValuation, formatPln, formatPpsm, type ValuationResult } from '../../services/marketService';
import type { SellerPropertyTypeId } from './SellerPropertyTypePicker';

type Props = {
  token: string | null;
  propertyType: SellerPropertyTypeId;
  price: number | null;
  area: string;
  onAreaChange: (next: string) => void;
  lat: number | null;
  lng: number | null;
  city: string | null;
  district: string | null;
  address: string;
  isDark: boolean;
};

const AREA_LABEL: Record<SellerPropertyTypeId, string> = {
  FLAT: 'Powierzchnia mieszkania',
  HOUSE: 'Powierzchnia domu',
  PLOT: 'Powierzchnia działki',
  COMMERCIAL: 'Powierzchnia lokalu',
};

/**
 * Rozwija się pod ceną oczekiwaną: cena rekomendowana z aktów notarialnych (RCN)
 * dla tego typu nieruchomości i skala, jak daleko jest od niej cena klienta.
 */
export default function ExpectedPriceInsight({
  token,
  propertyType,
  price,
  area,
  onAreaChange,
  lat,
  lng,
  city,
  district,
  address,
  isDark,
}: Props) {
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const areaNum = Number(area.replace(',', '.'));
  const hasArea = Number.isFinite(areaNum) && areaNum > 0;
  const hasPin = lat != null && lng != null;
  const supported = propertyType !== 'COMMERCIAL';

  useEffect(() => {
    setResult(null);
    setMessage(null);
    if (!price || !token || !supported || !hasPin || !hasArea) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      void fetchMarketValuation(token, {
        lat,
        lng,
        area: areaNum,
        city,
        district,
        address,
        listingPrice: price,
        purpose: 'crm',
        propertyType,
      })
        .then((json) => {
          if (cancelled) return;
          if (json.ok) setResult(json);
          else setMessage(json.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [token, price, areaNum, hasArea, hasPin, lat, lng, city, district, address, propertyType, supported]);

  if (!price) return null;

  const text = isDark ? '#fff' : '#111';
  const secondary = isDark ? '#8E8E93' : '#6C6C70';
  const recommended = result?.estimated.recommendedAsk ?? null;
  const pct = recommended ? Math.round(((price - recommended) / recommended) * 100) : null;
  const verdict =
    pct == null
      ? null
      : Math.abs(pct) <= 5
        ? { label: 'Cena w rynku — łatwo ją obronić aktami.', color: '#15803d' }
        : pct > 0
          ? { label: `Klient oczekuje o ${pct}% więcej niż wynika z aktów — przygotuj argumenty albo korektę.`, color: pct > 15 ? '#B91C1C' : '#C2410C' }
          : { label: `Klient wycenia o ${Math.abs(pct)}% poniżej aktów — jest zapas do negocjacji w górę.`, color: '#1D4ED8' };

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.springify().damping(18)}
      style={[styles.wrap, { borderTopColor: isDark ? 'rgba(52,199,89,0.25)' : 'rgba(52,199,89,0.3)' }]}
    >
      <View style={styles.headRow}>
        <Ionicons name="analytics" size={15} color="#34C759" />
        <Text style={[styles.kicker, { color: '#34C759' }]}>CENA Z AKTÓW NOTARIALNYCH</Text>
      </View>

      {!supported ? (
        <Text style={[styles.note, { color: secondary }]}>
          Dla lokali użytkowych baza transakcji nie ma jeszcze wiarygodnego porównania.
        </Text>
      ) : (
        <>
          <Text style={[styles.areaLabel, { color: secondary }]}>{AREA_LABEL[propertyType].toUpperCase()}</Text>
          <View style={[styles.areaRow, { backgroundColor: isDark ? '#102016' : '#fff', borderColor: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.14)' }]}>
            <TextInput
              value={area}
              onChangeText={(value) => onAreaChange(value.replace(/[^\d,.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder={propertyType === 'PLOT' ? 'np. 1200' : 'np. 54'}
              placeholderTextColor={secondary}
              style={[styles.areaInput, { color: text }]}
            />
            <Text style={{ color: secondary, fontWeight: '800' }}>m²</Text>
          </View>

          {!hasPin ? (
            <Text style={[styles.note, { color: secondary }]}>Wybierz adres z podpowiedzi albo ustaw pinezkę — porównamy z transakcjami w okolicy.</Text>
          ) : !hasArea ? (
            <Text style={[styles.note, { color: secondary }]}>Podaj powierzchnię, a policzymy cenę rekomendowaną.</Text>
          ) : loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#34C759" />
              <Text style={[styles.note, { color: secondary, marginTop: 0 }]}>Liczę z transakcji w okolicy…</Text>
            </View>
          ) : message ? (
            <Text style={[styles.note, { color: secondary }]}>{message}</Text>
          ) : result && recommended ? (
            <>
              <View style={styles.figures}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.figLabel, { color: secondary }]}>Rekomendowana</Text>
                  <Text style={[styles.figValue, { color: '#15803d' }]}>{formatPln(recommended)}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.figLabel, { color: secondary }]}>Oczekiwana klienta</Text>
                  <Text style={[styles.figValue, { color: text }]}>{formatPln(price)}</Text>
                </View>
              </View>
              <OfferPriceRcnScale
                listingPrice={price}
                recommendedAsk={recommended}
                isDark={isDark}
                compact
                labels={{ below: 'taniej niż rynek', recommended: 'rekomendowana', above: 'drożej niż rynek' }}
              />
              {verdict ? <Text style={[styles.verdict, { color: verdict.color }]}>{verdict.label}</Text> : null}
              <Text style={[styles.foot, { color: secondary }]}>
                Przedział {formatPln(result.estimated.low)} – {formatPln(result.estimated.high)} · mediana{' '}
                {formatPpsm(result.stats.medianPpsm)} · {result.stats.count} transakcji w promieniu{' '}
                {Math.round(result.stats.radiusM)} m
              </Text>
            </>
          ) : null}
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  areaLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginBottom: 4 },
  areaRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  areaInput: { flex: 1, fontSize: 16, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 17, marginTop: 10 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  figures: { flexDirection: 'row', marginTop: 12, marginBottom: 10 },
  figLabel: { fontSize: 11, fontWeight: '700' },
  figValue: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3, marginTop: 2 },
  verdict: { fontSize: 13, fontWeight: '800', lineHeight: 18, marginTop: 10 },
  foot: { fontSize: 11, lineHeight: 16, marginTop: 6 },
});
