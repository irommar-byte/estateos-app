import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Modal, View, Text, StyleSheet, Pressable, ScrollView, Switch, 
  Dimensions, PanResponder, Platform, UIManager, KeyboardAvoidingView, Keyboard,
  useColorScheme
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useAnimatedStyle, useSharedValue, withSpring, runOnJS, Layout, FadeIn, FadeOut, withDelay, withTiming, withSequence
} from 'react-native-reanimated';

// Zależności z Twojego projektu:
import RadarCalibrationRitualOverlay from './RadarCalibrationRitualOverlay';
import { STRICT_CITIES, STRICT_CITY_DISTRICTS } from '../constants/locationEcosystem';
import type { RadarRecentSavedArea } from '../utils/radarRecentAreas';

const { width, height } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// === TWOJE ORYGINALNE STAŁE I LIMITY ===
const CITY_DISTRICTS: Record<string, string[]> = STRICT_CITY_DISTRICTS;
const CITIES = [...STRICT_CITIES];
const ThemeColors = { RENT: '#0A84FF', SELL: '#34C759' } as const;
const LiveRadarGold = '#D4AF37';

const SELL_MIN_PRICE_LIMIT = 50000;
const SELL_MAX_PRICE_LIMIT = 5000000;
const RENT_MIN_PRICE_LIMIT = 500;
const RENT_MAX_PRICE_LIMIT = 50000;
const MIN_AREA_LIMIT = 10;
const MAX_AREA_LIMIT = 250;
const MIN_YEAR_LIMIT = 1950;
const MAX_YEAR_LIMIT = new Date().getFullYear();

// === LUKSUSOWA PALETA DYNAMICZNA ===
const getColors = (isDark: boolean) => ({
  glassBg: isDark ? 'rgba(28, 28, 30, 0.75)' : 'rgba(255, 255, 255, 0.85)',
  glassCard: isDark ? 'rgba(44, 44, 46, 0.6)' : 'rgba(255, 255, 255, 0.7)',
  glassCardSolid: isDark ? '#1C1C1E' : '#FFFFFF',
  border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  borderHighlight: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)',
  textMain: isDark ? '#FFFFFF' : '#000000',
  textSec: isDark ? '#EBEBF5' : '#3C3C43',
  textMuted: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
  trackBg: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
});

// === TYPY (Bez zmian) ===
export type RadarFilters = {
  calibrationMode: 'MAP' | 'CITY';
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
  /** Ulubione: powiadom o zmianie ceny obserwowanej oferty. */
  favoritesNotifyPriceChange: boolean;
  /** Ulubione: powiadom, gdy pojawi się nowa propozycja / negocjacja dotycząca ulubionej. */
  favoritesNotifyDealProposals: boolean;
  /** Ulubione: czy w powiadomieniu push pokazywać konkretną kwotę (jeśli dotyczy). */
  favoritesNotifyIncludeAmounts: boolean;
  /** Ulubione: powiadom o zmianie statusu (wycofana, sprzedana, zarchiwizowana). */
  favoritesNotifyStatusChange: boolean;
  /** Ulubione: powiadom o nowych ofertach podobnych do ulubionych (rekomendacje). */
  favoritesNotifyNewSimilar: boolean;
};

type Props = {
  visible: boolean;
  calibrationSessionId: number;
  isDark?: boolean; // Nadpisane przez useColorScheme dla bezpieczeństwa
  variant?: 'radar' | 'favorites';
  initialFilters: RadarFilters;
  matchingOffersCount: number;
  areaSummary?: string;
  getAreaSummaryPreview?: (filters: RadarFilters) => string | undefined;
  getMatchingOffersCountPreview?: (filters: RadarFilters) => number;
  onClose: () => void;
  onApply: (filters: RadarFilters) => Promise<void> | void;
  onOpenAreaPicker: (currentFilters: RadarFilters) => void;
  /** Ostatnie zapisane obszary radaru (max. 3) — tylko `variant="radar"`. */
  recentRadarAreas?: RadarRecentSavedArea[];
  onPickRecentRadarArea?: (area: RadarRecentSavedArea) => void;
};

