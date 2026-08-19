import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  fetchMarketValuation,
  formatPln,
  formatPpsm,
  sendMarketReport,
  type ValuationResult,
} from '../../services/marketService';

type Props = {
  token: string | null;
  lat?: number | null;
  lng?: number | null;
  area?: number | null;
  rooms?: number | null;
  floor?: number | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  listingPrice?: number | null;
  purpose?: 'crm' | 'listing' | 'consumer' | 'hub';
  colors: { card: string; text: string; secondary: string; border: string; accent: string };
  onApply?: (price: number) => void;
  reportEmail?: string | null;
};

export default function MarketValuationCard({
  token,
  lat,
  lng,
  area,
  rooms,
  floor,
  city,
  district,
  address,
  listingPrice,
  purpose = 'crm',
  colors,
  onApply,
  reportEmail,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [reportMsg, setReportMsg] = useState('');

  useEffect(() => {
    if (lat == null || lng == null || !area) {
      setResult(null);
      setError('Uzupełnij adres na mapie i powierzchnię.');
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      void fetchMarketValuation(token, {
        lat, lng, area, rooms, floor, city, district, address, listingPrice, purpose,
      }).then((json) => {
        if (cancelled) return;
        if (!json.ok) {
          setResult(null);
          setError(json.message);
        } else {
          setResult(json);
        }
      }).finally(() => {
        if (!cancelled) setLoading(false);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, lat, lng, area, rooms, floor, city, district, address, listingPrice, purpose]);

  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(52,199,89,0.28)', backgroundColor: colors.card, overflow: 'hidden', marginBottom: 14 }}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 10, letterSpacing: 1.2 }}>ESTATEOS™ MARKET</Text>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, marginTop: 3 }}>Rzeczywiste ceny transakcyjne (RCN)</Text>
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Text style={{ color: '#F59E0B', fontSize: 13, lineHeight: 18 }}>{error}</Text> : null}
        {result ? (
          <>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900' }}>{formatPln(result.estimated.mid)}</Text>
            <Text style={{ color: colors.secondary, fontSize: 13 }}>
              {formatPln(result.estimated.low)} – {formatPln(result.estimated.high)} · {formatPpsm(result.estimated.ppsm)}
            </Text>
            <Text style={{ color: colors.secondary, fontSize: 12 }}>
              {result.stats.count} aktów · {result.stats.windowMonths} mies.
              {result.stats.basis === 'comps' ? ` · ${result.stats.radiusM} m` : ''}
            </Text>
            {result.vsListing ? (
              <View style={{ borderRadius: 14, padding: 12, backgroundColor: 'rgba(52,199,89,0.1)' }}>
                <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 12 }}>PRICE SCORE {result.vsListing.score}/100</Text>
                <Text style={{ color: colors.text, fontWeight: '800', marginTop: 4 }}>{result.vsListing.label}</Text>
                <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4, lineHeight: 17 }}>{result.vsListing.detail}</Text>
              </View>
            ) : null}
            {result.comps.slice(0, 6).map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{c.address || c.district || 'Okolica'}</Text>
                  <Text style={{ color: colors.secondary, fontSize: 11 }}>
                    {[c.area ? `${c.area} m²` : null, c.rooms ? `${c.rooms} pok.` : null, c.deedAt].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{formatPpsm(c.ppsm)}</Text>
              </View>
            ))}
            {onApply ? (
              <Pressable onPress={() => onApply(result.estimated.recommendedAsk)}>
                <Text style={{ color: '#007AFF', fontWeight: '800', fontSize: 13 }}>Zastosuj cenę rekomendowaną · {formatPln(result.estimated.recommendedAsk)}</Text>
              </Pressable>
            ) : null}
            {reportEmail ? (
              <Pressable
                onPress={() => {
                  void sendMarketReport(token, {
                    lat, lng, area, rooms, floor, city, district, address, listingPrice, email: reportEmail,
                  }).then((r) => setReportMsg(r.ok ? 'Raport wysłany na e-mail.' : String(r.json?.message || 'Nie wysłano raportu.')));
                }}
              >
                <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 }}>Generuj raport dla właściciela</Text>
              </Pressable>
            ) : null}
            {reportMsg ? <Text style={{ color: colors.secondary, fontSize: 12 }}>{reportMsg}</Text> : null}
            <Text style={{ color: colors.secondary, fontSize: 10, lineHeight: 14 }}>{result.coverage.disclaimer}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}
