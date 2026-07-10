import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { MapPin } from 'lucide-react-native';
import {
  DEFAULT_LOCALITY_COUNTRY,
  countryFieldsFromGeocodedPlace,
  resolvePinLocationFromGeocodedPlace,
  formatLocationLabel,
  REST_OF_COUNTRY_CITY,
} from '../../constants/locationEcosystem';
import { useCarScreenColors, type CarScreenColors } from '../../theme/carScreenTheme';
import { useThemeStore } from '../../store/useThemeStore';

export type CitySelection = {
  city: string;
  lat: number | null;
  lng: number | null;
  country?: string;
  countryCode?: string;
};

type CarCityMapPickerProps = {
  value: string;
  country?: string;
  countryCode?: string;
  lat: number | null;
  lng: number | null;
  onChange: (selection: CitySelection) => void;
};

type CitySuggestion = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

const DEFAULT_LAT = 52.2297;
const DEFAULT_LNG = 21.0122;
const MAP_HEIGHT = 268;
const DEFAULT_DELTA = 0.045;

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function localityLabelFromGeocodedPlace(
  place: Location.LocationGeocodedAddress,
  lat: number,
  lng: number,
): string {
  const resolution = resolvePinLocationFromGeocodedPlace(place, {
    streetHint: '',
    lat,
    lng,
    anchorStrictCity: null,
  });

  if (resolution.mode === 'strict') {
    const district = String(place.district || place.subregion || '').trim();
    if (district && district.toLowerCase() !== 'ogólna') {
      return `${resolution.strictCity} ${district}`;
    }
    return resolution.strictCity;
  }

  const city = String(resolution.city || '').trim();
  const district = String(resolution.district || '').trim();
  if (city === REST_OF_COUNTRY_CITY) {
    return formatLocationLabel(city, district, DEFAULT_LOCALITY_COUNTRY).replace(', ', ' ');
  }
  return district || city || formatLocationLabel(city, district).replace(', ', ' ');
}

async function reverseGeocodeSelection(lat: number, lng: number): Promise<CitySelection> {
  const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
  const place = reverse[0];
  if (!place) {
    return { city: '', lat, lng, country: DEFAULT_LOCALITY_COUNTRY, countryCode: 'PL' };
  }
  const countryFields = countryFieldsFromGeocodedPlace(place);
  const city = localityLabelFromGeocodedPlace(place, lat, lng);
  return {
    city,
    lat,
    lng,
    country: countryFields.localityCountry,
    countryCode: countryFields.localityCountryCode,
  };
}

async function geocodeCitySuggestions(query: string): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const results = await Location.geocodeAsync(`${q}, Polska`);
    const out: CitySuggestion[] = [];
    for (const item of results.slice(0, 6)) {
      const reverse = await Location.reverseGeocodeAsync({
        latitude: item.latitude,
        longitude: item.longitude,
      });
      const place = reverse[0];
      if (!place) continue;
      const label = localityLabelFromGeocodedPlace(place, item.latitude, item.longitude);
      if (!label) continue;
      const id = `geo:${label}:${item.latitude.toFixed(4)}:${item.longitude.toFixed(4)}`;
      if (out.some((entry) => entry.label.toLowerCase() === label.toLowerCase())) continue;
      out.push({ id, label, lat: item.latitude, lng: item.longitude });
    }
    return out;
  } catch {
    return [];
  }
}

