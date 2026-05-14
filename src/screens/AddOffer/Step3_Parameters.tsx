import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Platform, KeyboardAvoidingView, Animated, UIManager, Pressable } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AppleHover from '../../components/AppleHover';
import AddOfferStepper from '../../components/AddOfferStepper';
import AddOfferStepFooterHint from '../../components/AddOfferStepFooterHint';
import {
  applyLandRegistryPrefix,
  getCourtByLandRegistryPrefix,
  getLandRegistryPrefixSuggestions,
  isValidLandRegistryNumber,
  normalizeLandRegistryNumber,
} from '../../utils/landRegistry';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Colors = { primary: '#10b981' };
const HEATING_OPTIONS = [
  { key: '', label: 'Nie podano' },
  { key: 'Miejskie', label: 'Miejskie' },
  { key: 'Gazowe', label: 'Gazowe' },
  { key: 'Elektryczne', label: 'Elektryczne' },
  { key: 'Pompa Ciepła', label: 'Pompa Ciepła' },
  { key: 'Węglowe/Pellet', label: 'Węglowe / Pellet' },
  { key: 'Inne', label: 'Inne' },
];

const ROOMS = ['', ...Array.from({length: 10}, (_, i) => (i + 1).toString())];
const FLOORS = ['', 'Parter', ...Array.from({length: 30}, (_, i) => (i + 1).toString())];
const YEARS = ['', ...Array.from({length: 100}, (_, i) => (new Date().getFullYear() - i).toString())];

