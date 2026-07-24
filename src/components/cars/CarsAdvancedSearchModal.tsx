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
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdvancedFilterSegment from '../AdvancedFilterSegment';
import { CAR_EXTERIOR_COLORS } from '../../constants/carColors';
import { BODY_TYPE_OPTIONS } from '../../services/carCatalogApi';
import type { CarListing } from '../../services/carsApi';
import {
  countCarsAdvancedMatches,
  countCarsForFacet,
  type CarsAdvancedFilters,
  type CarsMapBounds,
  type CarsSortKey,
} from '../../utils/carsAdvancedFilters';
import { VEHICLE_TYPE_OPTIONS } from '../../utils/vehicleTypes';

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
  onPickMapArea?: () => void;
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
  onPickMapArea,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboardInset, setKeyboardInset] = useState(0);

  const sheetMaxHeight = useMemo(
    () => Math.round(height - insets.top - Math.max(insets.bottom, 10) - 6),
    [height, insets.top, insets.bottom],
  );

  const matchCount = useMemo(() => countCarsAdvancedMatches(cars, draft), [cars, draft]);

  const sheetPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 90 || g.vy > 1.1) onClose();
        },
      }),
    [onClose],
  );

  const cityOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const car of cars) {
      const city = String(car.city || '').trim();
      if (!city) continue;
      counts.set(city, (counts.get(city) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'pl'))
      .map(([city, count]) => ({ city, count }));
  }, [cars]);

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
            {...sheetPan.panHandlers}
          >
            <View style={styles.dragHandle} />
            <Text style={[styles.swipeHint, { color: isDark ? 'rgba(255,255,255,0.45)' : '#8E8E93' }]}>
              Przesuń w dół, aby zamknąć
            </Text>
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="options-outline" size={22} color={CAR_ACCENT} />
                <Text style={[styles.title, { color: isDark ? '#FFF' : '#1C1C1E' }]}>Filtry i wyszukiwanie</Text>
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
              <Text style={[styles.sectionLead, { color: isDark ? '#FFF' : '#1C1C1E' }]}>Czego szukasz?</Text>
              <Text style={styles.hint}>
                Wpisz frazę z tytułu lub opisu ogłoszenia — np. „SUV rodzinny”, „diesel”, „Warszawa”.
                Łączymy to z filtrami poniżej (marka, nadwozie, lokalizacja).
              </Text>
              <TextInput
                value={draft.query}
                onChangeText={(query) => onChangeDraft({ ...draft, query })}
                placeholder="np. kombi, hybryd, firmowy…"
                placeholderTextColor="#8E8E93"
                style={[styles.input, { color: isDark ? '#FFF' : '#1C1C1E' }]}
              />

              <Text style={styles.section}>Typ pojazdu</Text>
              <View style={styles.row}>
                <Chip
                  label={`Wszystkie (${countCarsForFacet(cars, draft, { vehicleType: '' })})`}
                  active={!draft.vehicleType}
                  isDark={isDark}
                  onPress={() => onChangeDraft({ ...draft, vehicleType: '' })}
                />
                {VEHICLE_TYPE_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={`${opt.labelPl} (${countCarsForFacet(cars, draft, { vehicleType: opt.value })})`}
                    active={draft.vehicleType === opt.value}
                    isDark={isDark}
                    onPress={() =>
                      onChangeDraft({
                        ...draft,
                        vehicleType: draft.vehicleType === opt.value ? '' : opt.value,
                      })
                    }
                  />
                ))}
              </View>

              <Text style={styles.section}>Marka</Text>
              {makeOptions.length === 0 ? (
                <Text style={styles.hint}>Brak marek w aktualnym katalogu.</Text>
              ) : (
                <View style={styles.row}>
                  {makeOptions.map((opt) => (
                    <Chip
                      key={opt.value}
                      label={`${opt.label} (${countCarsForFacet(cars, draft, {
                        make: opt.label,
                        makeSlug: opt.label,
                        model: '',
                        modelSlug: '',
                        generation: '',
                        generationSlug: '',
                      })})`}
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
                    label={`${body} (${countCarsForFacet(cars, draft, { bodyType: body })})`}
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
              <Text style={styles.hint}>
                Wybierz miejscowość z katalogu aut albo zaznacz obszar na mapie — wtedy pokażemy tylko
                ogłoszenia z pinezką w tym kole.
              </Text>
              <View style={styles.row}>
                <Chip
                  label={`Cała baza (${countCarsForFacet(cars, draft, { city: '', mapBounds: null })})`}
                  active={!draft.city && !draft.mapBounds}
                  isDark={isDark}
                  onPress={() => onChangeDraft({ ...draft, city: '', mapBounds: null })}
                />
                {cityOptions.map(({ city, count }) => (
                  <Chip
                    key={city}
                    label={`${city} (${count})`}
                    active={draft.city === city && !draft.mapBounds}
                    isDark={isDark}
                    onPress={() =>
                      onChangeDraft({
                        ...draft,
                        city: draft.city === city ? '' : city,
                        mapBounds: null,
                      })
                    }
                  />
                ))}
              </View>
              {onPickMapArea ? (
                <Pressable
                  onPress={onPickMapArea}
                  style={[
                    styles.mapCard,
                    {
                      borderColor: draft.mapBounds ? CAR_ACCENT : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                      backgroundColor: draft.mapBounds
                        ? isDark
                          ? 'rgba(14,165,233,0.14)'
                          : 'rgba(14,165,233,0.1)'
                        : isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.03)',
                    },
                  ]}
                >
                  <Ionicons name="map" size={22} color={CAR_ACCENT} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.mapCardTitle, { color: isDark ? '#FFF' : '#1C1C1E' }]}>
                      Zaznacz obszar na mapie
                    </Text>
                    <Text style={styles.hint}>
                      {draft.mapBounds
                        ? `Obszar: ${draft.mapBounds.radiusKm.toFixed(1)} km`
                        : 'Otwórz mapę, ustaw środek i promień — jak przy nieruchomościach.'}
                    </Text>
                  </View>
                  {draft.mapBounds ? (
                    <Pressable
                      onPress={() => onChangeDraft({ ...draft, mapBounds: null })}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={22} color="#8E8E93" />
                    </Pressable>
                  ) : null}
                </Pressable>
              ) : null}

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
    marginBottom: 4,
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 8,
  },
  mapCard: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mapCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
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
