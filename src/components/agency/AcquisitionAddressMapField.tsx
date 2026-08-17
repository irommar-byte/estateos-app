import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { suggestAddresses } from '../../services/agencyClientService';

const DEFAULT_LAT = 52.2297;
const DEFAULT_LNG = 21.0122;
const DEFAULT_DELTA = 0.012;

export type AcquisitionAddressValue = {
  address: string;
  city: string | null;
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

export default function AcquisitionAddressMapField({
  token,
  value,
  onChange,
  isDark,
  disabled,
  label = 'ADRES NIERUCHOMOŚCI',
}: {
  token: string | null;
  value: AcquisitionAddressValue;
  onChange: (next: AcquisitionAddressValue) => void;
  isDark?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const mapRef = useRef<MapView>(null);
  const seq = useRef(0);
  const skipRegion = useRef(false);
  const [query, setQuery] = useState(value.address);
  const [hints, setHints] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

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

  useEffect(() => {
    setQuery(value.address);
  }, [value.address]);

  useEffect(() => {
    const q = query.trim();
    if (!token || disabled || q.length < 3) {
      setHints([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        setHints(await suggestAddresses(token, q));
      } catch {
        setHints([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(handle);
  }, [query, token, disabled]);

  const flyTo = useCallback((lat: number, lng: number, delta = DEFAULT_DELTA) => {
    skipRegion.current = true;
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta },
      280,
    );
  }, []);

  const applyCoords = useCallback(
    async (lat: number, lng: number, preferredLabel?: string, city?: string | null) => {
      const request = ++seq.current;
      try {
        const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (request !== seq.current) return;
        const place = reverse[0];
        const street = [place?.street, place?.streetNumber].filter(Boolean).join(' ').trim();
        const locality = String(place?.city || place?.subAdministrativeArea || '').trim();
        const label =
          preferredLabel ||
          [street || place?.name, locality, place?.postalCode].filter(Boolean).join(', ');
        onChange({
          address: label,
          city: city || locality || null,
          lat,
          lng,
        });
        setQuery(label);
      } catch {
        if (request !== seq.current) return;
        onChange({
          address: preferredLabel || query,
          city: city || value.city,
          lat,
          lng,
        });
      }
    },
    [onChange, query, value.city],
  );

  const selectHint = (item: Suggestion) => {
    setHints([]);
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
      lat: null,
      lng: null,
    });
    setQuery(item.label || item.address);
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

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          editable={!disabled}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            onChange({ ...value, address: text });
          }}
          placeholder="Ulica, numer, miasto…"
          placeholderTextColor={colors.secondary}
          autoCorrect={false}
          style={[
            styles.input,
            { backgroundColor: colors.input, color: colors.text, borderColor: colors.border, flex: 1 },
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

      <View style={[styles.mapWrap, { borderColor: pinReady ? colors.accent : colors.border }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          scrollEnabled={!disabled}
          zoomEnabled={!disabled}
          pitchEnabled={false}
          rotateEnabled={false}
          initialRegion={{
            latitude: mapLat,
            longitude: mapLng,
            latitudeDelta: DEFAULT_DELTA,
            longitudeDelta: DEFAULT_DELTA,
          }}
          onRegionChangeComplete={onRegionComplete}
        />
        <View style={styles.pin} pointerEvents="none">
          <View style={styles.pinHead} />
          <View style={styles.pinNeedle} />
        </View>
      </View>

      {pinReady ? (
        <View style={styles.okRow}>
          <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
          <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12, flex: 1 }}>
            Pinezka ustawiona — adres zweryfikowany na mapie
          </Text>
        </View>
      ) : (
        <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 6 }}>
          Wybierz podpowiedź albo przesuń mapę, aż pinezka wskaże nieruchomość.
        </Text>
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
    height: 196,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
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
});
