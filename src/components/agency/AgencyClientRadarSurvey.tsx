import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { METRO_STRICT_CITIES, STRICT_CITY_DISTRICTS } from '../../constants/locationEcosystem';
import { formatPriceInput, parseGroupedNumber } from '../../utils/crmFormatters';

export type ClientRadarFilters = {
  calibrationMode: 'CITY' | 'MAP';
  transactionType: 'RENT' | 'SELL';
  propertyType: string;
  city: string;
  selectedDistricts: string[];
  maxPrice: number;
  minArea: number;
  minYear: number;
  requireBalcony: boolean;
  requireGarden: boolean;
  requireElevator: boolean;
  requireParking: boolean;
  requireFurnished: boolean;
  requireTwoLevel: boolean;
  pushNotifications: boolean;
  matchThreshold: number;
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
};

const PROPERTY_TYPES = [
  { id: 'FLAT', label: 'Mieszkanie' },
  { id: 'HOUSE', label: 'Dom' },
  { id: 'PLOT', label: 'Działka' },
  { id: 'COMMERCIAL', label: 'Lokal' },
] as const;

const AMENITIES: Array<{ key: keyof ClientRadarFilters; label: string }> = [
  { key: 'requireBalcony', label: 'Balkon' },
  { key: 'requireGarden', label: 'Ogródek' },
  { key: 'requireTwoLevel', label: 'Dwupoziomowe' },
  { key: 'requireElevator', label: 'Winda' },
  { key: 'requireParking', label: 'Parking' },
  { key: 'requireFurnished', label: 'Umeblowane' },
];

const PRICE_PRESETS_SELL = [400000, 600000, 800000, 1000000, 1500000, 2000000, 3000000];
const PRICE_PRESETS_RENT = [2500, 3500, 4500, 6000, 8000, 12000];
const AREA_PRESETS = [30, 40, 50, 60, 70, 80, 100, 120];
const YEAR_PRESETS = [1970, 1990, 2000, 2010, 2015, 2020];
const THRESHOLDS = [50, 60, 70, 80, 90];

export function defaultClientRadarFilters(city = 'Warszawa'): ClientRadarFilters {
  return {
    calibrationMode: 'CITY',
    transactionType: 'SELL',
    propertyType: 'FLAT',
    city,
    selectedDistricts: [],
    maxPrice: 800000,
    minArea: 40,
    minYear: 1900,
    requireBalcony: false,
    requireGarden: false,
    requireElevator: false,
    requireParking: false,
    requireFurnished: false,
    requireTwoLevel: false,
    pushNotifications: false,
    matchThreshold: 70,
    lat: null,
    lng: null,
    radiusKm: null,
  };
}

export function clientRadarFiltersFromUnknown(raw: unknown, fallbackCity = 'Warszawa'): ClientRadarFilters {
  const base = defaultClientRadarFilters(fallbackCity);
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  const districts = Array.isArray(row.selectedDistricts)
    ? row.selectedDistricts.map((item) => String(item))
    : [];
  return {
    ...base,
    calibrationMode: row.calibrationMode === 'MAP' ? 'MAP' : 'CITY',
    transactionType: row.transactionType === 'RENT' ? 'RENT' : 'SELL',
    propertyType: String(row.propertyType || base.propertyType),
    city: String(row.city || fallbackCity),
    selectedDistricts: districts,
    maxPrice: Number(row.maxPrice) || base.maxPrice,
    minArea: Number(row.minArea) || 0,
    minYear: Number(row.minYear) || 1900,
    requireBalcony: Boolean(row.requireBalcony),
    requireGarden: Boolean(row.requireGarden),
    requireElevator: Boolean(row.requireElevator),
    requireParking: Boolean(row.requireParking),
    requireFurnished: Boolean(row.requireFurnished),
    requireTwoLevel: Boolean(row.requireTwoLevel),
    matchThreshold: Number(row.matchThreshold) || 70,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    radiusKm: row.radiusKm != null ? Number(row.radiusKm) : null,
  };
}

