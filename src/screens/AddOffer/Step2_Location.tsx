import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, Animated, Easing, Pressable, LayoutAnimation, UIManager } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AddOfferStepper from '../../components/AddOfferStepper';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Colors = { primary: '#10b981' };

const DISTRICT_COORDS: Record<string, { lat: number, lng: number }> = {
  // WARSZAWA
  'Warszawa': { lat: 52.2297, lng: 21.0122 }, 'Bemowo': { lat: 52.2460, lng: 20.9100 }, 'Białołęka': { lat: 52.3240, lng: 20.9700 },
  'Bielany': { lat: 52.2850, lng: 20.9320 }, 'Mokotów': { lat: 52.1939, lng: 21.0287 }, 'Ochota': { lat: 52.2120, lng: 20.9690 },
  'Praga-Południe': { lat: 52.2390, lng: 21.0825 }, 'Praga-Północ': { lat: 52.2581, lng: 21.0334 }, 'Rembertów': { lat: 52.2580, lng: 21.1620 },
  'Śródmieście': { lat: 52.2297, lng: 21.0122 }, 'Targówek': { lat: 52.2800, lng: 21.0500 }, 'Ursus': { lat: 52.1890, lng: 20.8850 },
  'Ursynów': { lat: 52.1484, lng: 21.0456 }, 'Wawer': { lat: 52.2000, lng: 21.1660 }, 'Wesoła': { lat: 52.2610, lng: 21.2280 },
  'Wilanów': { lat: 52.1643, lng: 21.0894 }, 'Włochy': { lat: 52.1940, lng: 20.9330 }, 'Wola': { lat: 52.2361, lng: 20.9575 }, 'Żoliborz': { lat: 52.2688, lng: 20.9820 },
  
  // ŁÓDŹ
  'Łódź': { lat: 51.7592, lng: 19.4560 }, 'Bałuty': { lat: 51.8003, lng: 19.4244 }, 'Górna': { lat: 51.7225, lng: 19.4756 },
  'Polesie': { lat: 51.7578, lng: 19.4186 }, 'Widzew': { lat: 51.7600, lng: 19.5300 },
  
  // KRAKÓW
  'Kraków': { lat: 50.0614, lng: 19.9366 }, 'Stare Miasto': { lat: 50.0614, lng: 19.9366 }, 'Grzegórzki': { lat: 50.0583, lng: 19.9583 },
  'Prądnik Czerwony': { lat: 50.0883, lng: 19.9692 }, 'Prądnik Biały': { lat: 50.0933, lng: 19.9300 }, 'Krowodrza': { lat: 50.0733, lng: 19.9183 },
  'Bronowice': { lat: 50.0817, lng: 19.8833 }, 'Zwierzyniec': { lat: 50.0533, lng: 19.8833 }, 'Dębniki': { lat: 50.0350, lng: 19.9100 },
  'Łagiewniki-Borek Fałęcki': { lat: 50.0183, lng: 19.9317 }, 'Swoszowice': { lat: 49.9883, lng: 19.9383 }, 'Podgórze Duchackie': { lat: 50.0167, lng: 19.9617 },
  'Bieżanów-Prokocim': { lat: 50.0167, lng: 20.0050 }, 'Podgórze': { lat: 50.0350, lng: 19.9617 }, 'Czyżyny': { lat: 50.0733, lng: 20.0050 },
  'Mistrzejowice': { lat: 50.0967, lng: 20.0133 }, 'Bieńczyce': { lat: 50.0867, lng: 20.0267 }, 'Wzgórza Krzesławickie': { lat: 50.0983, lng: 20.0650 },
  'Nowa Huta': { lat: 50.0717, lng: 20.0383 },

  // WROCŁAW
  'Wrocław': { lat: 51.1079, lng: 17.0385 }, 'Biskupin': { lat: 51.103, lng: 17.100 }, 'Borek': { lat: 51.080, lng: 17.000 },
  'Fabryczna': { lat: 51.1110, lng: 16.9630 }, 'Gaj': { lat: 51.075, lng: 17.040 }, 'Gądów Mały': { lat: 51.127, lng: 16.965 },
  'Grabiszyn': { lat: 51.093, lng: 16.990 }, 'Huby': { lat: 51.085, lng: 17.040 }, 'Jagodno': { lat: 51.050, lng: 17.055 },
  'Karłowice': { lat: 51.140, lng: 17.045 }, 'Kozanów': { lat: 51.135, lng: 16.960 }, 'Krzyki': { lat: 51.0760, lng: 17.0120 },
  'Leśnica': { lat: 51.145, lng: 16.870 }, 'Maślice': { lat: 51.155, lng: 16.930 }, 'Muchobór': { lat: 51.105, lng: 16.940 },
  'Nadodrze': { lat: 51.120, lng: 17.030 }, 'Ołbin': { lat: 51.125, lng: 17.050 }, 'Oporów': { lat: 51.075, lng: 16.970 },
  'Popowice': { lat: 51.130, lng: 16.985 }, 'Psie Pole': { lat: 51.1440, lng: 17.1080 }, 'Stare Miasto WRO': { lat: 51.1079, lng: 17.0385 },
  'Szczepin': { lat: 51.115, lng: 17.005 }, 'Śródmieście WRO': { lat: 51.1190, lng: 17.0540 }, 'Tarnogaj': { lat: 51.070, lng: 17.055 },

  // POZNAŃ
  'Poznań': { lat: 52.4064, lng: 16.9252 }, 'Antoninek': { lat: 52.405, lng: 17.000 }, 'Chartowo': { lat: 52.390, lng: 16.980 },
  'Dębiec': { lat: 52.375, lng: 16.905 }, 'Górczyn': { lat: 52.380, lng: 16.880 }, 'Grunwald': { lat: 52.392, lng: 16.873 },
  'Jeżyce': { lat: 52.413, lng: 16.890 }, 'Junikowo': { lat: 52.385, lng: 16.850 }, 'Łazarz': { lat: 52.395, lng: 16.900 },
  'Naramowice': { lat: 52.450, lng: 16.940 }, 'Nowe Miasto POZ': { lat: 52.395, lng: 16.965 }, 'Ogrody': { lat: 52.420, lng: 16.880 },
  'Piątkowo': { lat: 52.455, lng: 16.910 }, 'Podolany': { lat: 52.450, lng: 16.890 }, 'Rataje': { lat: 52.385, lng: 16.955 },
  'Sołacz': { lat: 52.425, lng: 16.905 }, 'Stare Miasto POZ': { lat: 52.406, lng: 16.925 }, 'Strzeszyn': { lat: 52.455, lng: 16.865 },
  'Świerczewo': { lat: 52.365, lng: 16.890 }, 'Wilda': { lat: 52.388, lng: 16.922 }, 'Winogrady': { lat: 52.435, lng: 16.925 }, 'Winiary': { lat: 52.430, lng: 16.910 },

  // TRÓJMIASTO
  'Trójmiasto': { lat: 54.4000, lng: 18.5700 }, 
  'Gdańsk - Śródmieście': { lat: 54.352, lng: 18.646 }, 'Gdańsk - Wrzeszcz': { lat: 54.380, lng: 18.605 }, 'Gdańsk - Oliwa': { lat: 54.409, lng: 18.563 },
  'Gdańsk - Przymorze': { lat: 54.410, lng: 18.595 }, 'Gdańsk - Zaspa': { lat: 54.395, lng: 18.605 }, 'Gdańsk - Osowa': { lat: 54.425, lng: 18.460 },
  'Gdańsk - Chełm': { lat: 54.335, lng: 18.620 }, 'Gdańsk - Jasień': { lat: 54.335, lng: 18.565 },
  'Gdynia - Śródmieście': { lat: 54.518, lng: 18.530 }, 'Gdynia - Orłowo': { lat: 54.480, lng: 18.560 }, 'Gdynia - Redłowo': { lat: 54.495, lng: 18.540 }, 'Gdynia - Chylonia': { lat: 54.535, lng: 18.470 },
  'Sopot - Dolny': { lat: 54.445, lng: 18.565 }, 'Sopot - Górny': { lat: 54.440, lng: 18.550 },
  
  'Inna lokalizacja': { lat: 52.0, lng: 19.0 }
};

