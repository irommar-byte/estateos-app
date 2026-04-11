import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, Animated, Easing, Pressable } from 'react-native';
import MapView from 'react-native-maps';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';

const Colors = { primary: '#10b981' };

const DISTRICT_COORDS: Record<string, { lat: number, lng: number }> = {
  'Warszawa': { lat: 52.2297, lng: 21.0122 }, 'Bemowo': { lat: 52.2460, lng: 20.9100 }, 'Białołęka': { lat: 52.3240, lng: 20.9700 },
  'Bielany': { lat: 52.2850, lng: 20.9320 }, 'Mokotów': { lat: 52.1939, lng: 21.0287 }, 'Ochota': { lat: 52.2120, lng: 20.9690 },
  'Praga-Południe': { lat: 52.2390, lng: 21.0825 }, 'Praga-Północ': { lat: 52.2581, lng: 21.0334 }, 'Rembertów': { lat: 52.2580, lng: 21.1620 },
  'Śródmieście': { lat: 52.2297, lng: 21.0122 }, 'Targówek': { lat: 52.2800, lng: 21.0500 }, 'Ursus': { lat: 52.1890, lng: 20.8850 },
  'Ursynów': { lat: 52.1484, lng: 21.0456 }, 'Wawer': { lat: 52.2000, lng: 21.1660 }, 'Wesoła': { lat: 52.2610, lng: 21.2280 },
  'Wilanów': { lat: 52.1643, lng: 21.0894 }, 'Włochy': { lat: 52.1940, lng: 20.9330 }, 'Wola': { lat: 52.2361, lng: 20.9575 }, 'Żoliborz': { lat: 52.2688, lng: 20.9820 },
  'Łódź': { lat: 51.7592, lng: 19.4560 }, 'Bałuty': { lat: 51.8003, lng: 19.4244 }, 'Górna': { lat: 51.7225, lng: 19.4756 },
  'Polesie': { lat: 51.7578, lng: 19.4186 }, 'Widzew': { lat: 51.7600, lng: 19.5300 },
};

const DISTRICTS_DATA = {
  'Warszawa': ['Bemowo', 'Białołęka', 'Bielany', 'Mokotów', 'Ochota', 'Praga-Południe', 'Praga-Północ', 'Rembertów', 'Śródmieście', 'Targówek', 'Ursus', 'Ursynów', 'Wawer', 'Wesoła', 'Wilanów', 'Włochy', 'Wola', 'Żoliborz'],
  'Łódź': ['Bałuty', 'Górna', 'Polesie', 'Śródmieście', 'Widzew'],
  'Reszta Polski': ['Inna lokalizacja']
};

const InteractiveProgressBar = ({ step, total, theme, navigation }: any) => (
  <View style={styles.progressContainer}>
    <Text style={[styles.progressText, { color: theme.subtitle }]}>KROK {step} Z {total}</Text>
    <View style={{ flexDirection: 'row', gap: 6, height: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <Pressable key={i} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate(`Step${i + 1}`); }} style={{ flex: 1, borderRadius: 2, backgroundColor: i + 1 <= step ? Colors.primary : (theme.glass === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') }} />
      ))}
    </View>
  </View>
);

const RedNeedlePin = () => {
  const levitateAnim = useRef(new Animated.Value(0)).current;
  const redWaveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(levitateAnim, { toValue: -12, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(levitateAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ])).start();
    Animated.loop(Animated.timing(redWaveAnim, { toValue: 1, duration: 2500, easing: Easing.out(Easing.ease), useNativeDriver: true })).start();
  }, []);

  return (
    <View style={styles.precisePinWrapper}>
      <Animated.View style={{ transform: [{ translateY: levitateAnim }], alignItems: 'center', justifyContent: 'flex-end' }}>
        <Animated.View style={[styles.redWave, { transform: [{ scale: redWaveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 3.5] }) }], opacity: redWaveAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.4, 0] }) }]} />
        <View style={{ alignItems: 'center', zIndex: 3 }}>
          <View style={[styles.pinHead, { backgroundColor: '#ef4444' }]} />
          <View style={[styles.pinNeedle, { backgroundColor: '#9ca3af' }]} />
          <View style={styles.pinContactPoint} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.pinShadowMap, { opacity: levitateAnim.interpolate({ inputRange: [-12, 0], outputRange: [0.2, 0.7] }), transform: [{ scale: levitateAnim.interpolate({ inputRange: [-12, 0], outputRange: [0.5, 1] }) }] }]} />
    </View>
  );
};

const BreathingCircle = () => {
  const pulseValue = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseValue, { toValue: 1.12, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseValue, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ])).start();
  }, []);
  return <Animated.View style={[styles.approximateArea, styles.glowShadow, { transform: [{ scale: pulseValue }], opacity: pulseValue.interpolate({ inputRange: [1, 1.12], outputRange: [0.9, 0.5] }) }]} />;
};