export function clientRadarSurveyReady(filters: ClientRadarFilters): boolean {
  const districts = STRICT_CITY_DISTRICTS[filters.city] || [];
  if (districts.length > 0 && filters.selectedDistricts.length === 0) return false;
  if (!filters.maxPrice || filters.maxPrice <= 0) return false;
  return true;
}

export function clientRadarSurveyHint(filters: ClientRadarFilters): string {
  const districts = STRICT_CITY_DISTRICTS[filters.city] || [];
  if (districts.length > 0 && filters.selectedDistricts.length === 0) {
    return `Wybierz dzielnice w ${filters.city} — dopiero wtedy radar dopasuje oferty.`;
  }
  if (!filters.maxPrice) return 'Ustaw maksymalny budżet, żeby dopasować oferty.';
  return '';
}

function thresholdLabel(value: number) {
  if (value >= 90) return { title: 'Snajperski', color: '#AF52DE' };
  if (value >= 75) return { title: 'Wyselekcjonowany', color: '#34C759' };
  if (value >= 60) return { title: 'Zbalansowany', color: '#0A84FF' };
  return { title: 'Szeroki zasięg', color: '#FF9500' };
}

export default function AgencyClientRadarSurvey({
  value,
  onChange,
  isDark,
  title,
  subtitle,
}: {
  value: ClientRadarFilters;
  onChange: (next: ClientRadarFilters) => void;
  isDark?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const colors = {
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    input: isDark ? '#2C2C2E' : '#F2F2F7',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    accent: '#34C759',
  };
  const districts = STRICT_CITY_DISTRICTS[value.city] || [];
  const pricePresets = value.transactionType === 'RENT' ? PRICE_PRESETS_RENT : PRICE_PRESETS_SELL;
  const intel = thresholdLabel(value.matchThreshold);
  const hint = clientRadarSurveyHint(value);

  const patch = (partial: Partial<ClientRadarFilters>) => {
    onChange({ ...value, ...partial, pushNotifications: false });
  };

  const chip = (active: boolean, label: string, onPress: () => void, key?: string) => (
    <Pressable
      key={key || label}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.accent : colors.input,
          borderColor: active ? colors.accent : colors.border,
        },
      ]}
    >
      <Text style={{ color: active ? '#000' : colors.text, fontWeight: active ? '800' : '600', fontSize: 12 }}>
        {active ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(52,199,89,0.08)' : 'rgba(52,199,89,0.06)' }]}>
      <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.7 }}>
        {title || 'ANKIETA RADARU'}
      </Text>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 4 }}>
        Czego klient szuka?
      </Text>
      <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
        {subtitle ||
          'Te same parametry co w radarze EstateOS. Po zapisaniu system dopasuje oferty i pokaże, które warto wysłać.'}
      </Text>

      <View style={[styles.intel, { borderColor: `${intel.color}55`, backgroundColor: `${intel.color}14` }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: intel.color, fontWeight: '900', fontSize: 13 }}>{intel.title}</Text>
          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>Próg dopasowania ofert</Text>
        </View>
        <Text style={{ color: intel.color, fontWeight: '900', fontSize: 22 }}>{value.matchThreshold}%</Text>
      </View>
      <View style={styles.rowWrap}>
        {THRESHOLDS.map((item) =>
          chip(value.matchThreshold === item, `${item}%`, () => patch({ matchThreshold: item }), `th-${item}`),
        )}
      </View>

      <Text style={[styles.label, { color: colors.secondary }]}>KUPNO CZY WYNAJEM</Text>
      <View style={styles.segment}>
        {(['SELL', 'RENT'] as const).map((tx) => {
          const active = value.transactionType === tx;
          return (
            <Pressable
              key={tx}
              onPress={() =>
                patch({
                  transactionType: tx,
                  maxPrice: tx === 'RENT' ? 4500 : 800000,
                })
              }
              style={[
                styles.segmentBtn,
                { backgroundColor: active ? (tx === 'RENT' ? '#0A84FF' : colors.accent) : colors.input },
              ]}
            >
              <Text style={{ color: active ? '#000' : colors.text, fontWeight: '800', fontSize: 12 }}>
                {tx === 'SELL' ? 'Kupno' : 'Wynajem'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.secondary }]}>TYP NIERUCHOMOŚCI</Text>
      <View style={styles.rowWrap}>
        {PROPERTY_TYPES.map((item) =>
          chip(value.propertyType === item.id, item.label, () => patch({ propertyType: item.id }), item.id),
        )}
      </View>

      <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.label, { color: colors.secondary, marginTop: 0 }]}>MIASTO I DZIELNICE</Text>
      <View style={styles.rowWrap}>
        {METRO_STRICT_CITIES.map((city) =>
          chip(value.city === city, city, () => patch({ city, selectedDistricts: [] }), city),
        )}
      </View>

      {districts.length ? (
        <>
          <Text style={[styles.label, { color: colors.secondary }]}>DZIELNICE · {value.city}</Text>
          <View style={styles.rowWrap}>
            {districts.map((district) => {
              const active = value.selectedDistricts.includes(district);
              return chip(
                active,
                district,
                () =>
                  patch({
                    selectedDistricts: active
                      ? value.selectedDistricts.filter((item) => item !== district)
                      : [...value.selectedDistricts, district],
                  }),
                district,
              );
            })}
          </View>
        </>
      ) : null}
      </View>

      <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.label, { color: colors.secondary, marginTop: 0 }]}>BUDŻET, METRAŻ, ROK</Text>
      <View style={styles.rowWrap}>
        {pricePresets.map((price) =>
          chip(
            value.maxPrice === price,
            value.transactionType === 'RENT' ? `${price.toLocaleString('pl-PL')} zł` : `${Math.round(price / 1000)} tys.`,
            () => patch({ maxPrice: price }),
            `p-${price}`,
          ),
        )}
      </View>
      <TextInput
        value={value.maxPrice ? formatPriceInput(String(value.maxPrice)) : ''}
        onChangeText={(text) => patch({ maxPrice: parseGroupedNumber(formatPriceInput(text)) })}
        keyboardType="numeric"
        placeholder="Własna kwota"
        placeholderTextColor={colors.secondary}
        style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
      />

      <Text style={[styles.label, { color: colors.secondary }]}>MIN. METRAŻ</Text>
      <View style={styles.rowWrap}>
        {AREA_PRESETS.map((area) =>
          chip(value.minArea === area, `${area} m²`, () => patch({ minArea: area }), `a-${area}`),
        )}
      </View>

      <Text style={[styles.label, { color: colors.secondary }]}>ROK BUDOWY OD</Text>
      <View style={styles.rowWrap}>
        {chip(value.minYear <= 1900, 'Bez limitu', () => patch({ minYear: 1900 }), 'y-any')}
        {YEAR_PRESETS.map((year) =>
          chip(value.minYear === year, String(year), () => patch({ minYear: year }), `y-${year}`),
        )}
      </View>
      </View>

      <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.label, { color: colors.secondary, marginTop: 0 }]}>OBOWIĄZKOWE 100%</Text>
      <Text style={{ color: colors.secondary, fontSize: 11, lineHeight: 16, marginBottom: 8 }}>
        Zaznacz tylko to, bez czego klient nie kupi. Balkon na 100% odcina mieszkania bez balkonu.
      </Text>
      <View style={styles.rowWrap}>
        {AMENITIES.map((item) =>
          chip(Boolean(value[item.key]), item.label, () => patch({ [item.key]: !value[item.key] }), item.key),
        )}
      </View>
      </View>

      {hint ? (
        <Text style={{ color: '#FF9500', fontSize: 12, fontWeight: '700', marginTop: 10 }}>{hint}</Text>
      ) : (
        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 10 }}>
          Ankieta kompletna — radar dopasuje oferty po zapisie.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },
  section: {
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  intel: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginTop: 8,
  },
});
