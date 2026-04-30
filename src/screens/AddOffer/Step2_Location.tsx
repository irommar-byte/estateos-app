import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, Animated, Easing, Pressable, LayoutAnimation, UIManager } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AddOfferStepper from '../../components/AddOfferStepper';
import { fetchLocationCatalog, getFallbackLocationCatalog } from '../../services/locationCatalog';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Colors = { primary: '#10b981' };
const API_URL = 'https://estateos.pl';

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Warszawa: { lat: 52.2297, lng: 21.0122 },
  Kraków: { lat: 50.0614, lng: 19.9366 },
  'Łódź': { lat: 51.7592, lng: 19.4560 },
  Wrocław: { lat: 51.1079, lng: 17.0385 },
  Poznań: { lat: 52.4064, lng: 16.9252 },
  Lublin: { lat: 51.2465, lng: 22.5684 },
  Gdańsk: { lat: 54.352, lng: 18.6466 },
  Gdynia: { lat: 54.5189, lng: 18.5305 },
  Sopot: { lat: 54.4416, lng: 18.5601 },
  Katowice: { lat: 50.2649, lng: 19.0238 },
  Rybnik: { lat: 50.0971, lng: 18.5418 },
  Białystok: { lat: 53.1325, lng: 23.1688 },
  'Zamość': { lat: 50.7231, lng: 23.2519 },
};

const RedNeedlePin = () => {
  const levitateAnim = useRef(new Animated.Value(0)).current;
  const redWaveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(levitateAnim, { toValue: -12, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(levitateAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ])).start();
    Animated.loop(Animated.timing(redWaveAnim, { toValue: 1, duration: 2500, easing: Easing.out(Easing.ease), useNativeDriver: true })).start();
  }, [levitateAnim, redWaveAnim]);

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
  }, [pulseValue]);
  return <Animated.View style={[styles.approximateArea, styles.glowShadow, { transform: [{ scale: pulseValue }], opacity: pulseValue.interpolate({ inputRange: [1, 1.12], outputRange: [0.9, 0.5] }) }]} />;
};

type ReverseResult = {
  city: string;
  district: string;
  street: string;
  lat: number;
  lng: number;
};