// ==========================================
// NOWY, LUKSUSOWY SUWAK Z PŁYWAJĄCĄ ETYKIETĄ I NAPRAWIONYM PAN-RESPONDEREM
// ==========================================
const PremiumScrubber = ({
  min,
  max,
  step,
  value,
  activeColor,
  colors,
  formatValue,
  onChange,
  hapticStep = 1,
  onScrubStateChange,
  bootPulse = 0,
  bootDirection = 1,
}: any) => {
  const LABEL_WIDTH = 112;
  const THUMB_SIZE = 24;
  const trackWidth = useRef(0);
  const startProgress = useRef(0);
  const lastHapticValue = useRef(value);
  
  // Reanimated do gładkiego przesuwania
  const progress = useSharedValue(Math.max(0, Math.min(1, (value - min) / Math.max(1, max - min))));
  const trackWidthSv = useSharedValue(0);
  const nudgeX = useSharedValue(0);
  
  // Synchronizacja przy zmianach z zewnątrz (np. Wyczyść)
  useEffect(() => {
    progress.value = Math.max(0, Math.min(1, (value - min) / Math.max(1, max - min)));
  }, [value, min, max]);

  useEffect(() => {
    if (!bootPulse) return;
    nudgeX.value = withSequence(
      withSpring(bootDirection * 12, { damping: 12, stiffness: 220 }),
      withSpring(0, { damping: 14, stiffness: 180 })
    );
  }, [bootPulse, bootDirection, nudgeX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 2,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => { 
        startProgress.current = progress.value;
        onScrubStateChange?.(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
      },
      onPanResponderMove: (_, g) => {
        if (trackWidth.current === 0) return;
        // Bezpieczne przeliczanie względem punktu startu (zapobiega uciekaniu!)
        const travelWidth = Math.max(1, trackWidth.current - THUMB_SIZE);
        const newProgress = Math.max(0, Math.min(1, startProgress.current + (g.dx / travelWidth)));
        progress.value = newProgress;
        
        const rawVal = min + newProgress * (max - min);
        const steppedVal = Math.round(rawVal / step) * step;
        const clampedVal = Math.max(min, Math.min(max, steppedVal));
        
        if (Math.abs(clampedVal - lastHapticValue.current) >= step * hapticStep) {
          lastHapticValue.current = clampedVal;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        }
        runOnJS(onChange)(clampedVal);
      },
      onPanResponderRelease: () => {
        onScrubStateChange?.(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      },
      onPanResponderTerminate: () => {
        onScrubStateChange?.(false);
      },
    })
  ).current;

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(THUMB_SIZE / 2, Math.min(trackWidthSv.value, (THUMB_SIZE / 2) + Math.max(1, trackWidthSv.value - THUMB_SIZE) * progress.value)),
  }));
  const thumbStyle = useAnimatedStyle(() => {
    const travelWidth = Math.max(1, trackWidthSv.value - THUMB_SIZE);
    const left = Math.max(0, Math.min(travelWidth, travelWidth * progress.value + nudgeX.value));
    return { transform: [{ translateX: left }] };
  });
  const labelStyle = useAnimatedStyle(() => {
    const travelWidth = Math.max(1, trackWidthSv.value - THUMB_SIZE);
    const thumbCenter = (THUMB_SIZE / 2) + travelWidth * progress.value;
    const maxLeft = Math.max(0, trackWidthSv.value - LABEL_WIDTH);
    const left = Math.max(0, Math.min(maxLeft, thumbCenter - LABEL_WIDTH / 2 + nudgeX.value));
    return { transform: [{ translateX: left }] };
  });
  
  return (
    <View style={styles.scrubberWrapper}>
      <Animated.View style={[styles.floatingLabelContainer, labelStyle]}>
        <View style={[styles.floatingLabel, { backgroundColor: activeColor }]}>
          <Text style={styles.floatingLabelText}>{formatValue(value)}</Text>
        </View>
        <View style={[styles.floatingLabelTriangle, { borderTopColor: activeColor }]} />
      </Animated.View>

      <View 
        style={styles.scrubberTouchArea} 
        {...panResponder.panHandlers}
        onLayout={(e) => {
          const w = Math.max(1, e.nativeEvent.layout.width);
          trackWidth.current = w;
          trackWidthSv.value = w;
        }}
      >
        <View style={[styles.scrubberRail, { backgroundColor: colors.trackBg }]}>
          <Animated.View style={[styles.scrubberFill, { backgroundColor: activeColor }, fillStyle]} />
          <View pointerEvents="none" style={styles.scrubberRuler}>
            {Array.from({ length: 11 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.scrubberRulerTick,
                  {
                    height: i % 5 === 0 ? 8 : 5,
                    opacity: i % 5 === 0 ? 0.62 : 0.34,
                    backgroundColor: colors.textMain,
                  },
                ]}
              />
            ))}
          </View>
        </View>
        <Animated.View style={[styles.scrubberThumb, { borderColor: activeColor, backgroundColor: colors.textMain }, thumbStyle]} />
      </View>
    </View>
  );
};

