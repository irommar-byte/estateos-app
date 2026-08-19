import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import MarketValuationCard from '../components/market/MarketValuationCard';
import { fetchMarketIntelligence, fetchMarketStats, formatPpsm } from '../services/marketService';

const DISTRICTS = [
  'Mokotów', 'Wola', 'Śródmieście', 'Żoliborz', 'Ursynów', 'Białołęka', 'Praga-Południe', 'Bielany',
];
const PINS: Record<string, { lat: number; lng: number }> = {
  Mokotów: { lat: 52.193, lng: 21.029 },
  Wola: { lat: 52.236, lng: 20.958 },
  Śródmieście: { lat: 52.231, lng: 21.012 },
  Żoliborz: { lat: 52.273, lng: 20.984 },
  Ursynów: { lat: 52.14, lng: 21.045 },
  Białołęka: { lat: 52.33, lng: 21.04 },
  'Praga-Południe': { lat: 52.247, lng: 21.09 },
  Bielany: { lat: 52.29, lng: 20.94 },
};

export default function EstateOsMarketScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const token = useAuthStore((s) => s.token);
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const colors = {
    bg: isDark ? '#000' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#fff',
    text: isDark ? '#fff' : '#000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    accent: '#34C759',
  };

  const [period, setPeriod] = useState(365);
  const [cityStat, setCityStat] = useState<any>(null);
  const [intel, setIntel] = useState<any>(null);
  const [district, setDistrict] = useState(String(route.params?.district || 'Mokotów'));
  const [area, setArea] = useState(String(route.params?.area || '62'));
  const [rooms, setRooms] = useState(String(route.params?.rooms || '3'));
  const [floor, setFloor] = useState(String(route.params?.floor || '3'));
  const pin = PINS[district] || PINS.Mokotów;
  const lat = Number(route.params?.lat) || pin.lat;
  const lng = Number(route.params?.lng) || pin.lng;

  useEffect(() => {
    void fetchMarketStats(period).then((j) => setCityStat(j.cityStat || null));
    void fetchMarketIntelligence(period).then((j) => (j?.ok ? setIntel(j) : null));
  }, [period]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={{ marginLeft: 8 }}>
          <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 10, letterSpacing: 1.4 }}>ESTATEOS™ MARKET</Text>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Ceny transakcyjne</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {[90, 180, 365, 730].map((d) => (
            <Pressable
              key={d}
              onPress={() => setPeriod(d)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: period === d ? colors.accent : colors.card,
              }}
            >
              <Text style={{ color: period === d ? '#000' : colors.text, fontWeight: '800', fontSize: 11 }}>
                {d === 90 ? '3 mies.' : d === 180 ? '6 mies.' : d === 365 ? '12 mies.' : '24 mies.'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <Stat colors={colors} label="Mediana" value={cityStat?.medianPpsm ? formatPpsm(cityStat.medianPpsm) : '—'} />
          <Stat colors={colors} label="Transakcje" value={cityStat?.txnCount != null ? String(cityStat.txnCount) : '—'} />
          <Stat
            colors={colors}
            label="Zmiana"
            value={cityStat?.yoyChangePct != null ? `${cityStat.yoyChangePct > 0 ? '+' : ''}${Number(cityStat.yoyChangePct).toFixed(1)}%` : '—'}
          />
        </View>
        {intel?.headline ? (
          <Text style={{ color: colors.text, fontWeight: '800', marginBottom: 12 }}>
            Warszawa · {intel.headline}
            {intel.yoyChangePct != null ? ` · ${intel.yoyChangePct}%` : ''}
          </Text>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {DISTRICTS.map((d) => (
            <Pressable
              key={d}
              onPress={() => setDistrict(d)}
              style={{
                marginRight: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: district === d ? 'rgba(52,199,89,0.18)' : colors.card,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>{d}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <Field colors={colors} label="m²" value={area} onChange={setArea} />
          <Field colors={colors} label="Pokoje" value={rooms} onChange={setRooms} />
          <Field colors={colors} label="Piętro" value={floor} onChange={setFloor} />
        </View>
        <MarketValuationCard
          token={token}
          lat={lat}
          lng={lng}
          area={Number(area) || null}
          rooms={Number(rooms) || null}
          floor={Number(floor) || null}
          city="Warszawa"
          district={district}
          listingPrice={Number(route.params?.price) || null}
          purpose="hub"
          colors={colors}
        />
      </ScrollView>
    </View>
  );
}

function Stat({ colors, label, value }: { colors: any; label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 12 }}>
      <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '800' }}>{label.toUpperCase()}</Text>
      <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15, marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function Field({ colors, label, value, onChange }: { colors: any; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '800', marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        style={{ backgroundColor: colors.card, color: colors.text, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, fontWeight: '700' }}
      />
    </View>
  );
}
