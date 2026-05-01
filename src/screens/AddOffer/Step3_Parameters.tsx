import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Platform, KeyboardAvoidingView, Animated, UIManager } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AppleHover from '../../components/AppleHover';
import AddOfferStepper from '../../components/AddOfferStepper';
import AddOfferStepFooterHint from '../../components/AddOfferStepFooterHint';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Colors = { primary: '#10b981' };

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

  // --- LOGIKA KASKADY ---
  const isPlot = draft.propertyType === 'PLOT';

  // Krok po kroku odblokowujemy sekcje:
  const isAreaFilled = !!draft.area && parseFloat(draft.area.replace(',', '.')) > 0;
  const isRoomsUnlocked = isPlot ? false : isAreaFilled;
  const isFloorUnlocked = isPlot ? false : (isRoomsUnlocked && !!draft.rooms);
  const isYearUnlocked = isPlot ? false : (isFloorUnlocked && !!draft.floor);
  
  const isAmenitiesUnlocked = !isPlot && isYearUnlocked && !!(draft.yearBuilt || draft.buildYear);

  const roomsAnim = useRef(new Animated.Value(isRoomsUnlocked ? 1 : 0.3)).current;
  const floorAnim = useRef(new Animated.Value(isFloorUnlocked ? 1 : 0.3)).current;
  const yearAnim = useRef(new Animated.Value(isYearUnlocked ? 1 : 0.3)).current;
  const amenitiesAnim = useRef(new Animated.Value(isAmenitiesUnlocked ? 1 : 0)).current; // Zaczyna całkowicie ukryte

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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

        {!isPlot && (
          <>
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
          </>
        )}

        {!isPlot && (
          <Animated.View
            style={{ opacity: amenitiesAnim, transform: [{ translateY: amenitiesAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}
            pointerEvents={isAmenitiesUnlocked ? 'auto' : 'none'}
          >
            <Text style={[styles.sectionTitle, { color: theme.subtitle, marginTop: 40 }]}>Udogodnienia (Opcjonalne)</Text>
            <View style={styles.pillsContainer}>
              <TogglePill label="Balkon / Taras" icon="sunny-outline" field="hasBalcony" />
              <TogglePill label="Garaż / Parking" icon="car-sport-outline" field="hasParking" />
              <TogglePill label="Piwnica / Komórka" icon="cube-outline" field="hasStorage" />
              <TogglePill label="Winda" icon="arrow-up-circle-outline" field="hasElevator" />
              <TogglePill label="Ogródek" icon="leaf-outline" field="hasGarden" />
              <TogglePill label="Umeblowane" icon="bed-outline" field="isFurnished" />
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
  pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, pill: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, borderWidth: 1 }, pillText: { fontSize: 14, fontWeight: '700' },
});