// ==========================================
// GŁÓWNY KOMPONENT
// ==========================================
export default function RadarCalibrationModal({
  visible, calibrationSessionId, variant = 'radar', initialFilters, matchingOffersCount,
  areaSummary, getAreaSummaryPreview, getMatchingOffersCountPreview,
  onClose, onApply, onOpenAreaPicker, recentRadarAreas, onPickRecentRadarArea,
}: Props) {
  
  const systemTheme = useColorScheme();
  const isDark = systemTheme === 'dark';
  const COLORS = useMemo(() => getColors(isDark), [isDark]);
  
  const [showApplyRitual, setShowApplyRitual] = useState(false);
  const pendingFiltersRef = useRef<RadarFilters | null>(null);
  const [ritualMatchingOffersCount, setRitualMatchingOffersCount] = useState(matchingOffersCount);

  const [draftFilters, setDraftFilters] = useState<RadarFilters>(initialFilters);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [modeTrackWidth, setModeTrackWidth] = useState(0);
  const [isGestureLocked, setIsGestureLocked] = useState(false);
  const [scrubberBootPulse, setScrubberBootPulse] = useState(0);
  const isFavoritesVariant = variant === 'favorites';
  const accentMetal = isFavoritesVariant ? '#E7A7C8' : LiveRadarGold;
  const radarLabel = isFavoritesVariant ? 'EstateOS™ Favor' : 'EstateOS™ Live Radar';
  const modalTitle = isFavoritesVariant ? 'Kalibracja Ulubionych' : 'Kalibracja Radaru';
  
  const modePillProgress = useSharedValue(initialFilters.calibrationMode === 'MAP' ? 0 : 1);
  const thresholdReveal = useSharedValue(initialFilters.pushNotifications ? 1 : 0);
  const sectionWake = useSharedValue(initialFilters.pushNotifications ? 1 : 0.26);

  const activeColor = ThemeColors[draftFilters.transactionType];
  const radarAwake = draftFilters.pushNotifications;

  useEffect(() => {
    if (!visible) return;
    setDraftFilters(initialFilters);
    modePillProgress.value = withSpring(initialFilters.calibrationMode === 'MAP' ? 0 : 1, { damping: 15, stiffness: 120 });
  }, [visible, initialFilters, calibrationSessionId]);

  useEffect(() => {
    if (!visible) {
      setShowApplyRitual(false);
      pendingFiltersRef.current = null;
      setKeyboardHeight(0);
      setIsGestureLocked(false);
    }
  }, [visible]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates?.height ?? 0));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const priceRange = useMemo(() => draftFilters.transactionType === 'RENT' 
    ? { min: RENT_MIN_PRICE_LIMIT, max: RENT_MAX_PRICE_LIMIT, step: 50 }
    : { min: SELL_MIN_PRICE_LIMIT, max: SELL_MAX_PRICE_LIMIT, step: 10000 },
  [draftFilters.transactionType]);

  useEffect(() => {
    setDraftFilters((prev) => {
      const nextMaxPrice = Math.max(priceRange.min, Math.min(priceRange.max, prev.maxPrice));
      return nextMaxPrice === prev.maxPrice ? prev : { ...prev, maxPrice: nextMaxPrice };
    });
  }, [priceRange.min, priceRange.max]);

  const availableDistricts = CITY_DISTRICTS[draftFilters.city] || [];

  useEffect(() => {
    if (radarAwake) {
      thresholdReveal.value = 0;
      sectionWake.value = 0.3;
      thresholdReveal.value = withDelay(70, withSpring(1, { damping: 12, stiffness: 170 }));
      sectionWake.value = withDelay(180, withSpring(1, { damping: 12, stiffness: 150 }));
      setScrubberBootPulse((p) => p + 1);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      thresholdReveal.value = withTiming(0, { duration: 160 });
      sectionWake.value = withTiming(0.26, { duration: 160 });
    }
  }, [radarAwake, sectionWake, thresholdReveal]);

  // TWOJA ORYGINALNA LOGIKA RADARU
  const getRadarIntelligence = (val: number) => {
    if (val === 100) return { title: '🎯 Strzał w dziesiątkę', desc: 'Tylko oferty idealne: obszar lub dzielnica, cena, metraż, rok i wymagane cechy muszą pasować.', color: '#34C759' };
    if (val >= 90) return { title: '💎 Idealne trafienie', desc: 'Bardzo blisko ideału: minimalna tolerancja ceny, granicy obszaru i parametrów technicznych.', color: '#0A84FF' };
    if (val >= 75) return { title: '🔥 Świetna okazja', desc: 'Radar łapie oferty z wysokim wynikiem dopasowania, nawet jeśli jedna cecha jest słabsza.', color: '#FF9F0A' };
    return { title: '👻 Szerokie skanowanie', desc: 'Więcej kandydatów: poza obszarem, trochę ponad budżetem lub z brakującą cechą, ale nadal punktowane według oczekiwań.', color: '#FF3B30' };
  };
  const currentIntelligence = useMemo(() => getRadarIntelligence(draftFilters.matchThreshold), [draftFilters.matchThreshold]);
  const displayedAreaSummary = useMemo(() => (getAreaSummaryPreview ? getAreaSummaryPreview(draftFilters) : areaSummary), [getAreaSummaryPreview, draftFilters, areaSummary]);

  const handleFilterSelect = useCallback((key: keyof RadarFilters, value: any) => {
    Haptics.selectionAsync();
    setDraftFilters((prev) => {
      if (key === 'transactionType') {
        const nextRange = value === 'RENT'
          ? { min: RENT_MIN_PRICE_LIMIT, max: RENT_MAX_PRICE_LIMIT }
          : { min: SELL_MIN_PRICE_LIMIT, max: SELL_MAX_PRICE_LIMIT };
        return {
          ...prev,
          transactionType: value,
          maxPrice: Math.max(nextRange.min, Math.min(nextRange.max, prev.maxPrice)),
        };
      }
      return { ...prev, [key]: value };
    });
    if (key === 'calibrationMode') {
      modePillProgress.value = withSpring(value === 'MAP' ? 0 : 1, { damping: 14, stiffness: 150 });
    }
  }, []);

  const toggleDistrict = (district: string) => {
    Haptics.selectionAsync();
    setDraftFilters((prev) => {
      const current = prev.selectedDistricts;
      if (current.includes(district)) return { ...prev, selectedDistricts: current.filter((d) => d !== district) };
      return { ...prev, selectedDistricts: [...current, district] };
    });
  };

  const finalizeApplyFromRitual = useCallback(async () => {
    const filters = pendingFiltersRef.current;
    pendingFiltersRef.current = null;
    if (!filters) { setShowApplyRitual(false); return; }
    try { await onApply(filters); } finally { setShowApplyRitual(false); }
  }, [onApply]);

  const handleApply = () => {
    pendingFiltersRef.current = draftFilters;
    setRitualMatchingOffersCount(getMatchingOffersCountPreview ? getMatchingOffersCountPreview(draftFilters) : matchingOffersCount);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (isFavoritesVariant) {
      void onApply(draftFilters);
      return;
    }
    // Jeśli użytkownik wyłącza radar (pushNotifications=false) — pomijamy „scan ritual"
    // i od razu commit'ujemy zmianę. Inaczej button nie miałby sensu: animacja skanu
    // przy wyłączaniu jest myląca, a bez wywołania onApply radar nie wyłączyłby się
    // (modal zamykany od tła nie commit'uje stanu).
    if (!draftFilters.pushNotifications) {
      void onApply(draftFilters);
      return;
    }
    setShowApplyRitual(true);
  };

  // NAPRAWIONY PAN RESPONDER DLA RADARU (Skala 50-100%)
  const thresholdTrackWidth = useRef(0);
  const thresholdStartProgress = useRef(0);
  const thresholdProgress = useSharedValue((draftFilters.matchThreshold - 50) / 50);

  useEffect(() => { thresholdProgress.value = (draftFilters.matchThreshold - 50) / 50; }, [draftFilters.matchThreshold]);

  const thresholdPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 2,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => { 
        thresholdStartProgress.current = thresholdProgress.value;
        setIsGestureLocked(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
      },
      onPanResponderMove: (_, g) => {
        if (thresholdTrackWidth.current === 0) return;
        const newProgress = Math.max(0, Math.min(1, thresholdStartProgress.current + (g.dx / thresholdTrackWidth.current)));
        thresholdProgress.value = newProgress;
        
        let val = 50 + Math.round(newProgress * 50);
        val = Math.max(50, Math.min(100, val));
        
        runOnJS(setDraftFilters)(p => {
          if (p.matchThreshold !== val && val % 5 === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          return { ...p, matchThreshold: val };
        });
      },
      onPanResponderRelease: () => {
        setIsGestureLocked(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      },
      onPanResponderTerminate: () => {
        setIsGestureLocked(false);
      },
    })
  ).current;

  // Animacja tabletki trybu
  const modePillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: modePillProgress.value * (modeTrackWidth / 2) }],
    width: Math.max(2, modeTrackWidth / 2),
    backgroundColor: activeColor
  }));
  const thresholdRevealStyle = useAnimatedStyle(() => ({
    opacity: thresholdReveal.value,
    transform: [
      { translateY: (1 - thresholdReveal.value) * -10 },
      { scale: 0.94 + thresholdReveal.value * 0.06 },
    ],
  }));
  const sleepingSectionStyle = useAnimatedStyle(() => ({
    opacity: sectionWake.value,
    transform: [{ scale: 0.97 + sectionWake.value * 0.03 }],
  }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
          <BlurView intensity={isDark ? 60 : 90} tint={isDark ? 'dark' : 'light'} style={[styles.modalContent, { backgroundColor: COLORS.glassBg }]}>
            <View style={styles.dragHandle} />
            
            {/* NAGŁÓWEK */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>{modalTitle}</Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (!isFavoritesVariant) {
                    handleFilterSelect('calibrationMode', 'MAP');
                  }
                  setDraftFilters((p) =>
                    isFavoritesVariant
                      ? {
                          ...p,
                          pushNotifications: false,
                          favoritesNotifyPriceChange: true,
                          favoritesNotifyDealProposals: true,
                          favoritesNotifyIncludeAmounts: false,
                          favoritesNotifyStatusChange: true,
                          favoritesNotifyNewSimilar: true,
                        }
                      : {
                          ...p,
                          matchThreshold: 100,
                          maxPrice: priceRange.max,
                          minArea: 0,
                          minYear: 1900,
                          selectedDistricts: [],
                          pushNotifications: false,
                        }
                  );
                }}
                style={styles.resetBtn}
              >
                <Text style={[styles.resetBtnText, { color: activeColor }]}>Wyczyść</Text>
              </Pressable>
            </View>

            {!isFavoritesVariant && (recentRadarAreas?.length ?? 0) > 0 && onPickRecentRadarArea ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <Text style={[styles.sectionTitle, { color: COLORS.textMuted, marginBottom: 10 }]}>OSTATNIE ZAPISANE OBSZARY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
                  {(recentRadarAreas ?? []).map((item) => (
                    <Pressable
                      key={`${item.savedAtIso}-${item.title}`}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onPickRecentRadarArea(item);
                      }}
                      style={({ pressed }) => [
                        styles.recentAreaChip,
                        {
                          backgroundColor: COLORS.glassCardSolid,
                          borderColor: pressed ? activeColor : COLORS.border,
                          opacity: pressed ? 0.92 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="time-outline" size={16} color={activeColor} style={{ marginBottom: 6 }} />
                      <Text style={[styles.recentAreaTitle, { color: COLORS.textMain }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={[styles.recentAreaSubtitle, { color: COLORS.textSec }]} numberOfLines={3}>
                        {item.subtitle}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <ScrollView
              showsVerticalScrollIndicator={false}
              scrollEnabled={!isGestureLocked}
              contentContainerStyle={{
                padding: 16,
                paddingBottom: radarAwake ? Math.max(150, keyboardHeight + 24) : Math.max(32, keyboardHeight + 24),
              }}
            >
              
              {/* === SEKCJA: AKTYWNY RADAR / ULUBIONE === */}
              <Text style={[styles.sectionTitle, { marginTop: 0 }]}>
                {isFavoritesVariant ? 'ULUBIONE — POWIADOMIENIA' : 'AKTYWNY RADAR I OBSZAR'}
              </Text>
              <View style={[styles.glassCard, { backgroundColor: COLORS.glassCardSolid, borderColor: draftFilters.pushNotifications ? accentMetal : COLORS.border }]}>
                {isFavoritesVariant && (
                  <View pointerEvents="none" style={styles.favoritesSparkleLayer}>
                    {Array.from({ length: 36 }).map((_, i) => (
                      <Ionicons
                        key={`spark-${i}`}
                        name={i % 4 === 0 ? 'heart' : i % 7 === 0 ? 'heart-outline' : 'sparkles-outline'}
                        size={i % 4 === 0 ? 10 : i % 7 === 0 ? 10 : 8}
                        color={
                          i % 5 === 0
                            ? 'rgba(255,135,195,0.55)'
                            : i % 2 === 0
                              ? 'rgba(231,167,200,0.62)'
                              : 'rgba(255,255,255,0.28)'
                        }
                        style={[
                          styles.favoritesSparkle,
                          {
                            left: 6 + ((i * 31) % 302),
                            top: 6 + ((i * 19) % 92),
                            transform: [{ rotate: `${(i * 19) % 360}deg` }],
                            opacity: 0.5 + ((i % 4) * 0.12),
                          },
                        ]}
                      />
                    ))}
                  </View>
                )}
                
                {/* Hero Switch */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.switchTitle, { color: draftFilters.pushNotifications ? accentMetal : COLORS.textMain, fontWeight: '800' }]}>
                      {radarLabel}
                    </Text>
                    <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 4 }}>
                      {isFavoritesVariant
                        ? 'Nasłuchuj ulubionych ofert i nowych sygnałów dopasowanych do Twojego serca.'
                        : 'Nasłuchuj rynku po wyjściu z aplikacji na wybranym poziomie czułości.'}
                    </Text>
                  </View>
                  <Switch
                    value={draftFilters.pushNotifications}
                    onValueChange={(v) => {
                      void Haptics.impactAsync(v ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
                      setDraftFilters((prev) => ({ ...prev, pushNotifications: v }));
                    }}
                    trackColor={{ false: COLORS.trackBg, true: accentMetal }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Poniżej: dopiero po włączeniu nasłuchu. */}
                {radarAwake && !isFavoritesVariant && (
                  <Animated.View
                    entering={FadeIn.duration(220)}
                    layout={Layout.springify().damping(18).stiffness(220)}
                    pointerEvents="auto"
                    style={sleepingSectionStyle}
                  >
                    <Animated.View entering={FadeIn.duration(180)} style={thresholdRevealStyle}>
                      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                        <View style={[styles.divider, { backgroundColor: COLORS.border, marginBottom: 16 }]} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <View style={{ flex: 1, paddingRight: 16 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: currentIntelligence.color, marginBottom: 4 }}>{currentIntelligence.title}</Text>
                            <Text style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 16 }}>{currentIntelligence.desc}</Text>
                          </View>
                          <Text style={{ fontSize: 32, fontWeight: '900', color: currentIntelligence.color, fontVariant: ['tabular-nums'] }}>{draftFilters.matchThreshold}%</Text>
                        </View>

                        <View
                          style={styles.customSliderContainer}
                          {...thresholdPan.panHandlers}
                          onLayout={(e) => {
                            thresholdTrackWidth.current = Math.max(80, e.nativeEvent.layout.width);
                          }}
                        >
                          {Array.from({ length: 25 }).map((_, i) => {
                            const stepVal = 50 + i * 2;
                            const isActive = stepVal <= draftFilters.matchThreshold;
                            const isMajor = stepVal % 10 === 0;
                            return (
                              <View
                                key={i}
                                pointerEvents="none"
                                style={{
                                  width: isMajor ? 3 : 2,
                                  height: isMajor ? 28 : 14,
                                  backgroundColor: isActive ? currentIntelligence.color : COLORS.trackBg,
                                  borderRadius: 2,
                                }}
                              />
                            );
                          })}
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                          <Text style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: '700' }}>50%</Text>
                          <Text style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: '700' }}>Skala dopasowania (mapa + cena)</Text>
                          <Text style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: '700' }}>100%</Text>
                        </View>
                      </View>
                    </Animated.View>

                    <View style={[styles.divider, { backgroundColor: COLORS.border }]} />

                    <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 12 }}>
                      <View
                        style={[styles.segmentContainer, { backgroundColor: COLORS.trackBg }]}
                        onLayout={(e) => setModeTrackWidth(Math.max(2, e.nativeEvent.layout.width - 6))}
                      >
                        <Animated.View style={[styles.modePillActive, modePillStyle]} />
                        {(
                          [
                            { key: 'MAP', label: 'Obszar mapy', icon: 'scan-circle-outline' },
                            { key: 'CITY', label: 'Miasto + dzielnice', icon: 'business-outline' },
                          ] as const
                        ).map((mode) => {
                          const isActive = draftFilters.calibrationMode === mode.key;
                          return (
                            <Pressable key={mode.key} onPress={() => handleFilterSelect('calibrationMode', mode.key)} style={styles.segmentBtn}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name={mode.icon} size={14} color={isActive ? '#FFF' : COLORS.textSec} />
                                <Text
                                  style={[
                                    styles.segmentTxt,
                                    isActive && { color: '#FFF', fontWeight: '700' },
                                    !isActive && { color: COLORS.textSec },
                                  ]}
                                >
                                  {mode.label}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: COLORS.border }]} />

                    <View style={{ minHeight: 80 }}>
                      {draftFilters.calibrationMode === 'MAP' ? (
                        <Animated.View layout={Layout.springify().damping(16)}>
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              onOpenAreaPicker(draftFilters);
                            }}
                            style={({ pressed }) => [
                              styles.areaPickerBtn,
                              { backgroundColor: COLORS.trackBg, borderColor: COLORS.border },
                              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                            ]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                              <View style={[styles.areaIconBg, { backgroundColor: `${activeColor}22` }]}>
                                <Ionicons name="scan-circle-outline" size={20} color={activeColor} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.areaTitle, { color: COLORS.textMain }]}>Zaznacz obszar na mapie</Text>
                                <Text style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 15 }}>
                                  Przesuń mapę, ustaw promień i automatycznie uzupełnij miasto + dzielnice.
                                </Text>
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                          </Pressable>
                          {!!displayedAreaSummary && (
                            <Text style={{ fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 16, paddingBottom: 16, marginTop: -4 }}>
                              Obecnie: {displayedAreaSummary}
                            </Text>
                          )}
                        </Animated.View>
                      ) : (
                        <Animated.View layout={Layout.springify().damping(16)} style={{ paddingBottom: 16 }}>
                          <Text style={[styles.sectionTitle, { marginTop: 12, marginBottom: 8 }]}>METROPOLIA</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                            {CITIES.map((c) => {
                              const isActive = draftFilters.city === c;
                              return (
                                <Pressable
                                  key={c}
                                  onPress={() => {
                                    Haptics.selectionAsync();
                                    setDraftFilters((prev) => ({
                                      ...prev,
                                      city: c,
                                      selectedDistricts: [...(CITY_DISTRICTS[c] || [])],
                                    }));
                                  }}
                                  style={[
                                    styles.pillBtn,
                                    { borderColor: COLORS.border },
                                    isActive && { backgroundColor: activeColor, borderColor: activeColor },
                                  ]}
                                >
                                  <Text style={[styles.pillTxt, { color: COLORS.textSec }, isActive && { color: '#FFF', fontWeight: '800' }]}>{c}</Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>

                          <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>DZIELNICE ({draftFilters.city})</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                            {availableDistricts.map((dist) => {
                              const isActive = draftFilters.selectedDistricts.includes(dist);
                              return (
                                <Pressable
                                  key={dist}
                                  onPress={() => toggleDistrict(dist)}
                                  style={[
                                    styles.pillBtn,
                                    { borderColor: COLORS.border },
                                    isActive && { backgroundColor: activeColor, borderColor: activeColor },
                                  ]}
                                >
                                  <Text style={[styles.pillTxt, { color: COLORS.textSec }, isActive && { color: '#FFF', fontWeight: '700' }]}>{dist}</Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </Animated.View>
                      )}
                    </View>
                  </Animated.View>
                )}

                {radarAwake && isFavoritesVariant && (
                  <Animated.View
                    entering={FadeIn.duration(220)}
                    layout={Layout.springify().damping(18).stiffness(220)}
                    style={[sleepingSectionStyle, { paddingBottom: 14 }]}
                  >
                    <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
                      <View style={[styles.divider, { backgroundColor: COLORS.border, marginBottom: 14 }]} />

                      <Text style={{ fontSize: 13, fontWeight: '800', color: accentMetal, marginBottom: 10 }}>
                        Powiadomienia dla Ulubionych
                      </Text>

                      {[
                        {
                          key: 'favoritesNotifyPriceChange',
                          label: 'Zmiana ceny',
                          desc: 'Gdy ulubiona oferta zmieni cenę.',
                          icon: 'cash-outline',
                        },
                        {
                          key: 'favoritesNotifyDealProposals',
                          label: 'Propozycje / negocjacje',
                          desc: 'Gdy pojawi się propozycja terminu lub ceny w Dealroom dla ulubionej.',
                          icon: 'chatbubble-ellipses-outline',
                        },
                        {
                          key: 'favoritesNotifyStatusChange',
                          label: 'Zmiana statusu',
                          desc: 'Wycofana, sprzedana lub zarchiwizowana.',
                          icon: 'shield-checkmark-outline',
                        },
                        {
                          key: 'favoritesNotifyNewSimilar',
                          label: 'Nowe podobne oferty',
                          desc: 'Nietuzinkowe rekomendacje oparte o Twoje Ulubione.',
                          icon: 'sparkles-outline',
                        },
                      ].map((item, idx) => (
                        <View key={item.key}>
                          <View style={styles.switchRow}>
                            <View style={{ flex: 1, paddingRight: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Ionicons name={item.icon as any} size={18} color={COLORS.textSec} />
                                <Text style={[styles.switchTitle, { color: COLORS.textMain }]}>{item.label}</Text>
                              </View>
                              <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 4, lineHeight: 15 }}>
                                {item.desc}
                              </Text>
                            </View>
                            <Switch
                              value={draftFilters[item.key as keyof RadarFilters] as boolean}
                              onValueChange={(v) => {
                                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                handleFilterSelect(item.key as keyof RadarFilters, v);
                              }}
                              trackColor={{ false: COLORS.trackBg, true: accentMetal }}
                              thumbColor="#FFF"
                            />
                          </View>
                          {idx < 3 && <View style={[styles.divider, { backgroundColor: COLORS.border, marginLeft: 44 }]} />}
                        </View>
                      ))}

                      <View style={[styles.divider, { backgroundColor: COLORS.border, marginTop: 12, marginBottom: 10 }]} />

                      <View style={styles.switchRow}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Ionicons name="eye-off-outline" size={18} color={COLORS.textSec} />
                            <Text style={[styles.switchTitle, { color: COLORS.textMain }]}>Prywatność kwot</Text>
                          </View>
                          <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 4, lineHeight: 15 }}>
                            Włączone: ukrywamy konkretne kwoty w treści powiadomień (bezpieczniej na ekranie blokady).
                            Wyłączone: push może zawierać pełne kwoty.
                          </Text>
                        </View>
                        <Switch
                          accessibilityLabel="Prywatność kwot w powiadomieniach"
                          value={!draftFilters.favoritesNotifyIncludeAmounts}
                          onValueChange={(privacyOn) => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleFilterSelect('favoritesNotifyIncludeAmounts', !privacyOn);
                          }}
                          trackColor={{ false: COLORS.trackBg, true: accentMetal }}
                          thumbColor="#FFF"
                        />
                      </View>
                    </View>
                  </Animated.View>
                )}
              </View>

              {radarAwake && !isFavoritesVariant && (
              <Animated.View
                entering={FadeIn.duration(240)}
                layout={Layout.springify().damping(18).stiffness(200)}
                style={sleepingSectionStyle}
              >
              {/* === TWOJA ORYGINALNA SEKCJA: PRZEZNACZENIE I TYP === */}
              <Text style={styles.sectionTitle}>PRZEZNACZENIE I TYP</Text>
              <View style={[styles.glassCard, { backgroundColor: COLORS.glassCardSolid, borderColor: COLORS.border }]}>
                <View style={[styles.segmentContainer, { backgroundColor: COLORS.trackBg, marginHorizontal: 12, marginTop: 12 }]}>
                  {(['RENT', 'SELL'] as const).map((t) => {
                    const isActive = draftFilters.transactionType === t;
                    return (
                      <Pressable key={t} onPress={() => handleFilterSelect('transactionType', t)} style={[styles.segmentBtn, isActive && { backgroundColor: ThemeColors[t] }]}>
                        <Text style={[styles.segmentTxt, isActive && { color: '#FFF', fontWeight: '800' }, !isActive && { color: COLORS.textSec }]}>{t === 'RENT' ? 'Wynajem' : 'Kupno'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={[styles.divider, { backgroundColor: COLORS.border, marginVertical: 12 }]} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.segmentContainer, { backgroundColor: 'transparent', marginHorizontal: 12, marginBottom: 12, padding: 0, gap: 8 }]}>
                  {(['FLAT', 'HOUSE', 'PLOT', 'COMMERCIAL'] as const).map((t) => {
                    const isActive = draftFilters.propertyType === t;
                    const labels = { FLAT: 'Mieszkanie', HOUSE: 'Dom', PLOT: 'Działka', COMMERCIAL: 'Lokal' } as const;
                    return (
                      <Pressable key={t} onPress={() => handleFilterSelect('propertyType', t)} style={[styles.pillBtn, { borderColor: COLORS.border }, isActive && { backgroundColor: activeColor, borderColor: activeColor }]}>
                        <Text style={[styles.pillTxt, { color: COLORS.textSec }, isActive && { color: '#FFF', fontWeight: '800' }]}>{labels[t]}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* === NOWE, GŁADKIE SUWAKI WARTOŚCI === */}
              <Text style={styles.sectionTitle}>PRECYZYJNE WYMIARY</Text>
              <View style={[styles.glassCard, { backgroundColor: COLORS.glassCardSolid, borderColor: COLORS.border, paddingVertical: 24 }]}>
                
                <Text style={[styles.sliderLabel, { color: COLORS.textSec }]}>Maksymalna Cena</Text>
                <PremiumScrubber 
                  key={`price-${draftFilters.transactionType}`}
                  min={priceRange.min} max={priceRange.max} step={priceRange.step} hapticStep={draftFilters.transactionType === 'RENT' ? 8 : 5}
                  value={Math.max(priceRange.min, Math.min(priceRange.max, draftFilters.maxPrice))} activeColor={activeColor} colors={COLORS}
                  formatValue={(v: number) => `${Math.round(v).toLocaleString('pl-PL')} PLN`}
                  onChange={(v: number) => setDraftFilters(p => ({ ...p, maxPrice: v }))}
                  onScrubStateChange={setIsGestureLocked}
                  bootPulse={scrubberBootPulse}
                  bootDirection={1}
                />

                <View style={[styles.divider, { backgroundColor: COLORS.border, marginVertical: 28 }]} />
                
                <Text style={[styles.sliderLabel, { color: COLORS.textSec }]}>Minimalny Metraż</Text>
                <PremiumScrubber 
                  min={MIN_AREA_LIMIT} max={MAX_AREA_LIMIT} step={1} hapticStep={5}
                  value={draftFilters.minArea} activeColor={activeColor} colors={COLORS}
                  formatValue={(v: number) => `${Math.round(v)} m²`}
                  onChange={(v: number) => setDraftFilters(p => ({ ...p, minArea: v }))}
                  onScrubStateChange={setIsGestureLocked}
                  bootPulse={scrubberBootPulse}
                  bootDirection={-1}
                />

                <View style={[styles.divider, { backgroundColor: COLORS.border, marginVertical: 28 }]} />

                <Text style={[styles.sliderLabel, { color: COLORS.textSec }]}>Rok budowy (od)</Text>
                <PremiumScrubber 
                  min={MIN_YEAR_LIMIT} max={MAX_YEAR_LIMIT} step={1} hapticStep={5}
                  value={draftFilters.minYear} activeColor={activeColor} colors={COLORS}
                  formatValue={(v: number) => `${Math.round(v)}`}
                  onChange={(v: number) => setDraftFilters(p => ({ ...p, minYear: v }))}
                  onScrubStateChange={setIsGestureLocked}
                  bootPulse={scrubberBootPulse}
                  bootDirection={1}
                />
              </View>

              {/* === TWOJA ORYGINALNA SEKCJA: WYPOSAŻENIE === */}
              <Text style={styles.sectionTitle}>WYPOSAŻENIE (RESTRYKCYJNE)</Text>
              <View style={[styles.glassCard, { backgroundColor: COLORS.glassCardSolid, borderColor: COLORS.border }]}>
                {[
                  { key: 'requireBalcony', label: 'Wymagaj balkonu', icon: 'stop-outline' },
                  { key: 'requireGarden', label: 'Wymagaj ogródka', icon: 'leaf-outline' },
                  { key: 'requireElevator', label: 'Tylko z windą', icon: 'arrow-up-outline' },
                  { key: 'requireFurnished', label: 'Tylko umeblowane', icon: 'bed-outline' },
                ].map((item, idx) => (
                  <View key={item.key}>
                    <View style={styles.switchRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons name={item.icon as any} size={18} color={COLORS.textSec} />
                        <Text style={[styles.switchTitle, { color: COLORS.textMain }]}>{item.label}</Text>
                      </View>
                      <Switch 
                        value={draftFilters[item.key as keyof RadarFilters] as boolean} 
                        onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleFilterSelect(item.key as keyof RadarFilters, v); }} 
                        trackColor={{ false: COLORS.trackBg, true: activeColor }} 
                        thumbColor="#FFF" 
                      />
                    </View>
                    {idx < 3 && <View style={[styles.divider, { backgroundColor: COLORS.border, marginLeft: 44 }]} />}
                  </View>
                ))}
              </View>

              {/* === TWÓJ SYSTEM DISCLAIMER === */}
              <View style={[styles.disclaimerBox, { backgroundColor: COLORS.trackBg, borderColor: COLORS.border }]}>
                <Ionicons name="shield-checkmark" size={24} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
                <Text style={[styles.disclaimerText, { color: COLORS.textMuted }]}>
                  Radar to integralny rdzeń ekosystemu EstateOS. Obecnie wspieramy wybrane metropolie, a nasz zasięg stale rośnie.
                </Text>
              </View>
              </Animated.View>
              )}
              
            </ScrollView>

            {/* Stopka zawsze widoczna (gdy klawiatura schowana) — przy wyłączonym
                nasłuchu zmieniamy etykietę na „Wyłącz radar”, żeby użytkownik
                miał świadomy sposób na commit `pushNotifications=false`.
                Bez tego przełącznik off + zamknięcie modala = zmiana ginęła
                i radar pozostawał aktywny. */}
            {keyboardHeight === 0 && (
              <View style={[styles.footer, { borderTopColor: COLORS.border }]}>
                <Pressable
                  disabled={showApplyRitual}
                  style={({ pressed }) => [
                    styles.applyBtn,
                    {
                      backgroundColor: draftFilters.pushNotifications
                        ? accentMetal
                        : isFavoritesVariant
                          ? COLORS.textMuted
                          : '#8E8E93',
                    },
                    pressed && !showApplyRitual && { transform: [{ scale: 0.97 }] },
                    showApplyRitual && { opacity: 0.6 },
                  ]}
                  onPress={handleApply}
                >
                  <Text style={styles.applyBtnTxt}>
                    {isFavoritesVariant
                      ? draftFilters.pushNotifications
                        ? 'Zapisz ustawienia'
                        : 'Wyłącz Favor'
                      : draftFilters.pushNotifications
                        ? 'Zastosuj i Skanuj'
                        : 'Wyłącz radar'}
                  </Text>
                  <Ionicons
                    name={draftFilters.pushNotifications ? 'scan-outline' : 'power-outline'}
                    size={20}
                    color="#FFF"
                    style={{ marginLeft: 8 }}
                  />
                </Pressable>
              </View>
            )}

          </BlurView>
        </KeyboardAvoidingView>

        {showApplyRitual && !isFavoritesVariant && (
          <RadarCalibrationRitualOverlay
            visible={showApplyRitual}
            cityLabel={draftFilters.city}
            transactionType={draftFilters.transactionType}
            matchingOffersCount={ritualMatchingOffersCount}
            onComplete={finalizeApplyFromRitual}
          />
        )}
      </View>
    </Modal>
  );
}

// === STYLE ===
const styles = StyleSheet.create({
  modalContent: { height: height * 0.9, borderTopLeftRadius: 36, borderTopRightRadius: 36, overflow: 'hidden', borderWidth: 1, borderBottomWidth: 0 },
  dragHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,150,0.4)', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  resetBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(150,150,150,0.1)' },
  resetBtnText: { fontSize: 14, fontWeight: '700' },

  recentAreaChip: {
    width: 200,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  recentAreaTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  recentAreaSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 4, lineHeight: 15 },

  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginLeft: 16, marginBottom: 8, marginTop: 24, color: '#8E8E93' },
  
  glassCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  switchTitle: { fontSize: 15, fontWeight: '600' },
  
  divider: { height: StyleSheet.hairlineWidth },
  
  segmentContainer: { flexDirection: 'row', padding: 3, borderRadius: 12 },
  modePillActive: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 10 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 10, zIndex: 2 },
  segmentTxt: { fontSize: 13, fontWeight: '600' },
  
  customSliderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, width: '100%', paddingVertical: 10, backgroundColor: 'transparent' },
  
  areaPickerBtn: { margin: 16, borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  areaIconBg: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  areaTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  
  pillBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(150,150,150,0.05)' },
  pillTxt: { fontSize: 13, fontWeight: '600' },
  
  // LUKSUSOWY SUWAK Z PŁYWAJĄCĄ ETYKIETĄ
  sliderLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 16, marginBottom: 28 },
  scrubberWrapper: { marginHorizontal: 16, position: 'relative' },
  floatingLabelContainer: { position: 'absolute', left: 0, top: -34, alignItems: 'center', width: 112, zIndex: 10 },
  floatingLabel: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 6 },
  floatingLabelText: { color: '#FFF', fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  floatingLabelTriangle: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },
  scrubberTouchArea: { height: 36, justifyContent: 'center' },
  scrubberRail: { height: 8, borderRadius: 4, overflow: 'hidden' },
  scrubberFill: { position: 'absolute', left: 0, height: '100%', borderRadius: 4 },
  scrubberRuler: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  scrubberRulerTick: { width: 1, borderRadius: 1 },
  scrubberThumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, borderWidth: 3, top: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  favoritesSparkleLayer: { ...StyleSheet.absoluteFillObject, zIndex: 0, pointerEvents: 'none' },
  favoritesSparkle: { position: 'absolute' },
  
  disclaimerBox: { marginTop: 32, alignItems: 'center', padding: 20, borderRadius: 20, borderWidth: 1 },
  disclaimerText: { fontSize: 12, textAlign: 'center', lineHeight: 18, fontWeight: '500' },
  
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },
  applyBtn: { flexDirection: 'row', borderRadius: 20, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12 },
  applyBtnTxt: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
});