const DISTRICTS_DATA = {
  'Warszawa': ['Bemowo', 'Białołęka', 'Bielany', 'Mokotów', 'Ochota', 'Praga-Południe', 'Praga-Północ', 'Rembertów', 'Śródmieście', 'Targówek', 'Ursus', 'Ursynów', 'Wawer', 'Wesoła', 'Wilanów', 'Włochy', 'Wola', 'Żoliborz'],
  'Kraków': ['Stare Miasto', 'Grzegórzki', 'Prądnik Czerwony', 'Prądnik Biały', 'Krowodrza', 'Bronowice', 'Zwierzyniec', 'Dębniki', 'Łagiewniki-Borek Fałęcki', 'Swoszowice', 'Podgórze Duchackie', 'Bieżanów-Prokocim', 'Podgórze', 'Czyżyny', 'Mistrzejowice', 'Bieńczyce', 'Wzgórza Krzesławickie', 'Nowa Huta'],
  'Łódź': ['Bałuty', 'Górna', 'Polesie', 'Śródmieście', 'Widzew'],
  'Wrocław': ['Biskupin', 'Borek', 'Fabryczna', 'Gaj', 'Gądów Mały', 'Grabiszyn', 'Huby', 'Jagodno', 'Karłowice', 'Kozanów', 'Krzyki', 'Leśnica', 'Maślice', 'Muchobór', 'Nadodrze', 'Ołbin', 'Oporów', 'Popowice', 'Psie Pole', 'Stare Miasto WRO', 'Szczepin', 'Śródmieście WRO', 'Tarnogaj'],
  'Poznań': ['Antoninek', 'Chartowo', 'Dębiec', 'Górczyn', 'Grunwald', 'Jeżyce', 'Junikowo', 'Łazarz', 'Naramowice', 'Nowe Miasto POZ', 'Ogrody', 'Piątkowo', 'Podolany', 'Rataje', 'Sołacz', 'Stare Miasto POZ', 'Strzeszyn', 'Świerczewo', 'Wilda', 'Winogrady', 'Winiary'],
  'Trójmiasto': ['Gdańsk - Śródmieście', 'Gdańsk - Wrzeszcz', 'Gdańsk - Oliwa', 'Gdańsk - Przymorze', 'Gdańsk - Zaspa', 'Gdańsk - Osowa', 'Gdańsk - Chełm', 'Gdańsk - Jasień', 'Gdynia - Śródmieście', 'Gdynia - Orłowo', 'Gdynia - Redłowo', 'Gdynia - Chylonia', 'Sopot - Dolny', 'Sopot - Górny'],
  'Reszta Polski': ['Inna lokalizacja']
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
  const [streetInput, setStreetInput] = useState(draft.street || '');
  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation<any>();
  
  const isProgrammaticMove = useRef(false);
  
  useFocusEffect(useCallback(() => { setCurrentStep(2); }, []));

  const isDark = theme.glass === 'dark';
  const cardBg = isDark ? 'rgba(30,30,34,0.65)' : '#ffffff';
  const inputBg = isDark ? 'rgba(0,0,0,0.5)' : '#ffffff';
  const shadow = isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 };
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)';

  const hasAddress = !!draft.street && draft.street.length > 2;

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

  const handleAddressSearch = async () => {
    if (streetInput.length < 3) return;
    if (!/\d/.test(streetInput)) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); Alert.alert("Brak numeru", "Proszę podać dokładny adres z numerem, np. 'Wolska 56'."); return; }
    try {
      const result = await Location.geocodeAsync(streetInput + ", Polska");
      if (result.length > 0) {
        const { latitude, longitude } = result[0];
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
        let newStreet = streetInput;
        let finalCity = 'Reszta Polski';
        let finalDistrict = 'Inna lokalizacja';
        
        if (reverse.length > 0) {
          const place = reverse[0];
          const cityInfo = (place.city || place.subregion || place.region || "").toLowerCase();
          
          if (cityInfo.includes('warszawa') || cityInfo.includes('warsaw')) finalCity = 'Warszawa';
          else if (cityInfo.includes('kraków') || cityInfo.includes('krakow') || cityInfo.includes('cracow')) finalCity = 'Kraków';
          else if (cityInfo.includes('łódź') || cityInfo.includes('lodz')) finalCity = 'Łódź';
          else if (cityInfo.includes('wrocław') || cityInfo.includes('wroclaw')) finalCity = 'Wrocław';
          else if (cityInfo.includes('poznań') || cityInfo.includes('poznan')) finalCity = 'Poznań';
          else if (cityInfo.includes('gdańsk') || cityInfo.includes('gdansk') || cityInfo.includes('sopot') || cityInfo.includes('gdynia')) finalCity = 'Trójmiasto';
          
          finalDistrict = getClosestDistrict(latitude, longitude, finalCity);
          if (place.street && place.streetNumber) newStreet = `${place.street} ${place.streetNumber}`;
        }
        
        setStreetInput(newStreet);
        updateDraft({ city: finalCity, district: finalDistrict, lat: latitude, lng: longitude, isExactLocation: true, street: newStreet });
        flyTo(latitude, longitude, true);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Nie znaleziono", "System nie mógł odnaleźć tego adresu na mapie.");
      }
    } catch (e) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
  };

  const handleRegionChangeComplete = async (region: Region, details: any) => {
    updateDraft({ lat: region.latitude, lng: region.longitude });

    if (isProgrammaticMove.current) return;
    if (details && details.isGesture === false) return;

    try {
      const reverse = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
      if (reverse.length > 0) {
        const place = reverse[0];
        
        let newStreet = streetInput;
        if (place.street && place.streetNumber) {
          newStreet = `${place.street} ${place.streetNumber}`;
        } else if (place.street) {
          newStreet = place.street;
        } else if (place.name) {
          newStreet = place.name;
        }

        const cityInfo = (place.city || place.subregion || place.region || "").toLowerCase();
        let finalCity = 'Reszta Polski';
        
        if (cityInfo.includes('warszawa') || cityInfo.includes('warsaw')) finalCity = 'Warszawa';
        else if (cityInfo.includes('kraków') || cityInfo.includes('krakow') || cityInfo.includes('cracow')) finalCity = 'Kraków';
        else if (cityInfo.includes('łódź') || cityInfo.includes('lodz')) finalCity = 'Łódź';
        else if (cityInfo.includes('wrocław') || cityInfo.includes('wroclaw')) finalCity = 'Wrocław';
        else if (cityInfo.includes('poznań') || cityInfo.includes('poznan')) finalCity = 'Poznań';
        else if (cityInfo.includes('gdańsk') || cityInfo.includes('gdansk') || cityInfo.includes('sopot') || cityInfo.includes('gdynia')) finalCity = 'Trójmiasto';
        
        const finalDistrict = getClosestDistrict(region.latitude, region.longitude, finalCity);

        if (newStreet !== streetInput) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          
          setStreetInput(newStreet);
          updateDraft({ city: finalCity, district: finalDistrict, street: newStreet });
        }
      }
    } catch (e) {
      console.log("Błąd Reverse Geocoding:", e);
    }
  };

  const handleCityChange = (city: string) => { 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
    const newDistricts = DISTRICTS_DATA[city as keyof typeof DISTRICTS_DATA]; 
    const coords = DISTRICT_COORDS[city] || { lat: 52.0, lng: 19.0 }; 
    updateDraft({ city, district: newDistricts[0], lat: coords.lat, lng: coords.lng }); 
    if (city !== 'Reszta Polski') flyTo(coords.lat, coords.lng, draft.isExactLocation ?? true); 
  };
  
  const handleDistrictChange = (district: string) => { 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
    updateDraft({ district }); 
    const coords = DISTRICT_COORDS[district]; 
    if (coords) flyTo(coords.lat, coords.lng, draft.isExactLocation ?? true); 
  };

  const currentIsExact = draft.isExactLocation !== undefined ? draft.isExactLocation : true;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
      
      <View style={styles.mapContainer}>
        <MapView 
          ref={mapRef} 
          style={styles.map} 
          userInterfaceStyle={isDark ? "dark" : "light"} 
          showsBuildings={true} 
          pitchEnabled={true} 
          initialRegion={{ latitude: draft.lat || 52.2297, longitude: draft.lng || 21.0122, latitudeDelta: 0.05, longitudeDelta: 0.05 }} 
          onRegionChangeComplete={handleRegionChangeComplete} 
        />
        <View style={styles.centerPinContainer} pointerEvents="none">{currentIsExact ? <RedNeedlePin /> : <BreathingCircle />}</View>
        <View style={[styles.mapGradient, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)' }]} pointerEvents="none" />
      </View>

      <ScrollView style={styles.controlsContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <AddOfferStepper currentStep={2} draft={draft} theme={theme} navigation={navigation} />
        
        <Text style={[styles.header, { color: theme.text }]}>Lokalizacja</Text>
        
        <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>Wyszukaj adres</Text>
        <View style={[styles.insetSlot, { backgroundColor: inputBg, borderColor }, shadow]}>
          <TextInput style={[styles.input, { color: theme.text }]} placeholder="np. Wolska 56" placeholderTextColor={theme.subtitle} value={streetInput} onChangeText={setStreetInput} onSubmitEditing={handleAddressSearch} returnKeyType="search" selectionColor="#dc2626" />
        </View>

        <View pointerEvents={hasAddress ? "auto" : "none"} style={{ opacity: hasAddress ? 1 : 0.35 }}>
          
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
            {Object.keys(DISTRICTS_DATA).map(c => (
              <Pressable key={c} onPress={() => handleCityChange(c)} style={[styles.pillBtn, draft.city === c && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
                <Text style={[styles.pillText, draft.city === c && { color: '#FFF' }]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>DZIELNICA</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 30 }}>
            {(DISTRICTS_DATA[draft.city as keyof typeof DISTRICTS_DATA] || []).map(d => (
              <Pressable key={d} onPress={() => handleDistrictChange(d)} style={[styles.pillBtn, draft.district === d && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
                <Text style={[styles.pillText, draft.district === d && { color: '#FFF' }]}>{d}</Text>
              </Pressable>
            ))}
          </View>

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
  label: { fontSize: 17, fontWeight: '700' }, subLabel: { fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { height: 55, paddingHorizontal: 20, fontSize: 17, fontWeight: '600' },
  
  pillBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(150,150,150,0.3)', backgroundColor: 'rgba(150,150,150,0.05)' },
  pillText: { fontSize: 14, fontWeight: '600', color: '#8E8E93' }
});
