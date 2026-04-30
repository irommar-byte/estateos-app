import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Switch, TextInput, Dimensions, Animated, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import RadarCalibrationRitualOverlay from './RadarCalibrationRitualOverlay';
import { fetchLocationCatalog, getFallbackLocationCatalog } from '../services/locationCatalog';

const { height } = Dimensions.get('window');
const MATCH_THRESHOLD_MIN = 50;
const MATCH_THRESHOLD_MAX = 100;
const MATCH_THRESHOLD_STEP = 1;

const ThemeColors = { RENT: '#0A84FF', SELL: '#34C759' } as const;
const BaseColors = { subtitle: '#8E8E93' };

export type RadarFilters = {
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
  pushNotifications: boolean;
  matchThreshold: number;
};

type Props = {
  visible: boolean;
  isDark: boolean;
  initialFilters: RadarFilters;
  /** Liczba ofert aktualnie na mapie (do animacji końcowej). */
  matchingOffersCount: number;
  onClose: () => void;
  onApply: (filters: RadarFilters) => Promise<void> | void;
};

export default function RadarCalibrationModal({
  visible,
  isDark,
  initialFilters,
  matchingOffersCount,
  onClose,
  onApply,
}: Props) {
  const [showApplyRitual, setShowApplyRitual] = useState(false);
  const pendingFiltersRef = useRef<RadarFilters | null>(null);

  const [draftFilters, setDraftFilters] = useState<RadarFilters>(initialFilters);
  const [inputMaxPrice, setInputMaxPrice] = useState(String(initialFilters.maxPrice));
  const [inputMinArea, setInputMinArea] = useState(String(initialFilters.minArea));
  const [inputMinYear, setInputMinYear] = useState(String(initialFilters.minYear));
  const [strictCities, setStrictCities] = useState<string[]>(getFallbackLocationCatalog().strictCities);
  const [strictCityDistricts, setStrictCityDistricts] = useState<Record<string, string[]>>(getFallbackLocationCatalog().strictCityDistricts);
  const sliderWidthRef = useRef(0);
  const lastSliderHapticValueRef = useRef<number | null>(null);
  const [isThresholdDragging, setIsThresholdDragging] = useState(false);
  const [transactionSegmentWidth, setTransactionSegmentWidth] = useState(0);
  const transitionAnim = useRef(new Animated.Value(initialFilters.transactionType === 'SELL' ? 1 : 0)).current;

  useEffect(() => {
    if (!visible) return;
    setDraftFilters(initialFilters);
    setInputMaxPrice(String(initialFilters.maxPrice));
    setInputMinArea(String(initialFilters.minArea));
    setInputMinYear(String(initialFilters.minYear));
  }, [visible, initialFilters]);

  useEffect(() => {
    if (!visible) {
      setShowApplyRitual(false);
      pendingFiltersRef.current = null;
    }
  }, [visible]);

  useEffect(() => {
    let mounted = true;
    const loadCatalog = async () => {
      const catalog = await fetchLocationCatalog();
      if (!mounted) return;
      setStrictCities(catalog.strictCities);
      setStrictCityDistricts(catalog.strictCityDistricts);
      if (!catalog.strictCities.includes(initialFilters.city) && catalog.strictCities.length > 0) {
        setDraftFilters((prev) => ({ ...prev, city: catalog.strictCities[0], selectedDistricts: [] }));
      }
    };
    loadCatalog();
    return () => { mounted = false; };
  }, [initialFilters.city]);

  const activeColor = ThemeColors[draftFilters.transactionType];
  const animatedActiveColor = transitionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [ThemeColors.RENT, ThemeColors.SELL],
  });
  const segmentTranslateX = transitionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, (transactionSegmentWidth - 6) / 2)],
  });
  const availableDistricts = strictCityDistricts[draftFilters.city] || [];

  useEffect(() => {
    Animated.timing(transitionAnim, {
      toValue: draftFilters.transactionType === 'SELL' ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [draftFilters.transactionType, transitionAnim]);

  const getRadarIntelligence = (val: number) => {
    if (val === 100) return { title: '🎯 Strzał w dziesiątkę', desc: 'Powiadomimy tylko przy maksymalnym dopasowaniu 100%.', color: '#34C759' };
    if (val >= 85) return { title: '💎 Idealne trafienie', desc: 'Wysokie dopasowanie z minimalnym marginesem.', color: '#0A84FF' };
    if (val >= 70) return { title: '🔥 Świeża okazja', desc: 'Szybki radar i więcej ciekawych okazji.', color: '#FF9F0A' };
    return { title: '👻 Głośne skanowanie', desc: 'Szeroki zasięg i najwięcej sygnałów.', color: '#FF3B30' };
  };
  const currentIntelligence = useMemo(() => getRadarIntelligence(draftFilters.matchThreshold), [draftFilters.matchThreshold]);

  const handleFilterSelect = (key: keyof RadarFilters, value: any) => {
    Haptics.selectionAsync();
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDistrict = (district: string) => {
    Haptics.selectionAsync();
    setDraftFilters((prev) => {
      const current = prev.selectedDistricts;
      if (current.includes(district)) return { ...prev, selectedDistricts: current.filter((d) => d !== district) };
      return { ...prev, selectedDistricts: [...current, district] };
    });
  };

  const getSliderValueFromPosition = useCallback((locationX: number) => {
    const widthPx = sliderWidthRef.current;
    if (!widthPx || widthPx <= 0) return null;
    const clampedX = Math.max(0, Math.min(locationX, widthPx));
    const ratio = clampedX / widthPx;
    const raw = MATCH_THRESHOLD_MIN + ratio * (MATCH_THRESHOLD_MAX - MATCH_THRESHOLD_MIN);
    const snapped =
      Math.round(raw / MATCH_THRESHOLD_STEP) * MATCH_THRESHOLD_STEP;
    return Math.max(MATCH_THRESHOLD_MIN, Math.min(MATCH_THRESHOLD_MAX, snapped));
  }, []);

  const handleSliderMove = useCallback((evt: any) => {
    const locationX = Number(evt?.nativeEvent?.locationX);
    if (!Number.isFinite(locationX)) return;
    const nextVal = getSliderValueFromPosition(locationX);
    if (nextVal == null) return;

    setDraftFilters((prev) => {
      if (prev.matchThreshold === nextVal) return prev;
      if (lastSliderHapticValueRef.current !== nextVal && nextVal % 2 === 0) {
        Haptics.selectionAsync();
        lastSliderHapticValueRef.current = nextVal;
      }
      return { ...prev, matchThreshold: nextVal };
    });
  }, [getSliderValueFromPosition]);

  const handleSliderRelease = useCallback(() => {
    setIsThresholdDragging(false);
    lastSliderHapticValueRef.current = null;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  const commitInputs = () => {
    const maxPrice = Math.max(0, parseInt(inputMaxPrice.replace(/\D/g, '')) || 0);
    const minArea = Math.max(0, parseInt(inputMinArea.replace(/\D/g, '')) || 0);
    const minYear = Math.max(1900, parseInt(inputMinYear.replace(/\D/g, '')) || 1900);
    setInputMaxPrice(String(maxPrice));
    setInputMinArea(String(minArea));
    setInputMinYear(String(minYear));
    setDraftFilters((prev) => ({ ...prev, maxPrice, minArea, minYear }));
  };

  const finalizeApplyFromRitual = useCallback(async () => {
    const filters = pendingFiltersRef.current;
    pendingFiltersRef.current = null;
    if (!filters) {
      setShowApplyRitual(false);
      return;
    }
    try {
      await onApply(filters);
    } finally {
      setShowApplyRitual(false);
    }
  }, [onApply]);

  const handleApply = () => {
    commitInputs();
    const finalized: RadarFilters = {
      ...draftFilters,
      maxPrice: Math.max(0, parseInt(inputMaxPrice.replace(/\D/g, '')) || 0),
      minArea: Math.max(0, parseInt(inputMinArea.replace(/\D/g, '')) || 0),
      minYear: Math.max(1900, parseInt(inputMinYear.replace(/\D/g, '')) || 1900),
    };
    pendingFiltersRef.current = finalized;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowApplyRitual(true);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>

        <View style={[styles.premiumModalContent, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
          <View style={styles.modalDragHandle} />
          <View style={styles.premiumModalHeader}>
            <Text style={[styles.premiumModalTitle, { color: isDark ? '#FFF' : '#000' }]}>Kalibracja Radaru</Text>
            <Pressable
              onPress={() => {
                const reset: RadarFilters = {
                  transactionType: 'SELL',
                  propertyType: 'ALL',
                  city: 'Warszawa',
                  selectedDistricts: [],
                  maxPrice: 5000000,
                  minArea: 0,
                  minYear: 1900,
                  requireBalcony: false,
                  requireGarden: false,
                  requireElevator: false,
                  requireParking: false,
                  requireFurnished: false,
                  pushNotifications: false,
                  matchThreshold: 100,
                };
                setDraftFilters(reset);
                setInputMaxPrice('5000000');
                setInputMinArea('0');
                setInputMinYear('1900');
              }}
              style={styles.resetBtn}
            >
              <Animated.Text style={[styles.resetBtnText, { color: animatedActiveColor }]}>Wyczyść</Animated.Text>
            </Pressable>
          </View>

          <ScrollView
            scrollEnabled={!isThresholdDragging}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
          >
            <Text style={styles.premiumSectionTitle}>PRZEZNACZENIE I TYP</Text>
            <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
              <View
                style={styles.premiumSegmentContainer}
                onLayout={(e) => setTransactionSegmentWidth(e.nativeEvent.layout.width)}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.segmentIndicator,
                    {
                      width: Math.max(0, (transactionSegmentWidth - 6) / 2),
                      transform: [{ translateX: segmentTranslateX }],
                      backgroundColor: animatedActiveColor,
                    },
                  ]}
                />
                {(['RENT', 'SELL'] as const).map((t) => {
                  const isActive = draftFilters.transactionType === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => handleFilterSelect('transactionType', t)}
                      style={({ pressed }) => [styles.premiumSegmentBtn, pressed && styles.premiumSegmentBtnPressed]}
                    >
                      <Text style={[styles.premiumSegmentText, isActive && styles.segmentTextActive]}>{t === 'RENT' ? 'Wynajem' : 'Kupno'}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA' }]} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.premiumSegmentContainer}>
                {(['ALL', 'FLAT', 'HOUSE', 'PLOT', 'COMMERCIAL'] as const).map((t) => {
                  const isActive = draftFilters.propertyType === t;
                  const labels = { ALL: 'Wszystko', FLAT: 'Mieszkanie', HOUSE: 'Dom', PLOT: 'Działka', COMMERCIAL: 'Lokal' } as const;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => handleFilterSelect('propertyType', t)}
                      style={({ pressed }) => [
                        styles.luxuryPillBtn,
                        styles.propertyTypePillBtn,
                        isActive && { borderColor: activeColor, backgroundColor: `${activeColor}2A`, shadowColor: activeColor },
                        pressed && styles.luxuryPillPressed,
                      ]}
                    >
                      <View style={[styles.luxuryPillSheen, isActive && { backgroundColor: `${activeColor}33` }]} />
                      <Text style={[styles.premiumSegmentText, isActive && styles.segmentTextActive]}>{labels[t]}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <Text style={styles.premiumSectionTitle}>METROPOLIA</Text>
            <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', paddingVertical: 16 }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                {strictCities.map((c) => {
                  const isActive = draftFilters.city === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setDraftFilters((prev) => ({ ...prev, city: c, selectedDistricts: [] }))}
                      style={({ pressed }) => [
                        styles.luxuryPillBtn,
                        styles.cityPillBtn,
                        isActive && { backgroundColor: `${activeColor}26`, borderColor: activeColor, shadowColor: activeColor },
                        pressed && styles.luxuryPillPressed,
                      ]}
                    >
                      <View style={[styles.luxuryPillSheen, isActive && { backgroundColor: `${activeColor}30` }]} />
                      <Text style={[styles.cityPillText, isActive && styles.cityPillTextActive]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <Text style={styles.premiumSectionTitle}>DZIELNICE ({draftFilters.city})</Text>
            <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', paddingVertical: 16 }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                {availableDistricts.map((dist) => {
                  const isActive = draftFilters.selectedDistricts.includes(dist);
                  return (
                    <Pressable
                      key={dist}
                      onPress={() => toggleDistrict(dist)}
                      style={({ pressed }) => [
                        styles.luxuryPillBtn,
                        styles.pillBtn,
                        isActive && { backgroundColor: `${activeColor}22`, borderColor: activeColor, shadowColor: activeColor },
                        pressed && styles.luxuryPillPressed,
                      ]}
                    >
                      <View style={[styles.luxuryPillSheen, isActive && { backgroundColor: `${activeColor}2E` }]} />
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{dist}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <Text style={styles.premiumSectionTitle}>PRECYZYJNE WYMIARY</Text>
            <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', paddingVertical: 5 }]}>
              <View style={styles.inputRow}>
                <Text style={[styles.inputLabelText, { color: isDark ? '#FFF' : '#000' }]}>Maks. Cena</Text>
                <View style={styles.inputContainer}>
                  <TextInput style={[styles.numberInput, { color: activeColor }]} keyboardType="numeric" value={inputMaxPrice.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} onChangeText={(val) => setInputMaxPrice(val.replace(/\D/g, ''))} onBlur={commitInputs} />
                  <Text style={styles.inputSuffix}>PLN</Text>
                </View>
              </View>
              <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginLeft: 16 }]} />
              <View style={styles.inputRow}>
                <Text style={[styles.inputLabelText, { color: isDark ? '#FFF' : '#000' }]}>Min. Metraż</Text>
                <View style={styles.inputContainer}>
                  <TextInput style={[styles.numberInput, { color: activeColor }]} keyboardType="numeric" value={inputMinArea} onChangeText={(val) => setInputMinArea(val.replace(/\D/g, ''))} onBlur={commitInputs} />
                  <Text style={styles.inputSuffix}>m²</Text>
                </View>
              </View>
              <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginLeft: 16 }]} />
              <View style={styles.inputRow}>
                <Text style={[styles.inputLabelText, { color: isDark ? '#FFF' : '#000' }]}>Rok Budowy (od)</Text>
                <View style={styles.inputContainer}>
                  <TextInput style={[styles.numberInput, { color: activeColor }]} keyboardType="numeric" value={inputMinYear} onChangeText={(val) => setInputMinYear(val.replace(/\D/g, ''))} onBlur={commitInputs} />
                </View>
              </View>
            </View>

            <Text style={styles.premiumSectionTitle}>WYPOSAŻENIE (RESTRYKCYJNE)</Text>
            <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
              <View style={styles.premiumSwitchRow}><Text style={[styles.premiumSwitchTitle, { color: isDark ? '#FFF' : '#000' }]}>Wymagaj balkonu</Text><Switch value={draftFilters.requireBalcony} onValueChange={(v) => handleFilterSelect('requireBalcony', v)} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: activeColor }} /></View>
              <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginLeft: 16 }]} />
              <View style={styles.premiumSwitchRow}><Text style={[styles.premiumSwitchTitle, { color: isDark ? '#FFF' : '#000' }]}>Wymagaj ogródka</Text><Switch value={draftFilters.requireGarden} onValueChange={(v) => handleFilterSelect('requireGarden', v)} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: activeColor }} /></View>
              <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginLeft: 16 }]} />
              <View style={styles.premiumSwitchRow}><Text style={[styles.premiumSwitchTitle, { color: isDark ? '#FFF' : '#000' }]}>Tylko z windą</Text><Switch value={draftFilters.requireElevator} onValueChange={(v) => handleFilterSelect('requireElevator', v)} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: activeColor }} /></View>
              <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginLeft: 16 }]} />
              <View style={styles.premiumSwitchRow}><Text style={[styles.premiumSwitchTitle, { color: isDark ? '#FFF' : '#000' }]}>Tylko umeblowane</Text><Switch value={draftFilters.requireFurnished} onValueChange={(v) => handleFilterSelect('requireFurnished', v)} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: activeColor }} /></View>
            </View>

            <Text style={styles.premiumSectionTitle}>DZIAŁANIE W TLE I PRECYZJA</Text>
            <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', borderColor: currentIntelligence.color, borderWidth: draftFilters.pushNotifications ? 1 : 0 }]}>
              <View style={styles.premiumSwitchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.premiumSwitchTitle, { color: draftFilters.pushNotifications ? currentIntelligence.color : (isDark ? '#FFF' : '#000'), fontWeight: '800' }]}>Aktywny Radar (Push)</Text>
                  <Text style={{ color: BaseColors.subtitle, fontSize: 11, marginTop: 4 }}>Nasłuchuj rynku po wyjściu z aplikacji na wybranym poziomie czułości.</Text>
                </View>
                <Switch value={draftFilters.pushNotifications} onValueChange={(v) => handleFilterSelect('pushNotifications', v)} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: currentIntelligence.color }} thumbColor="#FFFFFF" />
              </View>
              {draftFilters.pushNotifications && (
                <View style={{ padding: 16, paddingTop: 0 }}>
                  <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginBottom: 16 }]} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <View style={{ flex: 1, paddingRight: 16 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: currentIntelligence.color, marginBottom: 4 }}>{currentIntelligence.title}</Text>
                      <Text style={{ fontSize: 11, color: BaseColors.subtitle, lineHeight: 16 }}>{currentIntelligence.desc}</Text>
                    </View>
                    <Text style={{ fontSize: 32, fontWeight: '900', color: currentIntelligence.color, fontVariant: ['tabular-nums'] }}>{draftFilters.matchThreshold}%</Text>
                  </View>
                  <View
                    style={styles.customSliderContainer}
                    onLayout={(e) => {
                      sliderWidthRef.current = e.nativeEvent.layout.width;
                    }}
                    onStartShouldSetResponderCapture={() => true}
                    onMoveShouldSetResponderCapture={() => true}
                    onResponderTerminationRequest={() => false}
                    onResponderGrant={(e) => {
                      setIsThresholdDragging(true);
                      handleSliderMove(e);
                    }}
                    onResponderMove={handleSliderMove}
                    onResponderRelease={handleSliderRelease}
                    onResponderTerminate={handleSliderRelease}
                  >
                    {Array.from({ length: 25 }).map((_, i) => {
                      const stepVal = 50 + (i * 2);
                      const isActive = stepVal <= draftFilters.matchThreshold;
                      const isMajor = stepVal % 10 === 0;
                      return <View key={i} style={{ width: isMajor ? 3 : 2, height: isMajor ? 28 : 14, backgroundColor: isActive ? currentIntelligence.color : (isDark ? '#444' : '#E5E5EA'), borderRadius: 2 }} />;
                    })}
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ fontSize: 10, color: BaseColors.subtitle, fontWeight: '700' }}>50%</Text>
                    <Text style={{ fontSize: 10, color: BaseColors.subtitle, fontWeight: '700' }}>Skala Dopasowania AI</Text>
                    <Text style={{ fontSize: 10, color: BaseColors.subtitle, fontWeight: '700' }}>100%</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.systemDisclaimerBox}>
              <Ionicons name="shield-checkmark" size={24} color={BaseColors.subtitle} style={{ marginBottom: 8 }} />
              <Text style={styles.systemDisclaimerText}>Radar to integralny rdzeń ekosystemu EstateOS. Obecnie wspieramy wybrane metropolie, a nasz zasięg stale rośnie.</Text>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>

          <BlurView intensity={isDark ? 80 : 100} tint={isDark ? 'dark' : 'light'} style={styles.premiumModalFooter}>
            <Pressable
              disabled={showApplyRitual}
              style={({ pressed }) => [
                styles.premiumApplyBtn,
                { backgroundColor: activeColor },
                pressed && !showApplyRitual && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                showApplyRitual && { opacity: 0.55 },
              ]}
              onPress={handleApply}
            >
              <Text style={styles.premiumApplyBtnText}>Zastosuj i Skanuj</Text>
            </Pressable>
          </BlurView>
        </View>

        {showApplyRitual && (
          <RadarCalibrationRitualOverlay
            visible={showApplyRitual}
            cityLabel={draftFilters.city}
            transactionType={draftFilters.transactionType}
            matchingOffersCount={matchingOffersCount}
            onComplete={finalizeApplyFromRitual}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  premiumModalContent: { height: height * 0.88, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  modalDragHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,150,0.4)', alignSelf: 'center', marginTop: 10, marginBottom: 5 },
  premiumModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  premiumModalTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  resetBtn: { padding: 4 },
  resetBtnText: { fontSize: 16, fontWeight: '600' },
  premiumSectionTitle: { fontSize: 13, color: '#8E8E93', marginLeft: 16, marginBottom: 8, marginTop: 24, fontWeight: '600', letterSpacing: 0.5 },
  premiumFilterGroup: { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  premiumSegmentContainer: { flexDirection: 'row', padding: 3, marginHorizontal: 12, marginVertical: 8, backgroundColor: 'rgba(150,150,150,0.12)', borderRadius: 10, position: 'relative' },
  segmentIndicator: { position: 'absolute', left: 3, top: 3, bottom: 3, borderRadius: 8 },
  premiumSegmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, zIndex: 2 },
  premiumSegmentBtnPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  premiumSegmentText: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  segmentTextActive: { color: '#FFF', fontWeight: '700' },
  premiumDivider: { height: StyleSheet.hairlineWidth },
  premiumSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  premiumSwitchTitle: { fontSize: 16, fontWeight: '500' },
  luxuryPillBtn: {
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.35)',
    backgroundColor: 'rgba(150,150,150,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 4,
    overflow: 'hidden',
  },
  luxuryPillPressed: { transform: [{ scale: 0.985 }], opacity: 0.94 },
  luxuryPillSheen: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: 1,
    height: '46%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  propertyTypePillBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  cityPillBtn: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 25 },
  cityPillText: { fontSize: 16, color: '#8E8E93', fontWeight: '800', letterSpacing: 0.5 },
  cityPillTextActive: { color: '#FFF', fontWeight: '900' },
  pillBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  pillText: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  pillTextActive: { color: '#FFF', fontWeight: '700' },
  premiumModalFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 34, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(150,150,150,0.2)' },
  premiumApplyBtn: { borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  premiumApplyBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  inputLabelText: { fontSize: 16, fontWeight: '500' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  numberInput: { fontSize: 17, fontWeight: '800', minWidth: 60, textAlign: 'right' },
  inputSuffix: { fontSize: 16, fontWeight: '600', color: '#8E8E93', marginLeft: 8 },
  customSliderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, width: '100%', paddingVertical: 10, backgroundColor: 'transparent' },
  systemDisclaimerBox: { marginTop: 30, marginHorizontal: 20, alignItems: 'center', padding: 20, backgroundColor: 'rgba(150,150,150,0.05)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(150,150,150,0.1)' },
  systemDisclaimerText: { fontSize: 12, color: '#8E8E93', textAlign: 'center', lineHeight: 18, fontWeight: '500' },
});
