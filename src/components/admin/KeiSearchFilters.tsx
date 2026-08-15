import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  KEI_FALLBACK_APARTMENT_AREA_RANGES,
  KEI_FALLBACK_DISTRICTS,
  KEI_FALLBACK_HOUSE_AREA_RANGES,
  KEI_FALLBACK_RENT_PRICE_RANGES,
  KEI_FALLBACK_SALE_PRICE_RANGES,
  keiFallbackDatePresets,
  type KeiFacetOption,
  type KeiSearchFacetsResponse,
} from '../../contracts/keiAmerContract';

export type KeiThemeColors = {
  isDark: boolean;
  bg: string;
  card: string;
  cardSecondary: string;
  text: string;
  secondary: string;
  tertiary: string;
  separator: string;
  accentBlue: string;
};

type Props = {
  colors: KeiThemeColors;
  loading: boolean;
  error: string;
  facets: KeiSearchFacetsResponse | null;
  districtId: string;
  priceRangeId: string;
  areaRangeId: string;
  datePresetId: string;
  onSelectDistrict: (id: string) => void;
  onSelectPrice: (id: string) => void;
  onSelectArea: (id: string) => void;
  onSelectDate: (id: string) => void;
  onSearch: () => void;
  searchLoading: boolean;
  propertyKind: 'apartment' | 'house';
  transactionKind: 'sale' | 'rent';
};

const ANY_ID = '';

function optionById(options: KeiFacetOption[], id: string): KeiFacetOption | undefined {
  return options.find((opt) => opt.id === id);
}

function displayValue(options: KeiFacetOption[], id: string, emptyLabel: string): string {
  if (!id) return emptyLabel;
  return optionById(options, id)?.label || emptyLabel;
}

function FilterRow({
  label,
  value,
  placeholder,
  loading,
  colors,
  last,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  loading?: boolean;
  colors: KeiThemeColors;
  last?: boolean;
  onPress: () => void;
}) {
  const filled = Boolean(value);
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
      ]}
    >
      <Text style={[styles.rowLabel, { color: colors.secondary }]}>{label}</Text>
      <View style={styles.rowValueWrap}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.accentBlue} />
        ) : (
          <Text
            style={[styles.rowValue, { color: filled ? colors.text : colors.tertiary }]}
            numberOfLines={1}
          >
            {filled ? value : placeholder}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
      </View>
    </Pressable>
  );
}