export default function CarCityMapPicker({
  value,
  country = DEFAULT_LOCALITY_COUNTRY,
  countryCode = 'PL',
  lat,
  lng,
  onChange,
}: CarCityMapPickerProps) {
  const colors = useCarScreenColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDark = useThemeStore((state) => state.getResolvedTheme() === 'dark');
  const mapRef = useRef<MapView>(null);
  const reverseGeocodeSeq = useRef(0);
  const mapInitialized = useRef(false);
  const manualQueryRef = useRef(false);

  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const mapLat = lat ?? DEFAULT_LAT;
  const mapLng = lng ?? DEFAULT_LNG;

  useEffect(() => {
    if (manualQueryRef.current) return;
    setQuery(value);
  }, [value]);

  const centerMap = useCallback((nextLat: number, nextLng: number, delta = DEFAULT_DELTA) => {
    mapRef.current?.animateToRegion(
      { latitude: nextLat, longitude: nextLng, latitudeDelta: delta, longitudeDelta: delta },
      350,
    );
  }, []);

  useEffect(() => {
    if (mapInitialized.current || lat == null || lng == null) return;
    mapInitialized.current = true;
    centerMap(lat, lng, DEFAULT_DELTA);
  }, [lat, lng, centerMap]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (query.trim().length < 3) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      geocodeCitySuggestions(query)
        .then(setSuggestions)
        .finally(() => setLoading(false));
    }, 280);
    return () => clearTimeout(handle);
  }, [query]);

  const applySelection = useCallback(
    (selection: CitySelection) => {
      manualQueryRef.current = false;
      setQuery(selection.city);
      onChange(selection);
    },
    [onChange],
  );

  const selectSuggestion = async (item: CitySuggestion) => {
    setSuggestions([]);
    const selection = await reverseGeocodeSelection(item.lat, item.lng);
    applySelection({ ...selection, city: item.label || selection.city });
    centerMap(item.lat, item.lng, DEFAULT_DELTA);
  };

  const handleRegionChangeComplete = async (region: Region, details?: { isGesture?: boolean }) => {
    if (details && details.isGesture === false) return;

    const seq = ++reverseGeocodeSeq.current;
    onChange({
      city: query,
      lat: region.latitude,
      lng: region.longitude,
      country,
      countryCode,
    });

    try {
      const selection = await reverseGeocodeSelection(region.latitude, region.longitude);
      if (seq !== reverseGeocodeSeq.current) return;
      applySelection(selection);
    } catch {
      // współrzędne zapisane
    }
  };

  const applyGpsLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Lokalizacja', 'Brak dostępu do lokalizacji urządzenia.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const selection = await reverseGeocodeSelection(position.coords.latitude, position.coords.longitude);
      applySelection(selection);
      centerMap(position.coords.latitude, position.coords.longitude, DEFAULT_DELTA);
    } catch {
      Alert.alert('Lokalizacja', 'Nie udało się ustalić Twojej pozycji.');
    } finally {
      setLocating(false);
    }
  };

  const showSuggestions = manualQueryRef.current && query.trim().length >= 3 && (loading || suggestions.length > 0);

  return (
    <View style={styles.root}>
      <Text style={styles.sectionTitle}>Lokalizacja ogłoszenia</Text>

      <Text style={styles.label}>Miejscowość</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={query}
          onChangeText={(text) => {
            manualQueryRef.current = true;
            setQuery(text);
            onChange({ city: text, lat, lng, country, countryCode });
          }}
          onFocus={() => {
            manualQueryRef.current = true;
          }}
          placeholder="Ustaw pinezką na mapie lub wyszukaj..."
          placeholderTextColor={colors.placeholder}
          style={[styles.input, styles.inputFlex]}
          autoCorrect={false}
          autoCapitalize="words"
        />
        <Pressable
          onPress={() => void applyGpsLocation()}
          disabled={locating}
          style={({ pressed }) => [styles.locateBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Użyj mojej lokalizacji"
        >
          {locating ? (
            <ActivityIndicator color={colors.accentSoft} size="small" />
          ) : (
            <Ionicons name="locate" size={22} color={colors.accentSoft} />
          )}
        </Pressable>
      </View>

      {showSuggestions ? (
        <View style={styles.suggestions}>
          {loading ? <ActivityIndicator color={colors.accentSoft} style={{ margin: 10 }} /> : null}
          {suggestions.map((item) => (
            <Pressable key={item.id} onPress={() => void selectSuggestion(item)} style={styles.suggestionRow}>
              <MapPin color={colors.placeholder} size={16} />
              <Text style={styles.suggestionLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          scrollEnabled
          zoomEnabled
          zoomTapEnabled
          pitchEnabled={false}
          rotateEnabled={false}
          initialRegion={{
            latitude: mapLat,
            longitude: mapLng,
            latitudeDelta: DEFAULT_DELTA,
            longitudeDelta: DEFAULT_DELTA,
          }}
          onRegionChangeComplete={handleRegionChangeComplete}
        />
        <View style={styles.centerPinContainer} pointerEvents="none">
          <View style={styles.pinHead} />
          <View style={styles.pinNeedle} />
        </View>
        <Text style={styles.mapHint}>Przesuwaj i przybliżaj mapę — miejscowość ustala pinezka.</Text>
      </View>
    </View>
  );
}

function createStyles(colors: CarScreenColors) {
  return StyleSheet.create({
    root: { gap: 8 },
    sectionTitle: { color: colors.accent, fontSize: 14, fontWeight: '700', marginBottom: 2 },
    label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    inputRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
    },
    inputFlex: { flex: 1 },
    locateBtn: {
      width: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.buttonBorder,
      backgroundColor: colors.buttonBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestions: {
      maxHeight: 200,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.inputBorder,
    },
    suggestionLabel: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
    mapContainer: {
      height: MAP_HEIGHT,
      width: '100%',
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      borderWidth: 1,
      borderColor: colors.inputBorder,
      marginTop: 4,
    },
    map: { flex: 1 },
    centerPinContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pinHead: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#ef4444',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
      marginTop: -24,
    },
    pinNeedle: {
      width: 3,
      height: 24,
      marginTop: -2,
      backgroundColor: '#9ca3af',
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
    },
    mapHint: {
      position: 'absolute',
      left: 10,
      right: 10,
      bottom: 10,
      color: 'rgba(235,235,245,0.85)',
      fontSize: 11,
      lineHeight: 15,
      textAlign: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
  });
}
