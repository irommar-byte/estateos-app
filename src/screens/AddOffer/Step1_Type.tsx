import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, KeyboardAvoidingView, Animated, Easing, LayoutAnimation, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AddOfferStepper from '../../components/AddOfferStepper';
import AddOfferStepFooterHint from '../../components/AddOfferStepFooterHint';
import { useI18n } from '../../i18n';
import { isPolandLocationDraft } from '../../constants/locationEcosystem';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Colors = { primary: '#10b981' };

const STEP1_PROPERTY_TYPES = ['FLAT', 'HOUSE', 'PREMISES', 'PLOT'] as const;

function isStep1PropertyType(value: unknown): value is (typeof STEP1_PROPERTY_TYPES)[number] {
  return STEP1_PROPERTY_TYPES.includes(String(value || '') as (typeof STEP1_PROPERTY_TYPES)[number]);
}

/**
 * SelectionTapTip — animowana wskazówka „dotknij, aby wybrać" dla Kroku 1.
 *
 * KIEDY SIĘ POJAWIA
 * ─────────────────
 * Pojawia się natychmiast po wejściu w Krok 1 i pozostaje widoczna, dopóki user
 * nie wybierze pierwszej opcji (Sprzedaż / Wynajem). Po pierwszym wyborze
 * `dismissed` przełącza się na true i tip płynnie znika (fade + lift).
 *
 * CZEMU SŁUŻY
 * ───────────
 * W jasnym motywie kafle Sprzedaż / Wynajem na białym tle nie krzyczą wizualnie
 * „jestem klikalny". Ten tip to animowany „palec" imitujący tap — dwa rytmicznie
 * rozchodzące się pierścienie i pulsująca kropka w środku. Styl celowo zgodny
 * z `MapInteractionTip` z Kroku 2: ta sama gramatyka wizualna w całym kreatorze
 * (glassmorphic pill + accent halo).
 */
const SelectionTapTip = ({
  isDark,
  dismissed,
  t,
}: {
  isDark: boolean;
  dismissed: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}) => {
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardLift = useRef(new Animated.Value(20)).current;
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(cardLift, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [cardOpacity, cardLift]);

  useEffect(() => {
    if (dismissed) {
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(cardLift, { toValue: -12, duration: 320, useNativeDriver: true }),
      ]).start();
    }
  }, [dismissed, cardOpacity, cardLift]);

  useEffect(() => {
    const makeRing = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const dotPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotScale, { toValue: 0.78, duration: 240, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(dotScale, { toValue: 1, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.delay(820),
      ])
    );
    const a = makeRing(ringA, 0);
    const b = makeRing(ringB, 700);
    a.start();
    b.start();
    dotPulse.start();
    return () => {
      a.stop();
      b.stop();
      dotPulse.stop();
    };
  }, [ringA, ringB, dotScale]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        tipStyles.wrapper,
        { opacity: cardOpacity, transform: [{ translateY: cardLift }] },
      ]}
    >
      <BlurView
        intensity={isDark ? 50 : 70}
        tint={isDark ? 'dark' : 'light'}
        style={[
          tipStyles.card,
          {
            backgroundColor: isDark ? 'rgba(20,20,22,0.72)' : 'rgba(255,255,255,0.88)',
            borderColor: `${Colors.primary}59`,
          },
        ]}
      >
        <View style={[tipStyles.gestureBubble, { backgroundColor: `${Colors.primary}1C`, borderColor: `${Colors.primary}55` }]}>
          <Animated.View
            style={[
              tipStyles.ring,
              {
                borderColor: Colors.primary,
                opacity: ringA.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0] }),
                transform: [{ scale: ringA.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) }],
              },
            ]}
          />
          <Animated.View
            style={[
              tipStyles.ring,
              {
                borderColor: Colors.primary,
                opacity: ringB.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                transform: [{ scale: ringB.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) }],
              },
            ]}
          />
          <Animated.View
            style={[
              tipStyles.fingerDot,
              { backgroundColor: Colors.primary, transform: [{ scale: dotScale }] },
            ]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[tipStyles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {t('addOffer.step1.tapTip.title')}
          </Text>
          <Text style={[tipStyles.subtitle, { color: isDark ? 'rgba(235,235,245,0.74)' : 'rgba(60,60,67,0.7)' }]}>
            {t('addOffer.step1.tapTip.subtitle')}
          </Text>
        </View>
      </BlurView>
    </Animated.View>
  );
};