function OptionSheet({
  visible,
  title,
  subtitle,
  options,
  selectedId,
  colors,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: KeiFacetOption[];
  selectedId: string;
  colors: KeiThemeColors;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const rows = useMemo(
    () => [{ id: ANY_ID, label: 'Dowolna', count: -1 } as KeiFacetOption, ...options],
    [options],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheetRoot, { backgroundColor: colors.bg }]}>
        <View style={[styles.sheetHeader, { borderBottomColor: colors.separator }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.sheetHeaderBtn}>
            <Text style={[styles.sheetCancel, { color: colors.accentBlue }]}>Anuluj</Text>
          </Pressable>
          <View style={styles.sheetTitleWrap}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.sheetSubtitle, { color: colors.secondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={[styles.sheetHeaderBtn, { alignItems: 'flex-end' }]}
          >
            <Text style={[styles.sheetDone, { color: colors.accentBlue }]}>Gotowe</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <View style={[styles.sheetCard, { backgroundColor: colors.card }]}>
            {rows.map((opt, index) => {
              const selected = opt.id === selectedId;
              return (
                <Pressable
                  key={opt.id || 'any'}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onSelect(opt.id);
                    onClose();
                  }}
                  style={[
                    styles.optionRow,
                    index < rows.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.separator,
                    },
                  ]}
                >
                  <Text style={[styles.optionLabel, { color: colors.text }]}>{opt.label}</Text>
                  <View style={styles.optionMeta}>
                    {opt.count > 0 ? (
                      <Text style={[styles.optionCount, { color: colors.secondary }]}>{opt.count}</Text>
                    ) : null}
                    {selected ? (
                      <Ionicons name="checkmark" size={22} color={colors.accentBlue} />
                    ) : (
                      <View style={{ width: 22 }} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function KeiSearchFilters({
  colors,
  loading,
  error,
  facets,
  districtId,
  priceRangeId,
  areaRangeId,
  datePresetId,
  onSelectDistrict,
  onSelectPrice,
  onSelectArea,
  onSelectDate,
  onSearch,
  searchLoading,
  propertyKind,
  transactionKind,
}: Props) {
  const [open, setOpen] = useState<'district' | 'price' | 'area' | 'date' | null>(null);
  const districts = facets?.districts?.length ? facets.districts : KEI_FALLBACK_DISTRICTS;
  const priceRanges = facets?.priceRanges?.length
    ? facets.priceRanges
    : transactionKind === 'rent'
      ? KEI_FALLBACK_RENT_PRICE_RANGES
      : KEI_FALLBACK_SALE_PRICE_RANGES;
  const areaRanges = facets?.areaRanges?.length
    ? facets.areaRanges
    : propertyKind === 'house'
      ? KEI_FALLBACK_HOUSE_AREA_RANGES
      : KEI_FALLBACK_APARTMENT_AREA_RANGES;
  const datePresets = facets?.datePresets?.length ? facets.datePresets : keiFallbackDatePresets();

  return (
    <View>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <FilterRow
          label="Dzielnica"
          value={displayValue(districts, districtId, '')}
          placeholder="Wybierz dzielnicę"
          loading={loading}
          colors={colors}
          onPress={() => setOpen('district')}
        />
        <FilterRow
          label="Cena"
          value={displayValue(priceRanges, priceRangeId, '')}
          placeholder="Dowolna"
          loading={loading}
          colors={colors}
          onPress={() => setOpen('price')}
        />
        <FilterRow
          label="Metraż"
          value={displayValue(areaRanges, areaRangeId, '')}
          placeholder="Dowolny"
          loading={loading}
          colors={colors}
          onPress={() => setOpen('area')}
        />
        <FilterRow
          label="Data wystawienia"
          value={displayValue(datePresets, datePresetId, '')}
          placeholder="Dowolna"
          loading={loading}
          colors={colors}
          last
          onPress={() => setOpen('date')}
        />
      </View>

      {error ? (
        <Text style={[styles.error, { color: '#FF453A' }]}>{error}</Text>
      ) : facets?.sampled ? (
        <Text style={[styles.hint, { color: colors.tertiary }]}>
          Listy z amer.kei.pl · {facets.sampled} ogłoszeń w próbce
        </Text>
      ) : null}

      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSearch();
        }}
        style={[styles.searchBtn, { backgroundColor: colors.accentBlue }]}
      >
        <Text style={styles.searchBtnText}>
          {searchLoading ? 'Szukam i weryfikuję…' : 'Szukaj i sprawdź aktualność'}
        </Text>
      </Pressable>
      <Text style={[styles.hint, { color: colors.tertiary }]}>
        Wybierz dzielnicę, cenę albo metraż z listy KEI — bez wpisywania z klawiatury. Serwer sprawdzi, czy
        link na OtoDom/OLX nadal działa.
      </Text>

      <OptionSheet
        visible={open === 'district'}
        title="Dzielnica"
        subtitle="Warszawa · z ogłoszeń KEI"
        options={districts}
        selectedId={districtId}
        colors={colors}
        onClose={() => setOpen(null)}
        onSelect={onSelectDistrict}
      />
      <OptionSheet
        visible={open === 'price'}
        title="Cena"
        subtitle="Przedziały z bieżącej puli KEI"
        options={priceRanges}
        selectedId={priceRangeId}
        colors={colors}
        onClose={() => setOpen(null)}
        onSelect={onSelectPrice}
      />
      <OptionSheet
        visible={open === 'area'}
        title="Metraż"
        subtitle="Przedziały z bieżącej puli KEI"
        options={areaRanges}
        selectedId={areaRangeId}
        colors={colors}
        onClose={() => setOpen(null)}
        onSelect={onSelectArea}
      />
      <OptionSheet
        visible={open === 'date'}
        title="Data wystawienia"
        options={datePresets}
        selectedId={datePresetId}
        colors={colors}
        onClose={() => setOpen(null)}
        onSelect={onSelectDate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    minHeight: 52,
  },
  rowLabel: { fontSize: 15, fontWeight: '600', width: 118 },
  rowValueWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  rowValue: { flexShrink: 1, fontSize: 16, fontWeight: '600', textAlign: 'right' },
  searchBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  error: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  sheetRoot: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetHeaderBtn: { width: 72 },
  sheetTitleWrap: { flex: 1, alignItems: 'center' },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetSubtitle: { fontSize: 11, marginTop: 2 },
  sheetCancel: { fontSize: 17 },
  sheetDone: { fontSize: 17, fontWeight: '700' },
  sheetCard: { margin: 16, borderRadius: 16, overflow: 'hidden' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    gap: 12,
  },
  optionLabel: { flex: 1, fontSize: 17, fontWeight: '500' },
  optionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionCount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
