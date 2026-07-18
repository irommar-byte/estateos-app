import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdvancedFilterSegment from '../AdvancedFilterSegment';
import { CAR_EXTERIOR_COLORS } from '../../constants/carColors';
import { BODY_TYPE_OPTIONS } from '../../services/carCatalogApi';
import type { CarListing } from '../../services/carsApi';
import {
  countCarsAdvancedMatches,
  type CarsAdvancedFilters,
  type CarsSortKey,
} from '../../utils/carsAdvancedFilters';

const CAR_ACCENT = '#0EA5E9';

type Props = {
  visible: boolean;
  isDark: boolean;
  cars: CarListing[];
  draft: CarsAdvancedFilters;
  onChangeDraft: (next: CarsAdvancedFilters) => void;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
};

function Chip({
  label,
  active,
  isDark,
  onPress,
}: {
  label: string;
  active: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && {
          borderColor: CAR_ACCENT,
          backgroundColor: isDark ? 'rgba(14,165,233,0.2)' : 'rgba(14,165,233,0.14)',
        },
      ]}
    >
      <Text style={[styles.chipText, active && { color: CAR_ACCENT, fontWeight: '800' }]}>{label}</Text>
    </Pressable>
  );
}

export default function CarsAdvancedSearchModal({
  visible,
  isDark,
  cars,
  draft,
  onChangeDraft,
  onClose,
  onApply,
  onReset,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboardInset, setKeyboardInset] = useState(0);

  const sheetMaxHeight = useMemo(
    () => Math.round(height - insets.top - Math.max(insets.bottom, 10) - 6),
    [height, insets.top, insets.bottom],
  );

  const matchCount = useMemo(() => countCarsAdvancedMatches(cars, draft), [cars, draft]);

  const makeOptions = useMemo(
    () =>
      Array.from(new Set(cars.map((car) => car.make).filter(Boolean)))
        .sort()
        .map((make) => ({ value: make, label: make })),
    [cars],
  );

  const modelOptions = useMemo(() => {
    if (!draft.make.trim()) return [];
    const makeNorm = draft.make.trim().toLowerCase();
    return Array.from(
      new Set(
        cars
          .filter((car) => car.make.trim().toLowerCase() === makeNorm)
          .map((car) => car.model)
          .filter(Boolean),
      ),
    )
      .sort()
      .map((model) => ({ value: model, label: model }));
  }, [cars, draft.make]);

  const generationOptions = useMemo(() => {
    if (!draft.make.trim() || !draft.model.trim()) return [];
    const makeNorm = draft.make.trim().toLowerCase();
    const modelNorm = draft.model.trim().toLowerCase();
    return Array.from(
      new Set(
        cars
          .filter(
            (car) =>
              car.make.trim().toLowerCase() === makeNorm &&
              car.model.trim().toLowerCase() === modelNorm,
          )
          .map((car) => String(car.generation || '').trim())
          .filter(Boolean),
      ),
    )
      .sort()
      .map((generation) => ({ value: generation, label: generation }));
  }, [cars, draft.make, draft.model]);

  const fuelTypes = useMemo(
    () => Array.from(new Set(cars.map((c) => c.fuelType).filter(Boolean))).sort(),
    [cars],
  );
  const transmissions = useMemo(
    () => Array.from(new Set(cars.map((c) => c.transmission).filter(Boolean))).sort(),
    [cars],
  );

  const sortOptions = useMemo(
    () =>
      [
        { key: 'newest' as const, label: 'Najnowsze' },
        { key: 'price_asc' as const, label: 'Cena ↑' },
        { key: 'price_desc' as const, label: 'Cena ↓' },
        { key: 'mileage_asc' as const, label: 'Przebieg ↑' },
        { key: 'year_desc' as const, label: 'Rocznik ↓' },
      ] as const,
    [],
  );

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      return;
    }
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardInset(Math.round(e.endCoordinates?.height || 0));
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const selectMake = (make: string) => {
    const active = draft.make === make;
    onChangeDraft({
      ...draft,
      makeSlug: active ? '' : make,
      make: active ? '' : make,
      modelSlug: '',
      model: '',
      generationSlug: '',
      generation: '',
    });
  };

  const selectModel = (model: string) => {
    const active = draft.model === model;
    onChangeDraft({
      ...draft,
      modelSlug: active ? '' : model,
      model: active ? '' : model,
      generationSlug: '',
      generation: '',
    });
  };

  const selectGeneration = (generation: string) => {
    const active = draft.generation === generation;
    onChangeDraft({
      ...draft,
      generationSlug: active ? '' : generation,
      generation: active ? '' : generation,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{ width: '100%', flex: 1, justifyContent: 'flex-end' }}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', height: sheetMaxHeight, maxHeight: sheetMaxHeight },
              keyboardInset > 0 && { paddingBottom: keyboardInset },
            ]}
          >
            <View style={styles.dragHandle} />
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="search" size={22} color={CAR_ACCENT} />
                <Text style={[styles.title, { color: isDark ? '#FFF' : '#1C1C1E' }]}>Wyszukiwanie rozszerzone</Text>
              </View>
              <Pressable onPress={onReset}>
                <Text style={[styles.reset, { color: CAR_ACCENT }]}>Wyczyść</Text>
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
            >
              <Text style={[styles.sectionLead, { color: isDark ? '#FFF' : '#1C1C1E' }]}>Szukaj w katalogu aut</Text>
              <TextInput
                value={draft.query}
                onChangeText={(query) => onChangeDraft({ ...draft, query })}
                placeholder="Marka, model, miasto, paliwo…"
                placeholderTextColor="#8E8E93"
                style={[styles.input, { color: isDark ? '#FFF' : '#1C1C1E' }]}
              />

              <Text style={styles.section}>Marka</Text>
              {makeOptions.length === 0 ? (
                <Text style={styles.hint}>Brak marek w aktualnym katalogu.</Text>
              ) : (
                <View style={styles.row}>
                  {makeOptions.map((opt) => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      active={draft.make === opt.label}
                      isDark={isDark}
                      onPress={() => selectMake(opt.label)}
                    />
                  ))}
                </View>
              )}

              {draft.make ? (
                <>
                  <Text style={styles.section}>Model</Text>
                  <View style={styles.row}>
                    {modelOptions.map((opt) => (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        active={draft.model === opt.label}
                        isDark={isDark}
                        onPress={() => selectModel(opt.label)}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {draft.model ? (
                <>
                  <Text style={styles.section}>Generacja</Text>
                  <View style={styles.row}>
                    {generationOptions.map((opt) => (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        active={draft.generation === opt.label}
                        isDark={isDark}
                        onPress={() => selectGeneration(opt.label)}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.section}>Paliwo</Text>
              <View style={styles.row}>
                {fuelTypes.map((fuel) => (
                  <Chip
                    key={fuel}
                    label={fuel}
                    active={draft.fuelType === fuel}
                    isDark={isDark}
                    onPress={() => onChangeDraft({ ...draft, fuelType: draft.fuelType === fuel ? '' : fuel })}
                  />
                ))}
              </View>

              <Text style={styles.section}>Nadwozie</Text>
              <View style={styles.row}>
                {BODY_TYPE_OPTIONS.map((body) => (
                  <Chip
                    key={body}
                    label={body}
                    active={draft.bodyType === body}
                    isDark={isDark}
                    onPress={() => onChangeDraft({ ...draft, bodyType: draft.bodyType === body ? '' : body })}
                  />
                ))}
              </View>

              <Text style={styles.section}>Kolor</Text>
              <View style={styles.row}>
                {CAR_EXTERIOR_COLORS.map((color) => (
                  <Chip
                    key={color}
                    label={color}
                    active={draft.exteriorColor === color}
                    isDark={isDark}
                    onPress={() =>
                      onChangeDraft({ ...draft, exteriorColor: draft.exteriorColor === color ? '' : color })
                    }
                  />
                ))}
              </View>

              <Text style={styles.section}>Skrzynia biegów</Text>
              <View style={styles.row}>
                {transmissions.map((tx) => (
                  <Chip
                    key={tx}
                    label={tx}
                    active={draft.transmission === tx}
                    isDark={isDark}
                    onPress={() =>
                      onChangeDraft({ ...draft, transmission: draft.transmission === tx ? '' : tx })
                    }
                  />
                ))}
              </View>

              <Text style={styles.section}>Lokalizacja</Text>
              <TextInput
                value={draft.city}
                onChangeText={(city) => onChangeDraft({ ...draft, city })}
                placeholder="Miasto lub region"
                placeholderTextColor="#8E8E93"
                style={[styles.input, { color: isDark ? '#FFF' : '#1C1C1E' }]}
              />

              <Text style={styles.section}>Cena (PLN)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={draft.minPrice}
                  onChangeText={(minPrice) => onChangeDraft({ ...draft, minPrice })}
                  placeholder="Od"
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  style={[styles.input, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                />
                <TextInput
                  value={draft.maxPrice}
                  onChangeText={(maxPrice) => onChangeDraft({ ...draft, maxPrice })}
                  placeholder="Do"
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  style={[styles.input, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                />
              </View>

              <Text style={styles.section}>Rok produkcji</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={draft.minYear}
                  onChangeText={(minYear) => onChangeDraft({ ...draft, minYear })}
                  placeholder="Od"
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  style={[styles.input, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                />
                <TextInput
                  value={draft.maxYear}
                  onChangeText={(maxYear) => onChangeDraft({ ...draft, maxYear })}
                  placeholder="Do"
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  style={[styles.input, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                />
              </View>

              <Text style={styles.section}>Przebieg (km)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={draft.minMileage}
                  onChangeText={(minMileage) => onChangeDraft({ ...draft, minMileage })}
                  placeholder="Od"
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  style={[styles.input, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                />
                <TextInput
                  value={draft.maxMileage}
                  onChangeText={(maxMileage) => onChangeDraft({ ...draft, maxMileage })}
                  placeholder="Do"
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  style={[styles.input, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                />
              </View>

              <Text style={styles.section}>Sortowanie</Text>
              <AdvancedFilterSegment
                options={sortOptions}
                value={draft.sort}
                onChange={(sort) => onChangeDraft({ ...draft, sort: sort as CarsSortKey })}
                accentColor={CAR_ACCENT}
                isDark={isDark}
              />
            </ScrollView>

            <Pressable style={[styles.applyBtn, { backgroundColor: CAR_ACCENT }]} onPress={onApply}>
              <Text style={styles.applyText}>
                {matchCount > 0 ? `Pokaż ${matchCount} ogłoszeń` : 'Brak dopasowań'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 16,
    flexDirection: 'column',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.4)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
  },
  reset: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionLead: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 10,
    marginTop: 4,
  },
  section: {
    marginTop: 8,
    marginBottom: 6,
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(150,150,150,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.22)',
  },
  chipText: {
    color: '#8E8E93',
    fontWeight: '600',
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(150,150,150,0.1)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  applyBtn: {
    marginTop: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  applyText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
});