export default function Step1_Type({ theme }: { theme: any }) {
  const { t } = useI18n();
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const navigation = useNavigation<any>();
  const isDark = theme.glass === 'dark';
  
  useFocusEffect(useCallback(() => { setCurrentStep(1); }, []));

  // Refs do auto-scrolla po wyborze kafelka — pokazujemy następną sekcję bez ręcznego przesuwania.
  const scrollRef = useRef<ScrollView>(null);
  const section2YRef = useRef<number>(0);
  const section3YRef = useRef<number>(0);
  /** Scroll dopiero po onLayout sekcji, która dopiero się montuje po pierwszym wyborze. */
  const pendingScrollRef = useRef<'section2' | 'section3' | 'end' | null>(null);

  const scrollToY = useCallback((y: number) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
      }, 220);
    });
  }, []);

  const scrollToEndDeferred = useCallback(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 120);
    });
  }, []);

  const flushPendingScroll = useCallback(
    (target: 'section2' | 'section3') => {
      if (pendingScrollRef.current !== target) return;
      pendingScrollRef.current = null;
      const y = target === 'section2' ? section2YRef.current : section3YRef.current;
      if (y > 0) scrollToY(y);
    },
    [scrollToY],
  );

  const isStep2Unlocked = draft.transactionType === 'SELL' || draft.transactionType === 'RENT';
  const isStep3Unlocked = isStep2Unlocked && isStep1PropertyType(draft.propertyType);

  const handleSelect = (key: string, value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (key === 'transactionType') {
      updateDraft({
        transactionType: value,
        propertyType: '',
        condition: null,
      });
      pendingScrollRef.current = 'section2';
      return;
    }

    if (key === 'propertyType') {
      const isPlot = value === 'PLOT';
      const isHouse = value === 'HOUSE';
      updateDraft({
        propertyType: value,
        condition: null,
        isExactLocation: true,
        ...(isPlot
          ? {
              rooms: '',
              floor: '',
              yearBuilt: '',
              buildYear: '',
              heating: '',
              hasBalcony: false,
              hasElevator: false,
              hasStorage: false,
              hasParking: false,
              hasGarden: false,
              isTwoLevel: false,
              isFurnished: false,
            }
          : {}),
        ...(!isHouse && !isPlot ? { plotArea: '' } : {}),
      });
      pendingScrollRef.current = value === 'PLOT' ? 'end' : 'section3';
      return;
    }

    updateDraft({ [key]: value });
  };

  useEffect(() => {
    if (pendingScrollRef.current !== 'end') return;
    if (draft.propertyType !== 'PLOT') return;
    pendingScrollRef.current = null;
    scrollToEndDeferred();
  }, [draft.propertyType, scrollToEndDeferred]);

  useEffect(() => {
    if (pendingScrollRef.current === 'section2' && isStep2Unlocked && section2YRef.current > 0) {
      flushPendingScroll('section2');
    }
  }, [isStep2Unlocked, draft.transactionType, flushPendingScroll]);

  useEffect(() => {
    if (pendingScrollRef.current === 'section3' && isStep3Unlocked && section3YRef.current > 0) {
      flushPendingScroll('section3');
    }
  }, [isStep3Unlocked, draft.propertyType, flushPendingScroll]);

  // Sekcje ukrywamy całkowicie (opacity 0 + lekkie translateY) póki nie spełniony warunek —
  // pojawiają się z animacją „pop-in” jak udogodnienia w Step 3.
  const typeOpacity = useRef(new Animated.Value(isStep2Unlocked ? 1 : 0)).current;
  const conditionOpacity = useRef(new Animated.Value(isStep3Unlocked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(typeOpacity, {
      toValue: isStep2Unlocked ? 1 : 0,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [isStep2Unlocked]);

  useEffect(() => {
    Animated.timing(conditionOpacity, {
      toValue: isStep3Unlocked ? 1 : 0,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [isStep3Unlocked]);

  const OptionCard = ({ icon, label, selected, onPress }: any) => (
    <Pressable 
      onPress={onPress} 
      style={({ pressed }) => [
        styles.optionCard,
        {
          backgroundColor: selected
            ? Colors.primary
            : isDark
              ? 'rgba(255,255,255,0.06)'
              : '#FFFFFF',
          borderColor: selected
            ? Colors.primary
            : isDark
              ? 'rgba(255,255,255,0.14)'
              : 'rgba(15,23,42,0.18)',
          ...(selected
            ? {
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.45 : 0.32,
                shadowRadius: 14,
                elevation: 10,
                transform: [{ translateY: -2 }],
              }
            : !isDark
              ? {
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.06,
                  shadowRadius: 10,
                  elevation: 3,
                }
              : {}),
        },
        pressed && { transform: [{ scale: 0.985 }] },
      ]}
    >
      <Ionicons name={icon} size={26} color={selected ? '#ffffff' : theme.text} style={{ marginBottom: 10 }} />
      <Text style={[styles.optionText, { color: selected ? '#ffffff' : theme.text }]}>{label}</Text>
      {!selected && (
        <Text style={[styles.optionTapHint, { color: isDark ? 'rgba(235,235,245,0.58)' : 'rgba(15,23,42,0.5)' }]}>
          {t('addOffer.step1.optionTapHint')}
        </Text>
      )}
    </Pressable>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginTop: 50 }} />
        <AddOfferStepper currentStep={1} draft={draft} theme={theme} navigation={navigation} />
        
        <Text style={styles.header}>
          <Text style={{ color: Colors.primary }}>{t('addOffer.step1.headerPrefix')}</Text>
          <Text style={{ color: theme.text }}>{t('addOffer.step1.headerSuffix')}</Text>
        </Text>
        
        {/* SEKCJA 1: CEL OGŁOSZENIA (Zawsze aktywny) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{t('addOffer.step1.sections.transaction')}</Text>
          <SelectionTapTip isDark={isDark} dismissed={isStep2Unlocked} t={t} />

          <View style={styles.row}>
            <OptionCard icon="key-outline" label={t('addOffer.step1.transaction.sell')} selected={draft.transactionType === 'SELL'} onPress={() => handleSelect('transactionType', 'SELL')} />
            <OptionCard icon="home-outline" label={t('addOffer.step1.transaction.rent')} selected={draft.transactionType === 'RENT'} onPress={() => handleSelect('transactionType', 'RENT')} />
          </View>
        </View>

        {/* SEKCJA 2: TYP NIERUCHOMOŚCI — pojawia się po wyborze Sprzedaż / Wynajem */}
        {isStep2Unlocked && (
          <Animated.View
            onLayout={(e) => {
              section2YRef.current = e.nativeEvent.layout.y;
              flushPendingScroll('section2');
            }}
            style={[
              styles.section,
              {
                opacity: typeOpacity,
                transform: [{ translateY: typeOpacity.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{t('addOffer.step1.sections.propertyType')}</Text>
            <View style={styles.row}>
              <OptionCard icon="business-outline" label={t('addOffer.step1.propertyType.flat')} selected={draft.propertyType === 'FLAT'} onPress={() => handleSelect('propertyType', 'FLAT')} />
              <OptionCard icon="home" label={t('addOffer.step1.propertyType.house')} selected={draft.propertyType === 'HOUSE'} onPress={() => handleSelect('propertyType', 'HOUSE')} />
            </View>
            <View style={[styles.row, { marginTop: 12 }]}>
              <OptionCard icon="map-outline" label={t('addOffer.step1.propertyType.plot')} selected={draft.propertyType === 'PLOT'} onPress={() => handleSelect('propertyType', 'PLOT')} />
              <OptionCard icon="cafe-outline" label={t('addOffer.step1.propertyType.premises')} selected={draft.propertyType === 'PREMISES'} onPress={() => handleSelect('propertyType', 'PREMISES')} />
            </View>
          </Animated.View>
        )}

        {/* SEKCJA 3: STAN WYKOŃCZENIA — pojawia się po wyborze typu nieruchomości (z wyjątkiem Działki) */}
        {isStep3Unlocked && draft.propertyType !== 'PLOT' && (
          <Animated.View
            onLayout={(e) => {
              section3YRef.current = e.nativeEvent.layout.y;
              flushPendingScroll('section3');
            }}
            style={[
              styles.section,
              {
                opacity: conditionOpacity,
                transform: [{ translateY: conditionOpacity.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{t('addOffer.step1.sections.condition')}</Text>
            <View style={styles.row}>
              <OptionCard icon="sparkles-outline" label={t('addOffer.step1.condition.ready')} selected={draft.condition === 'READY'} onPress={() => handleSelect('condition', 'READY')} />
              <OptionCard icon="construct-outline" label={t('addOffer.step1.condition.renovation')} selected={draft.condition === 'RENOVATION'} onPress={() => handleSelect('condition', 'RENOVATION')} />
            </View>
            <View style={[styles.row, { marginTop: 12 }]}>
              <OptionCard icon="hammer-outline" label={t('addOffer.step1.condition.developer')} selected={draft.condition === 'DEVELOPER'} onPress={() => handleSelect('condition', 'DEVELOPER')} />
              <View style={{ flex: 1 }} />
            </View>
          </Animated.View>
        )}

        <AddOfferStepFooterHint
          theme={theme}
          icon="reader-outline"
          text={t('addOffer.step1.footerHint')}
        />
        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24 },
  header: { fontSize: 42, fontWeight: '900', marginBottom: 40, letterSpacing: -1.5 },
  section: { marginBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 18, textTransform: 'uppercase', letterSpacing: 1.2, marginLeft: 4 },
  row: { flexDirection: 'row', gap: 12 },
  optionCard: {
    flex: 1,
    minHeight: 108,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1.8,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  optionText: { fontSize: 16, fontWeight: '800', letterSpacing: -0.1 },
  optionTapHint: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 5,
    letterSpacing: 0.2,
  },
});

// === SelectionTapTip — style w stylu MapInteractionTip ze Step 2 ===
const tipStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gestureBubble: {
    width: 52,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.6,
  },
  fingerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
});
