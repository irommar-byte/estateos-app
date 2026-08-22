import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { suggestAddresses } from '../../services/agencyClientService';
import { API_URL } from '../../config/network';
import {
  detectOfferLocationFromPin,
  districtsForCity,
  isStrictOfferCity,
  polishStrictCities,
} from '../../lib/detectOfferDistrict';
import {
  REST_OF_COUNTRY_CITY,
  streetLineFromGeocodedPlace,
  type GeocodedPlaceInput,
} from '../../constants/locationEcosystem';
import StreetViewPreviewModal from './StreetViewPreviewModal';

const DEFAULT_LAT = 52.2297;
const DEFAULT_LNG = 21.0122;
const DEFAULT_DELTA = 0.012;
const PIN_DELTA = 0.0035;
const ERROR_RED = '#FF3B30';

export type AcquisitionAddressValue = {
  address: string;
  city: string | null;
  district: string | null;
  lat: number | null;
  lng: number | null;
};

type Suggestion = {
  id: string;
  label: string;
  address: string;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function placeFromGeocode(place?: Location.LocationGeocodedAddress | null): GeocodedPlaceInput {
  return {
    city: place?.city,
    subregion: place?.subregion,
    name: place?.name,
    region: place?.region,
    district: place?.district,
    street: place?.street,
    isoCountryCode: place?.isoCountryCode,
    country: place?.country,
  };
}

async function refineFromServer(params: {
  token: string;
  lat: number;
  lng: number;
  streetHint?: string;
  preferredCity?: string | null;
}): Promise<{ city?: string; district?: string } | null> {
  const qs = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
  });
  if (params.streetHint) qs.set('streetHint', params.streetHint);
  if (params.preferredCity) qs.set('preferredCity', params.preferredCity);
  try {
    const res = await fetch(`${API_URL}/api/location/reverse?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${params.token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { city?: string; district?: string };
    return {
      city: String(json.city || '').trim() || undefined,
      district: String(json.district || '').trim() || undefined,
    };
  } catch {
    return null;
  }
}

export default function AcquisitionAddressMapField({
  token,
  value,
  onChange,
  isDark,
  disabled,
  label = 'ADRES NIERUCHOMOŚCI',
  errorKeys,
}: {
  token: string | null;
  value: AcquisitionAddressValue;
  onChange: (next: AcquisitionAddressValue) => void;
  isDark?: boolean;
  disabled?: boolean;
  label?: string;
  errorKeys?: Set<string>;
}) {
  const mapRef = useRef<MapView>(null);
  const seq = useRef(0);
  const suggestSeq = useRef(0);
  const skipRegion = useRef(false);
  const suppressSuggestRef = useRef(false);
  const districtLockedRef = useRef(false);
  const [query, setQuery] = useState(value.address);
  const [hints, setHints] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('hybrid');
  const [streetViewOpen, setStreetViewOpen] = useState(false);

  const colors = {
    text: isDark ? '#fff' : '#000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    input: isDark ? '#2C2C2E' : '#F2F2F7',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    accent: '#34C759',
    card: isDark ? '#1C1C1E' : '#fff',
  };

  const pinReady = Number.isFinite(value.lat) && Number.isFinite(value.lng);
  const mapLat = value.lat ?? DEFAULT_LAT;
  const mapLng = value.lng ?? DEFAULT_LNG;
  const addressError = Boolean(errorKeys?.has('property.address') || errorKeys?.has('property.pin'));
  const cityError = Boolean(errorKeys?.has('property.city'));
  const districtError = Boolean(errorKeys?.has('property.district'));
  const city = String(value.city || '').trim();
  const district = String(value.district || '').trim();
  const cityDistricts = districtsForCity(city);
  const restOfCountry = city === REST_OF_COUNTRY_CITY || (!cityDistricts.length && Boolean(city));

  useEffect(() => {
    setQuery(value.address);
  }, [value.address]);

  useEffect(() => {
    const q = query.trim();
    if (suppressSuggestRef.current || !token || disabled || q.length < 3) {
      if (suppressSuggestRef.current || q.length < 3) setHints([]);
      return;
    }
    const request = ++suggestSeq.current;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const next = await suggestAddresses(token, q);
        if (request !== suggestSeq.current || suppressSuggestRef.current) return;
        setHints(next);
      } catch {
        if (request === suggestSeq.current) setHints([]);
      } finally {
        if (request === suggestSeq.current) setLoading(false);
      }
    }, 280);
    return () => clearTimeout(handle);
  }, [query, token, disabled]);

  const flyTo = useCallback((lat: number, lng: number, delta?: number) => {
    const zoom = delta ?? (Number.isFinite(value.lat) && Number.isFinite(value.lng) ? PIN_DELTA : DEFAULT_DELTA);
    skipRegion.current = true;
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: zoom, longitudeDelta: zoom },
      280,
    );
  }, [value.lat, value.lng]);

  const applyCoords = useCallback(
    async (lat: number, lng: number, preferredLabel?: string, preferredCity?: string | null) => {
      const request = ++seq.current;
      suppressSuggestRef.current = true;
      suggestSeq.current += 1;
      setHints([]);
      setLoading(false);
      districtLockedRef.current = false;
      try {
        const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (request !== seq.current) return;
        const rawPlace = reverse[0];
        const place = placeFromGeocode(rawPlace);
        const street = streetLineFromGeocodedPlace(
          { street: rawPlace?.street, streetNumber: rawPlace?.streetNumber, name: rawPlace?.name },
          preferredLabel || '',
        );
        const locality = String(rawPlace?.city || rawPlace?.subregion || '').trim();
        const detected = detectOfferLocationFromPin({
          lat,
          lng,
          place,
          streetHint: street,
          preferredCity: preferredCity || city || null,
        });
        const label =
          preferredLabel ||
          [street || rawPlace?.name, detected.city === REST_OF_COUNTRY_CITY ? locality : detected.city, rawPlace?.postalCode]
            .filter(Boolean)
            .join(', ');
        const next: AcquisitionAddressValue = {
          address: label,
          city: detected.city || preferredCity || locality || null,
          district: detected.district || null,
          lat,
          lng,
        };
        onChange(next);
        setQuery(label);

        if (token) {
          const refined = await refineFromServer({
            token,
            lat,
            lng,
            streetHint: street || label,
            preferredCity: next.city,
          });
          if (request !== seq.current || districtLockedRef.current || !refined) return;
          const refinedCity = refined.city || next.city;
          const refinedDistrict = refined.district || next.district;
          if (refinedCity !== next.city || refinedDistrict !== next.district) {
            onChange({
              ...next,
              city: refinedCity,
              district: refinedDistrict,
            });
          }
        }
      } catch {
        if (request !== seq.current) return;
        onChange({
          address: preferredLabel || query,
          city: preferredCity || value.city,
          district: value.district,
          lat,
          lng,
        });
      }
    },
    [city, onChange, query, token, value.city, value.district],
  );

  const selectHint = (item: Suggestion) => {
    suppressSuggestRef.current = true;
    suggestSeq.current += 1;
    setHints([]);
    setLoading(false);
    setQuery(item.label || item.address);
    const lat = Number(item.lat);
    const lng = Number(item.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      flyTo(lat, lng);
      void applyCoords(lat, lng, item.label || item.address, item.city);
      return;
    }
    onChange({
      address: item.label || item.address,
      city: item.city || null,
      district: value.district,
      lat: null,
      lng: null,
    });
  };

  const onRegionComplete = (region: Region, details?: { isGesture?: boolean }) => {
    if (disabled) return;
    if (skipRegion.current) {
      skipRegion.current = false;
      return;
    }
    if (details && details.isGesture === false) return;
    void applyCoords(region.latitude, region.longitude);
  };

  const useGps = async () => {
    if (disabled) return;
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      flyTo(pos.coords.latitude, pos.coords.longitude);
      await applyCoords(pos.coords.latitude, pos.coords.longitude);
    } finally {
      setLocating(false);
    }
  };

  const patchLocation = (patch: Partial<AcquisitionAddressValue>) => {
    districtLockedRef.current = true;
    onChange({ ...value, ...patch });
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: addressError ? ERROR_RED : colors.secondary }]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          editable={!disabled}
          value={query}
          onChangeText={(text) => {
            suppressSuggestRef.current = false;
            setQuery(text);
            onChange({ ...value, address: text });
          }}
          placeholder="Ulica, numer, miasto…"
          placeholderTextColor={colors.secondary}
          autoCorrect={false}
          style={[
            styles.input,
            {
              backgroundColor: colors.input,
              color: colors.text,
              borderColor: addressError ? ERROR_RED : colors.border,
              flex: 1,
            },
          ]}
        />
        <Pressable
          disabled={disabled || locating}
          onPress={() => void useGps()}
          style={[styles.locateBtn, { backgroundColor: colors.input, borderColor: colors.border }]}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="locate" size={20} color={colors.accent} />
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.hintRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={{ color: colors.secondary, fontSize: 12 }}>Szukam adresu…</Text>
        </View>
      ) : null}

      {hints.length > 0
        ? hints.map((item) => (
            <Pressable key={item.id} onPress={() => selectHint(item)} style={styles.hint}>
              <Ionicons name="location" size={16} color={colors.accent} />
              <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{item.label}</Text>
            </Pressable>
          ))
        : null}

      <View style={[styles.mapWrap, { borderColor: addressError ? ERROR_RED : pinReady ? colors.accent : colors.border }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          mapType={mapType}
          scrollEnabled={!disabled}
          zoomEnabled={!disabled}
          pitchEnabled={false}
          rotateEnabled={false}
          initialRegion={{
            latitude: mapLat,
            longitude: mapLng,
            latitudeDelta: pinReady ? PIN_DELTA : DEFAULT_DELTA,
            longitudeDelta: pinReady ? PIN_DELTA : DEFAULT_DELTA,
          }}
          onRegionChangeComplete={onRegionComplete}
        />
        <View style={styles.mapToolbar} pointerEvents="box-none">
          <Pressable
            onPress={() => setMapType((current) => (current === 'hybrid' ? 'standard' : 'hybrid'))}
            style={[styles.mapToolBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name={mapType === 'hybrid' ? 'earth' : 'map'} size={16} color={colors.accent} />
            <Text style={{ color: colors.text, fontSize: 10, fontWeight: '800' }}>
              {mapType === 'hybrid' ? 'Satelita' : 'Mapa'}
            </Text>
          </Pressable>
          {pinReady && value.lat != null && value.lng != null ? (
            <Pressable
              onPress={() => setStreetViewOpen(true)}
              style={[styles.mapToolBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="walk" size={16} color={colors.accent} />
              <Text style={{ color: colors.text, fontSize: 10, fontWeight: '800' }}>Street View</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.pin} pointerEvents="none">
          <View style={styles.pinHead} />
          <View style={styles.pinNeedle} />
        </View>
      </View>

      {pinReady && value.lat != null && value.lng != null ? (
        <StreetViewPreviewModal
          visible={streetViewOpen}
          lat={value.lat}
          lng={value.lng}
          title={value.address}
          isDark={isDark}
          onClose={() => setStreetViewOpen(false)}
        />
      ) : null}

      {pinReady ? (
        <View style={styles.okRow}>
          <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
          <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12, flex: 1 }}>
            Pinezka ustawiona — miasto i dzielnica wykryte z mapy
          </Text>
        </View>
      ) : (
        <Text style={{ color: addressError ? ERROR_RED : colors.secondary, fontSize: 11, marginTop: 6 }}>
          Wybierz podpowiedź jednym kliknięciem albo przesuń mapę, aż pinezka wskaże nieruchomość.
        </Text>
      )}

      <Text style={[styles.label, { color: cityError ? ERROR_RED : colors.secondary, marginTop: 14 }]}>MIASTO</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityRow}>
        {polishStrictCities().map((item) => {
          const active = city === item;
          return (
            <Pressable
              key={item}
              disabled={disabled}
              onPress={() => {
                const nextDistricts = districtsForCity(item);
                patchLocation({
                  city: item,
                  district: nextDistricts.includes(district) ? district : '',
                });
              }}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? colors.accent : colors.input,
                  borderColor: cityError ? ERROR_RED : active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={{ color: active ? '#000' : colors.text, fontWeight: '800', fontSize: 12 }}>{item}</Text>
            </Pressable>
          );
        })}
        <Pressable
          disabled={disabled}
          onPress={() =>
            patchLocation({
              city: REST_OF_COUNTRY_CITY,
              district: isStrictOfferCity(city) ? '' : district,
            })
          }
          style={[
            styles.pill,
            {
              backgroundColor: restOfCountry ? colors.accent : colors.input,
              borderColor: cityError ? ERROR_RED : restOfCountry ? colors.accent : colors.border,
            },
          ]}
        >
          <Text style={{ color: restOfCountry ? '#000' : colors.text, fontWeight: '800', fontSize: 12 }}>
            {REST_OF_COUNTRY_CITY}
          </Text>
        </Pressable>
      </ScrollView>

      {cityDistricts.length > 0 ? (
        <>
          <Text style={[styles.label, { color: districtError ? ERROR_RED : colors.secondary, marginTop: 12 }]}>
            DZIELNICA
          </Text>
          <View style={styles.districtWrap}>
            {cityDistricts.map((item) => {
              const active = district === item;
              return (
                <Pressable
                  key={item}
                  disabled={disabled}
                  onPress={() => patchLocation({ district: item })}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: active ? colors.accent : colors.input,
                      borderColor: districtError ? ERROR_RED : active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? '#000' : colors.text, fontWeight: '800', fontSize: 12 }}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.label, { color: districtError ? ERROR_RED : colors.secondary, marginTop: 12 }]}>
            DZIELNICA / MIEJSCOWOŚĆ
          </Text>
          <TextInput
            editable={!disabled}
            value={district}
            onChangeText={(text) => patchLocation({ district: text, city: city || REST_OF_COUNTRY_CITY })}
            placeholder="Np. Piaseczno, Konstancin…"
            placeholderTextColor={colors.secondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.text,
                borderColor: districtError ? ERROR_RED : colors.border,
              },
            ]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  locateBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  mapWrap: {
    marginTop: 10,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  mapToolbar: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 8,
    alignItems: 'flex-end',
  },
  mapToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  map: { ...StyleSheet.absoluteFillObject },
  pin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -10,
    marginTop: -36,
    alignItems: 'center',
  },
  pinHead: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#34C759',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  pinNeedle: {
    width: 3,
    height: 16,
    backgroundColor: '#34C759',
    marginTop: -2,
    borderRadius: 2,
  },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  cityRow: { gap: 8, paddingBottom: 4, paddingHorizontal: 2 },
  districtWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