export default function Step2_Location({ theme }: { theme: any }) {
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const [streetInput, setStreetInput] = useState(draft.street || '');
  const [freeDistrictInput, setFreeDistrictInput] = useState(draft.district || '');
  const [strictCities, setStrictCities] = useState<string[]>(getFallbackLocationCatalog().strictCities);
  const [strictCityDistricts, setStrictCityDistricts] = useState<Record<string, string[]>>(getFallbackLocationCatalog().strictCityDistricts);

  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation<any>();
  const isProgrammaticMove = useRef(false);

  useFocusEffect(useCallback(() => { setCurrentStep(2); }, [setCurrentStep]));

  useEffect(() => {
    let mounted = true;
    const loadCatalog = async () => {
      const catalog = await fetchLocationCatalog();
      if (!mounted) return;
      setStrictCities(catalog.strictCities);
      setStrictCityDistricts(catalog.strictCityDistricts);
    };
    loadCatalog();
    return () => { mounted = false; };
  }, []);

  const isDark = theme.glass === 'dark';
  const cardBg = isDark ? 'rgba(30,30,34,0.65)' : '#ffffff';
  const inputBg = isDark ? 'rgba(0,0,0,0.5)' : '#ffffff';
  const shadow = isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 };
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)';

  const hasAddress = !!draft.street && draft.street.length > 2;
  const isStrictCity = strictCities.includes(draft.city);

  const districtOptions = useMemo(() => {
    if (!draft.city) return [];
    return strictCityDistricts[draft.city] || [];
  }, [draft.city, strictCityDistricts]);

  useEffect(() => {
    if (!isStrictCity) {
      setFreeDistrictInput(draft.district || '');
    }
  }, [isStrictCity, draft.district]);

  const flyTo = (targetLat: number, targetLng: number, isExact: boolean) => {
    isProgrammaticMove.current = true;
    mapRef.current?.animateCamera({
      center: { latitude: targetLat, longitude: targetLng },
      pitch: isExact ? 75 : 30,
      altitude: isExact ? 150 : 4000,
      zoom: isExact ? 19.5 : 13.5,
      heading: 0
    }, { duration: 2500 });

    setTimeout(() => { isProgrammaticMove.current = false; }, 2600);
  };

  const reverseFromBackend = async (lat: number, lng: number): Promise<ReverseResult | null> => {
    try {
      const response = await fetch(`${API_URL}/api/location/reverse?lat=${lat}&lng=${lng}`);
      const json = await response.json();
      if (!response.ok || !json?.success) return null;
      return {
        city: json.city || '',
        district: json.district || '',
        street: json.street || '',
        lat,
        lng,
      };
    } catch {
      return null;
    }
  };

  const fallbackReverse = async (lat: number, lng: number): Promise<ReverseResult | null> => {
    try {
      const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (reverse.length === 0) return null;
      const place = reverse[0];
      const city = (place.city || place.subregion || place.region || '').trim();
      const district = (place.district || place.subregion || '').trim();
      const street = [place.street, place.streetNumber].filter(Boolean).join(' ').trim() || place.name || '';
      return {
        city,
        district,
        street,
        lat,
        lng,
      };
    } catch {
      return null;
    }
  };

  const applyReverseResult = (resolved: ReverseResult, isUserSearch = false) => {
    const city = resolved.city || draft.city;
    const strict = strictCities.includes(city);
    const districts = strict ? (strictCityDistricts[city] || []) : [];
    let district = resolved.district || '';

    if (strict && district && !districts.includes(district)) {
      district = '';
    }

    if (strict && !district && districts.length > 0) {
      district = districts[0];
    }

    const street = resolved.street || streetInput;
    setStreetInput(street);
    if (!strict) {
      setFreeDistrictInput(district || draft.district || '');
    }

    updateDraft({
      city,
      district: strict ? district : (district || freeDistrictInput || draft.district || ''),
      lat: resolved.lat,
      lng: resolved.lng,
      isExactLocation: isUserSearch ? true : (draft.isExactLocation ?? true),
      street,
    });
  };

  const handleAddressSearch = async () => {
    if (streetInput.length < 3) return;
    if (!/\d/.test(streetInput)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Brak numeru', "Proszę podać dokładny adres z numerem, np. 'Wolska 56'.");
      return;
    }

    try {
      const result = await Location.geocodeAsync(streetInput + ', Polska');
      if (result.length === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Nie znaleziono', 'System nie mógł odnaleźć tego adresu na mapie.');
        return;
      }

      const { latitude, longitude } = result[0];
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      const backend = await reverseFromBackend(latitude, longitude);
      const fallback = backend ?? (await fallbackReverse(latitude, longitude));

      if (fallback) {
        applyReverseResult(fallback, true);
      } else {
        updateDraft({ lat: latitude, lng: longitude, isExactLocation: true });
      }

      flyTo(latitude, longitude, true);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleRegionChangeComplete = async (region: Region, details: any) => {
    updateDraft({ lat: region.latitude, lng: region.longitude });

    if (isProgrammaticMove.current) return;
    if (details && details.isGesture === false) return;

    const backend = await reverseFromBackend(region.latitude, region.longitude);
    const fallback = backend ?? (await fallbackReverse(region.latitude, region.longitude));

    if (!fallback) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    applyReverseResult(fallback);
  };

  const handleCityChange = (city: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const cityDistricts = strictCityDistricts[city] || [];
    const coords = CITY_COORDS[city] || { lat: 52.0, lng: 19.0 };
    updateDraft({ city, district: cityDistricts[0] || '', lat: coords.lat, lng: coords.lng });
    setFreeDistrictInput('');
    flyTo(coords.lat, coords.lng, draft.isExactLocation ?? true);
  };

  const handleDistrictChange = (district: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateDraft({ district });
  };

  const currentIsExact = draft.isExactLocation !== undefined ? draft.isExactLocation : true;

  const displayedCities = useMemo(() => {
    if (draft.city && !strictCities.includes(draft.city)) {
      return [...strictCities, draft.city];
    }
    return strictCities;
  }, [strictCities, draft.city]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          showsBuildings={true}
          pitchEnabled={true}
          initialRegion={{ latitude: draft.lat || 52.2297, longitude: draft.lng || 21.0122, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          onRegionChangeComplete={handleRegionChangeComplete}
        />
        <View style={styles.centerPinContainer} pointerEvents='none'>{currentIsExact ? <RedNeedlePin /> : <BreathingCircle />}</View>
        <View style={[styles.mapGradient, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)' }]} pointerEvents='none' />
      </View>

      <ScrollView style={styles.controlsContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps='handled'>
        <AddOfferStepper currentStep={2} draft={draft} theme={theme} navigation={navigation} />

        <Text style={[styles.header, { color: theme.text }]}>Lokalizacja</Text>

        <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>Wyszukaj adres</Text>
        <View style={[styles.insetSlot, { backgroundColor: inputBg, borderColor }, shadow]}>
          <TextInput style={[styles.input, { color: theme.text }]} placeholder='np. Wolska 56' placeholderTextColor={theme.subtitle} value={streetInput} onChangeText={setStreetInput} onSubmitEditing={handleAddressSearch} returnKeyType='search' selectionColor='#dc2626' />
        </View>

        <View pointerEvents={hasAddress ? 'auto' : 'none'} style={{ opacity: hasAddress ? 1 : 0.35 }}>
          <View style={[styles.glassCard, { backgroundColor: cardBg, borderColor }, shadow]}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.text }]}>Dokładna lokalizacja</Text>
                <Text style={[styles.subLabel, { color: theme.subtitle }]}>Obszar ok. 200m dla ochrony prywatności.</Text>
              </View>
              <Switch value={currentIsExact} onValueChange={(val) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateDraft({ isExactLocation: val }); if (draft.lat && draft.lng) flyTo(draft.lat, draft.lng, val); }} trackColor={{ false: '#D1D1D6', true: '#10b981' }} />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>MIASTO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
            {displayedCities.map((city) => (
              <Pressable key={city} onPress={() => handleCityChange(city)} style={[styles.pillBtn, draft.city === city && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
                <Text style={[styles.pillText, draft.city === city && { color: '#FFF' }]}>{city}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>DZIELNICA</Text>
          {isStrictCity ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 30 }}>
              {districtOptions.map((district) => (
                <Pressable key={district} onPress={() => handleDistrictChange(district)} style={[styles.pillBtn, draft.district === district && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
                  <Text style={[styles.pillText, draft.district === district && { color: '#FFF' }]}>{district}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={[styles.insetSlot, { backgroundColor: inputBg, borderColor }, shadow, { marginBottom: 30 }]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder='np. osiedle / sołectwo'
                placeholderTextColor={theme.subtitle}
                value={freeDistrictInput}
                onChangeText={(value) => {
                  setFreeDistrictInput(value);
                  updateDraft({ district: value });
                }}
                returnKeyType='done'
                selectionColor='#dc2626'
              />
            </View>
          )}
        </View>

        <View style={{ height: 200 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  label: { fontSize: 17, fontWeight: '700' },
  subLabel: { fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { height: 55, paddingHorizontal: 20, fontSize: 17, fontWeight: '600' },
  pillBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(150,150,150,0.3)', backgroundColor: 'rgba(150,150,150,0.05)' },
  pillText: { fontSize: 14, fontWeight: '600', color: '#8E8E93' }
});