const getClosestDistrict = (lat: number, lng: number, city: string) => {
  const cityDistricts = DISTRICTS_DATA[city as keyof typeof DISTRICTS_DATA];
  if (!cityDistricts || city === 'Reszta Polski') return 'Inna lokalizacja';
  let closest = cityDistricts[0]; let minDistance = Infinity;
  for (const district of cityDistricts) {
    const coords = DISTRICT_COORDS[district];
    if (coords) {
      const distance = Math.pow(lat - coords.lat, 2) + Math.pow(lng - coords.lng, 2);
      if (distance < minDistance) { minDistance = distance; closest = district; }
    }
  }
  return closest;
};

export default function Step2_Location({ theme }: { theme: any }) {
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const [streetInput, setStreetInput] = useState(draft.street);
  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation<any>();
  
  useFocusEffect(useCallback(() => { setCurrentStep(2); }, []));

  const isDark = theme.glass === 'dark';
  const cardBg = isDark ? 'rgba(30,30,34,0.65)' : '#ffffff';
  const inputBg = isDark ? 'rgba(0,0,0,0.5)' : '#ffffff';
  const shadow = isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 };
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)';

  const stopOrbit = () => { };

  const flyTo = (targetLat: number, targetLng: number, isExact: boolean) => {
    mapRef.current?.animateCamera({ 
      center: { latitude: targetLat, longitude: targetLng }, 
      pitch: isExact ? 75 : 30, 
      altitude: isExact ? 150 : 4000, 
      zoom: isExact ? 19.5 : 13.5, 
      heading: 0 
    }, { duration: 2500 }); 
  };

  const handleAddressSearch = async () => {
    if (streetInput.length < 3) return;
    if (!/\d/.test(streetInput)) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); Alert.alert("Brak numeru", "Proszę podać dokładny adres z numerem, np. 'Wolska 56'."); return; }
    try {
      const result = await Location.geocodeAsync(streetInput + ", Polska");
      if (result.length > 0) {
        const { latitude, longitude } = result[0];
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        flyTo(latitude, longitude, true);
        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverse.length > 0) {
          const place = reverse[0];
          const cityInfo = (place.city || place.subregion || place.region || "").toLowerCase();
          let finalCity = 'Reszta Polski';
          if (cityInfo.includes('warszawa') || cityInfo.includes('warsaw')) finalCity = 'Warszawa';
          else if (cityInfo.includes('łódź') || cityInfo.includes('lodz')) finalCity = 'Łódź';
          const finalDistrict = getClosestDistrict(latitude, longitude, finalCity);
          const newStreet = place.street && place.streetNumber ? `${place.street} ${place.streetNumber}` : streetInput;
          setStreetInput(newStreet);
          updateDraft({ city: finalCity, district: finalDistrict, lat: latitude, lng: longitude, isExactLocation: true, street: newStreet });
        }
      }
    } catch (e) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
  };

  const handleCityChange = (city: string) => { 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
    const newDistricts = DISTRICTS_DATA[city as keyof typeof DISTRICTS_DATA]; const coords = DISTRICT_COORDS[city] || { lat: 52.0, lng: 19.0 }; 
    updateDraft({ city, district: newDistricts[0], lat: coords.lat, lng: coords.lng }); 
    if (city !== 'Reszta Polski') flyTo(coords.lat, coords.lng, false); 
  };
  
  const handleDistrictChange = (district: string) => { 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
    updateDraft({ district }); 
    const coords = DISTRICT_COORDS[district]; 
    if (coords) flyTo(coords.lat, coords.lng, false); 
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
      
      <View style={styles.mapContainer}>
        <MapView ref={mapRef} style={styles.map} userInterfaceStyle={isDark ? "dark" : "light"} showsBuildings={true} pitchEnabled={true} initialRegion={{ latitude: draft.lat || 52.2297, longitude: draft.lng || 21.0122, latitudeDelta: 0.05, longitudeDelta: 0.05 }} onRegionChangeComplete={(region) => updateDraft({ lat: region.latitude, lng: region.longitude })} />
        <View style={styles.centerPinContainer} pointerEvents="none">{draft.isExactLocation ? <RedNeedlePin /> : <BreathingCircle />}</View>
        <View style={[styles.mapGradient, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)' }]} pointerEvents="none" />
      </View>

      <ScrollView style={styles.controlsContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <InteractiveProgressBar step={2} total={6} theme={theme} navigation={navigation} />
        
        <Text style={[styles.header, { color: theme.text }]}>Lokalizacja</Text>
        
        <View style={[styles.glassCard, { backgroundColor: cardBg, borderColor }, shadow]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.text }]}>Dokładna lokalizacja</Text>
              <Text style={[styles.subLabel, { color: theme.subtitle }]}>Obszar ok. 200m dla ochrony prywatności.</Text>
            </View>
            <Switch value={draft.isExactLocation} onValueChange={(val) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateDraft({ isExactLocation: val }); if (draft.lat && draft.lng) flyTo(draft.lat, draft.lng, val); }} trackColor={{ false: '#D1D1D6', true: '#10b981' }} />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>Wyszukaj adres</Text>
        <View style={[styles.insetSlot, { backgroundColor: inputBg, borderColor }, shadow]}>
          <TextInput style={[styles.input, { color: theme.text }]} placeholder="np. Wolska 56" placeholderTextColor={theme.subtitle} value={streetInput} onChangeText={setStreetInput} onSubmitEditing={handleAddressSearch} returnKeyType="search" selectionColor="#dc2626" />
        </View>

        <View style={styles.pickerWrapper}>
          <View style={styles.pickerColumn}>
            <Text style={[styles.pickerTitle, { color: theme.subtitle }]}>MIASTO</Text>
            <View style={[styles.pickerBox, { backgroundColor: inputBg, borderColor }, shadow]}>
              <Picker selectedValue={draft.city || 'Warszawa'} onValueChange={handleCityChange} style={styles.pickerNative} itemStyle={{ color: theme.text, height: 160, fontSize: 19, fontWeight: '700' }}>{Object.keys(DISTRICTS_DATA).map(c => <Picker.Item key={c} label={c} value={c} />)}</Picker>
            </View>
          </View>
          <View style={styles.pickerColumn}>
            <Text style={[styles.pickerTitle, { color: theme.subtitle }]}>DZIELNICA</Text>
            <View style={[styles.pickerBox, { backgroundColor: inputBg, borderColor }, shadow]}>
              <Picker selectedValue={draft.district || ''} onValueChange={handleDistrictChange} style={styles.pickerNative} itemStyle={{ color: theme.text, height: 160, fontSize: 18, fontWeight: '700' }}>{(DISTRICTS_DATA[draft.city as keyof typeof DISTRICTS_DATA] || []).map(d => <Picker.Item key={d} label={d} value={d} />)}</Picker>
            </View>
          </View>
        </View>

        <View style={{ height: 200 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressContainer: { marginBottom: 15 }, progressText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  mapContainer: { height: '42%', width: '100%', position: 'relative' },
  map: { flex: 1 },
  mapGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  centerPinContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  precisePinWrapper: { position: 'absolute', marginTop: -40, alignItems: 'center' },
  pinHead: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#dc2626', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.9, shadowRadius: 10, elevation: 10, zIndex: 4 },
  pinNeedle: { width: 3, height: 26, marginTop: -2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, zIndex: 3 },
  pinContactPoint: { width: 6, height: 2, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.9)', marginTop: 0, zIndex: 2 },
  pinShadowMap: { position: 'absolute', bottom: -2, width: 14, height: 5, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 10, transform: [{ scaleY: 0.5 }], zIndex: 1 },
  redWave: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(220, 38, 38, 0.4)', borderWidth: 2, borderColor: 'rgba(220, 38, 38, 0.8)', zIndex: 0, bottom: -10 },
  approximateArea: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(220, 38, 38, 0.2)', borderWidth: 3, borderColor: '#dc2626' },
  glowShadow: { shadowColor: '#dc2626', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 20, elevation: 15 },
  controlsContainer: { flex: 1, padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -30, zIndex: 2 },
  header: { fontSize: 34, fontWeight: '800', marginBottom: 20, letterSpacing: -1 },
  glassCard: { padding: 18, borderRadius: 26, borderTopWidth: 1.5, borderLeftWidth: 1.5, marginBottom: 25, borderWidth: 1 },
  insetSlot: { borderRadius: 22, borderTopWidth: 2, borderLeftWidth: 1.5, borderBottomWidth: 1, marginBottom: 30, borderWidth: 1 }, 
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 17, fontWeight: '700' }, subLabel: { fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { height: 55, paddingHorizontal: 20, fontSize: 17, fontWeight: '600' },
  pickerWrapper: { flexDirection: 'row', gap: 15, height: 200, marginBottom: 10 }, pickerColumn: { flex: 1, alignItems: 'stretch' }, pickerTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center', letterSpacing: 1 },
  pickerBox: { flex: 1, justifyContent: 'center', borderRadius: 22, borderTopWidth: 2, borderBottomWidth: 1, borderWidth: 1 }, pickerNative: { width: '100%', height: 160 },
});