export default function Step3_Parameters({ theme }: { theme: any }) {
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const navigation = useNavigation<any>();
  useFocusEffect(useCallback(() => { setCurrentStep(3); }, []));
  
  const isDark = theme.glass === 'dark';
  const cardBg = isDark ? '#1a1a1c' : '#ffffff';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const shadowOpacity = isDark ? 0 : 0.06;

  // Refs do auto-scrolla: po odblokowaniu kolejnej sekcji przewijamy ekran tak, by user widział co ma kliknąć.
  const scrollRef = useRef<ScrollView>(null);
  const detailsYRef = useRef<number>(0);
  const amenitiesYRef = useRef<number>(0);
  const wasDetailsUnlockedRef = useRef<boolean>(false);
  const wasAmenitiesUnlockedRef = useRef<boolean>(false);

  // --- LOGIKA KASKADY ---
  const isPlot = draft.propertyType === 'PLOT';

  // Krok po kroku odblokowujemy sekcje:
  const isAreaFilled = !!draft.area && parseFloat(draft.area.replace(',', '.')) > 0;
  const isRoomsUnlocked = isPlot ? false : isAreaFilled;
  const isFloorUnlocked = isPlot ? false : (isRoomsUnlocked && !!draft.rooms);
  const isYearUnlocked = isPlot ? false : (isFloorUnlocked && !!draft.floor);
  
  const isAmenitiesUnlocked = !isPlot && isYearUnlocked && !!(draft.yearBuilt || draft.buildYear);
  const landRegistryRaw = String(draft.landRegistryNumber || '').trim();
  const isLandRegistryValid = isValidLandRegistryNumber(landRegistryRaw);
  const landRegistrySuggestions = getLandRegistryPrefixSuggestions(landRegistryRaw);
  const selectedCourt = getCourtByLandRegistryPrefix(landRegistryRaw);

  // Sekcja „Szczegóły” jako całość — pojawia się dopiero gdy user wpisał metraż.
  const detailsAnim = useRef(new Animated.Value(isAreaFilled ? 1 : 0)).current;
  const roomsAnim = useRef(new Animated.Value(isRoomsUnlocked ? 1 : 0.3)).current;
  const floorAnim = useRef(new Animated.Value(isFloorUnlocked ? 1 : 0.3)).current;
  const yearAnim = useRef(new Animated.Value(isYearUnlocked ? 1 : 0.3)).current;
  const amenitiesAnim = useRef(new Animated.Value(isAmenitiesUnlocked ? 1 : 0)).current; // Zaczyna całkowicie ukryte

  useEffect(() => { Animated.timing(detailsAnim, { toValue: isAreaFilled ? 1 : 0, duration: 500, useNativeDriver: true }).start(); }, [isAreaFilled]);
  useEffect(() => { Animated.timing(roomsAnim, { toValue: isRoomsUnlocked ? 1 : 0.3, duration: 350, useNativeDriver: true }).start(); }, [isRoomsUnlocked]);
  useEffect(() => { Animated.timing(floorAnim, { toValue: isFloorUnlocked ? 1 : 0.3, duration: 350, useNativeDriver: true }).start(); }, [isFloorUnlocked]);
  useEffect(() => { Animated.timing(yearAnim, { toValue: isYearUnlocked ? 1 : 0.3, duration: 350, useNativeDriver: true }).start(); }, [isYearUnlocked]);
  
  // Odsłanianie udogodnień
  useEffect(() => {
    Animated.timing(amenitiesAnim, { 
      toValue: isAmenitiesUnlocked ? 1 : 0, 
      duration: 500, 
      useNativeDriver: true 
    }).start(); 
  }, [isAmenitiesUnlocked]);

  // Auto-scroll po odblokowaniu sekcji "Szczegóły" (pierwsze wpisanie metrażu).
  useEffect(() => {
    if (isAreaFilled && !wasDetailsUnlockedRef.current) {
      wasDetailsUnlockedRef.current = true;
      setTimeout(() => {
        const y = Math.max(0, detailsYRef.current - 24);
        scrollRef.current?.scrollTo({ y, animated: true });
      }, 520);
    }
    if (!isAreaFilled) wasDetailsUnlockedRef.current = false;
  }, [isAreaFilled]);

  // Auto-scroll po odblokowaniu "Udogodnienia" (komplet: metraż + pokoje + piętro + rok).
  useEffect(() => {
    if (isAmenitiesUnlocked && !wasAmenitiesUnlockedRef.current) {
      wasAmenitiesUnlockedRef.current = true;
      setTimeout(() => {
        const y = Math.max(0, amenitiesYRef.current - 24);
        scrollRef.current?.scrollTo({ y, animated: true });
      }, 520);
    }
    if (!isAmenitiesUnlocked) wasAmenitiesUnlockedRef.current = false;
  }, [isAmenitiesUnlocked]);

  const TogglePill = ({ label, icon, field }: { label: string, icon: any, field: keyof typeof draft }) => {
    const isActive = draft[field] as boolean;
    return (
      <AppleHover onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateDraft({ [field]: !isActive }); }} style={[styles.pill, { 
        backgroundColor: isActive ? Colors.primary : cardBg, 
        borderColor: isActive ? Colors.primary : cardBorder,
        shadowColor: isActive ? Colors.primary : '#000',
        shadowOpacity: isActive ? 0.3 : shadowOpacity,
        shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: isActive ? 4 : 1
      }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name={icon} size={18} color={isActive ? '#fff' : theme.text} style={{ marginRight: 6 }} />
          <Text style={[styles.pillText, { color: isActive ? '#fff' : theme.text }]}>{label}</Text>
        </View>
      </AppleHover>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        automaticallyAdjustKeyboardInsets
      >
        <View style={{ marginTop: 50 }} />
        <AddOfferStepper currentStep={3} draft={draft} theme={theme} navigation={navigation} />
        
        <Text style={[styles.header, { color: theme.text }]}>Parametry</Text>
        
        <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>Metraż</Text>
        <View style={[styles.areaBox, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: '#000', shadowOpacity, shadowRadius: 15, shadowOffset: { width: 0, height: 5 }, elevation: 2 }]}>
          <TextInput 
            style={[styles.areaInput, { color: theme.text }]} 
            placeholder="0" 
            placeholderTextColor={theme.subtitle} 
            value={draft.area} 
            onChangeText={(text) => { const formatted = text.replace(/[^0-9.,]/g, ''); updateDraft({ area: formatted }); }} 
            keyboardType="decimal-pad" 
            maxLength={6} 
          />
          <Text style={[styles.areaUnit, { color: draft.area ? theme.text : theme.subtitle }]}>m²</Text>
        </View>

        {!isPlot && isAreaFilled && (
          <Animated.View
            onLayout={(e) => { detailsYRef.current = e.nativeEvent.layout.y; }}
            style={{
              opacity: detailsAnim,
              transform: [{ translateY: detailsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            }}
          >
            <Text style={[styles.sectionTitle, { color: theme.subtitle, marginTop: 40 }]}>Szczegóły</Text>
            <View style={styles.triplePickerWrapper}>
              
              <Animated.View style={[styles.pickerColumn, { opacity: roomsAnim }]} pointerEvents={isRoomsUnlocked ? 'auto' : 'none'}>
                <Text style={[styles.pickerTitle, { color: theme.subtitle }]}>POKOJE</Text>
                <View style={[styles.pickerBox, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: '#000', shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }]}>
                  <Picker selectedValue={draft.rooms || ''} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateDraft({rooms: v}); }} mode="dialog" dropdownIconColor={theme.text} style={[styles.pickerNative, { color: theme.text }]} itemStyle={{ color: theme.text, height: 160, fontSize: 18, fontWeight: '700' }}>
                    {ROOMS.map(r => <Picker.Item key={r} label={r === '' ? '-' : r} value={r} />)}
                  </Picker>
                </View>
              </Animated.View>

              <Animated.View style={[styles.pickerColumn, { opacity: floorAnim }]} pointerEvents={isFloorUnlocked ? 'auto' : 'none'}>
                <Text style={[styles.pickerTitle, { color: theme.subtitle }]}>PIĘTRO</Text>
                <View style={[styles.pickerBox, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: '#000', shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }]}>
                  <Picker selectedValue={draft.floor || ''} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateDraft({floor: v}); }} mode="dialog" dropdownIconColor={theme.text} style={[styles.pickerNative, { color: theme.text }]} itemStyle={{ color: theme.text, height: 160, fontSize: 16, fontWeight: '700' }}>
                    {FLOORS.map(f => <Picker.Item key={f} label={f === '' ? '-' : f} value={f} />)}
                  </Picker>
                </View>
              </Animated.View>

              <Animated.View style={[styles.pickerColumn, { opacity: yearAnim }]} pointerEvents={isYearUnlocked ? 'auto' : 'none'}>
                <Text style={[styles.pickerTitle, { color: theme.subtitle }]}>ROK</Text>
                <View style={[styles.pickerBox, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: '#000', shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }]}>
                  <Picker selectedValue={draft.yearBuilt || draft.buildYear || ''} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateDraft({ buildYear: v, yearBuilt: v }); }} mode="dialog" dropdownIconColor={theme.text} style={[styles.pickerNative, { color: theme.text }]} itemStyle={{ color: theme.text, height: 160, fontSize: 16, fontWeight: '700' }}>
                    {YEARS.map(y => <Picker.Item key={y} label={y === '' ? '-' : y} value={y} />)}
                  </Picker>
                </View>
              </Animated.View>

            </View>
          </Animated.View>
        )}

        {!isPlot && (
          <Animated.View
            onLayout={(e) => { amenitiesYRef.current = e.nativeEvent.layout.y; }}
            style={{ opacity: amenitiesAnim, transform: [{ translateY: amenitiesAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}
            pointerEvents={isAmenitiesUnlocked ? 'auto' : 'none'}
          >
            <Text style={[styles.sectionTitle, { color: theme.subtitle, marginTop: 40 }]}>Udogodnienia (Opcjonalne)</Text>
            <Text style={[styles.sectionTitle, { color: theme.subtitle, marginTop: 16 }]}>Ogrzewanie</Text>
            <View style={[styles.pickerBox, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: '#000', shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2, marginBottom: 16 }]}>
              <Picker
                selectedValue={draft.heating || ''}
                onValueChange={(v) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateDraft({ heating: v });
                }}
                mode="dialog"
                dropdownIconColor={theme.text}
                style={[styles.pickerNative, { color: theme.text }]}
                itemStyle={{ color: theme.text, height: 160, fontSize: 16, fontWeight: '700' }}
              >
                {HEATING_OPTIONS.map((opt) => (
                  <Picker.Item key={opt.key || 'none'} label={opt.label} value={opt.key} />
                ))}
              </Picker>
            </View>

            <AppleHover
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateDraft({ isFurnished: !draft.isFurnished });
              }}
              style={[styles.premiumRow, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: '#000', shadowOpacity, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }]}
            >
              <View>
                <Text style={[styles.premiumRowTitle, { color: theme.text }]}>Umeblowane</Text>
                <Text style={[styles.premiumRowSubtitle, { color: theme.subtitle }]}>
                  {draft.isFurnished ? 'Tak' : 'Nie'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={[styles.booleanLabel, { color: draft.isFurnished ? Colors.primary : theme.subtitle }]}>
                  {draft.isFurnished ? 'Tak' : 'Nie'}
                </Text>
                <View pointerEvents="none">
                  <Ionicons name={draft.isFurnished ? 'checkmark-circle' : 'close-circle-outline'} size={18} color={draft.isFurnished ? Colors.primary : theme.subtitle} />
                </View>
              </View>
            </AppleHover>

            <View style={styles.pillsContainer}>
              <TogglePill label="Balkon / Taras" icon="sunny-outline" field="hasBalcony" />
              <TogglePill label="Garaż / Parking" icon="car-sport-outline" field="hasParking" />
              <TogglePill label="Piwnica / Komórka" icon="cube-outline" field="hasStorage" />
              <TogglePill label="Winda" icon="arrow-up-circle-outline" field="hasElevator" />
              <TogglePill label="Ogródek" icon="leaf-outline" field="hasGarden" />
            </View>

            <Text style={[styles.sectionTitle, { color: theme.subtitle, marginTop: 20 }]}>Weryfikacja dokumentów (opcjonalnie)</Text>
            <View style={[styles.docsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <TextInput
                style={[styles.docsInput, { color: theme.text, borderBottomColor: cardBorder }]}
                placeholder="Numer mieszkania"
                placeholderTextColor={theme.subtitle}
                value={draft.apartmentNumber || ''}
                onChangeText={(t) => updateDraft({ apartmentNumber: t })}
              />
              <TextInput
                style={[styles.docsInput, { color: theme.text }]}
                placeholder="Numer księgi wieczystej (np. WA4N/00012345/6)"
                placeholderTextColor={theme.subtitle}
                value={draft.landRegistryNumber || ''}
                onChangeText={(t) => updateDraft({ landRegistryNumber: normalizeLandRegistryNumber(t) })}
                onFocus={() => {
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 280);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {landRegistrySuggestions.length > 0 && !isLandRegistryValid ? (
                <View style={[styles.suggestionsWrap, { borderColor: cardBorder, backgroundColor: isDark ? '#111214' : '#F8FAFC' }]}>
                  {landRegistrySuggestions.map((item) => (
                    <Pressable
                      key={item.prefix}
                      style={styles.suggestionRow}
                      onPress={() =>
                        updateDraft({
                          landRegistryNumber: applyLandRegistryPrefix(String(draft.landRegistryNumber || ''), item.prefix),
                        })
                      }
                    >
                      <Text style={[styles.suggestionPrefix, { color: theme.text }]}>{item.prefix}</Text>
                      <Text style={[styles.suggestionCourt, { color: theme.subtitle }]} numberOfLines={1}>
                        {item.courtName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {selectedCourt ? (
                <Text style={[styles.docsCourtText, { color: theme.subtitle }]}>
                  Właściwy sąd: {selectedCourt.courtName}
                </Text>
              ) : null}
              {landRegistryRaw ? (
                <Text style={[styles.docsValidationText, { color: isLandRegistryValid ? '#34C759' : '#FF3B30' }]}>
                  {isLandRegistryValid
                    ? 'Format KW poprawny. Dane trafiają wyłącznie do procesu weryfikacji.'
                    : 'Nieprawidłowy format KW. Użyj wzoru: WA4N/00012345/6'}
                </Text>
              ) : null}
              <Text style={[styles.docsPrivacyText, { color: theme.subtitle }]}>
                Dane dokumentowe są prywatne i służą wyłącznie do weryfikacji stanu prawnego nieruchomości (np.
                potwierdzenie: nieruchomość sprawdzona, bez zadłużeń), co zwiększa wiarygodność oferty i szansę na
                zainteresowanie klientów. Te dane nie są publikowane i nigdy nie zostaną ujawnione bez Twojej wyraźnej
                zgody.
              </Text>
            </View>
          </Animated.View>
        )}

        <AddOfferStepFooterHint
          theme={theme}
          icon="options-outline"
          text="Metraż i dane techniczne wpływają na porównywalność z innymi ogłoszeniami oraz na szacunki finansowe w następnym kroku. Uzupełniaj pola po kolei — kolejne sekcje odblokują się, gdy poprzednie są spójne. Dla działki wystarczy powierzchnia (bez udogodnień typowych dla lokalu)."
        />
        <View style={{ height: 200 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 20 },
  header: { fontSize: 40, fontWeight: '800', marginBottom: 30, letterSpacing: -1.2 }, sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.5, marginLeft: 4 },
  areaBox: { borderRadius: 28, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: 130, paddingBottom: 25 }, 
  areaInput: { fontSize: 65, fontWeight: '800', textAlign: 'center', height: 85, minWidth: 100 }, areaUnit: { fontSize: 24, fontWeight: '700', marginBottom: 15, marginLeft: 5 },
  triplePickerWrapper: { flexDirection: 'row', gap: 12, height: Platform.OS === 'ios' ? 200 : 80 }, pickerColumn: { flex: 1, alignItems: 'stretch' }, pickerTitle: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 10, textAlign: 'center', letterSpacing: 1 }, 
  pickerBox: { flex: 1, justifyContent: 'center', borderRadius: 24, borderWidth: 1 }, 
  pickerNative: Platform.OS === 'ios' ? { width: '100%', height: 160 } : { width: '100%', height: 60, backgroundColor: 'transparent' },
  premiumRow: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  premiumRowTitle: { fontSize: 15, fontWeight: '700' },
  premiumRowSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  booleanLabel: { fontSize: 14, fontWeight: '800' },
  pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, pill: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, borderWidth: 1 }, pillText: { fontSize: 14, fontWeight: '700' },
  docsCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
    marginTop: 4,
  },
  docsInput: {
    minHeight: 46,
    fontSize: 15,
    fontWeight: '600',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  docsPrivacyText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  docsValidationText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  suggestionsWrap: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  suggestionPrefix: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  suggestionCourt: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
  },
  docsCourtText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
});
