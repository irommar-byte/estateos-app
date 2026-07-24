import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated, Easing } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../../config/network';
import { resolveIsExactLocation, stripHouseNumber } from '../../constants/locationEcosystem';
import { useI18n } from '../../i18n';

const easeOut = Easing.out(Easing.cubic);

function RedNeedlePin() {
  return (
    <View style={pinStyles.wrap}>
      <View style={pinStyles.dot} />
      <View style={pinStyles.stem} />
    </View>
  );
}

function BreathingCircle() {
  const pulse = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: easeOut, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: easeOut, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        pinStyles.circle,
        {
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] }) }],
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.85] }),
        },
      ]}
    />
  );
}

export type EditOfferLocationState = {
  lat: number;
  lng: number;
  city: string;
  district: string;
  street: string;
};

type Props = {
  value: EditOfferLocationState;
  isExactLocation: boolean;
  isDark: boolean;
  token?: string | null;
  onChange: (patch: Partial<EditOfferLocationState>) => void;
};

export default function EditOfferLocationEditor({
  value,
  isExactLocation,
  isDark,
  token,
  onChange,
}: Props) {
  const { t } = useI18n();
  const mapRef = useRef<MapView>(null);
  const reverseSeq = useRef(0);
  const isProgrammaticMove = useRef(false);
  const [resolving, setResolving] = useState(false);

  const reverseGeocodePin = useCallback(
    async (lat: number, lng: number) => {
      const seq = ++reverseSeq.current;
      setResolving(true);
      try {
        const params = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
        });
        if (value.city.trim()) params.set('preferredCity', value.city.trim());
        if (value.street.trim()) params.set('streetHint', value.street.trim());

        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_URL}/api/location/reverse?${params.toString()}`, { headers });
        const data = await res.json().catch(() => ({}));
        if (seq !== reverseSeq.current) return;
        if (!res.ok) return;

        const nextStreetRaw = String(data?.street || value.street || '').trim();
        const nextStreet = isExactLocation
          ? nextStreetRaw
          : stripHouseNumber(nextStreetRaw) || nextStreetRaw;

        onChange({
          lat,
          lng,
          city: String(data?.city || value.city || '').trim(),
          district: String(data?.district || value.district || '').trim(),
          street: nextStreet,
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        onChange({ lat, lng });
      } finally {
        if (seq === reverseSeq.current) setResolving(false);
      }
    },
    [isExactLocation, onChange, token, value.city, value.district, value.street],
  );

  const handleRegionChangeComplete = useCallback(
    (region: Region, details?: { isGesture?: boolean }) => {
      if (isProgrammaticMove.current) return;
      if (details && details.isGesture === false) return;

      const lat = region.latitude;
      const lng = region.longitude;
      if (
        Math.abs(lat - value.lat) < 1e-6 &&
        Math.abs(lng - value.lng) < 1e-6
      ) {
        return;
      }

      void reverseGeocodePin(lat, lng);
    },
    [reverseGeocodePin, value.lat, value.lng],
  );

  const hasCoords = Number.isFinite(value.lat) && Number.isFinite(value.lng);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.hint, { color: isDark ? '#8E8E93' : '#636366' }]}>
        {t('offer.edit.location.mapEditHint')}
      </Text>
      {hasCoords ? (
        <View style={[styles.mapShell, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
          <MapView
            ref={mapRef}
            style={styles.map}
            userInterfaceStyle={isDark ? 'dark' : 'light'}
            scrollEnabled
            zoomEnabled
            zoomTapEnabled
            pitchEnabled={false}
            rotateEnabled={false}
            initialRegion={{
              latitude: value.lat,
              longitude: value.lng,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }}
            onRegionChangeComplete={handleRegionChangeComplete}
          />
          <View style={styles.centerPin} pointerEvents="none">
            {resolveIsExactLocation(isExactLocation) ? <RedNeedlePin /> : <BreathingCircle />}
          </View>
          {resolving ? (
            <View style={styles.resolvingBadge}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.emptyMap, { backgroundColor: isDark ? '#1C1C1E' : '#EFEFF4' }]}>
          <Ionicons name="map-outline" size={28} color="#8E8E93" />
          <Text style={styles.emptyMapText}>{t('offer.edit.location.mapNoCoords')}</Text>
        </View>
      )}
      <Text style={[styles.coordsLine, { color: isDark ? '#AEAEB2' : '#636366' }]}>
        {[value.street, value.district, value.city]
          .map((part) => String(part || '').trim())
          .filter((part) => part && !/^(inny obszar|other|inne|og[oó]lna|ogolna)$/i.test(part))
          .join(', ') || t('offer.edit.location.mapCoordsFallback')}
      </Text>
    </View>
  );
}

const pinStyles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 18 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stem: {
    width: 2,
    height: 10,
    backgroundColor: '#FF3B30',
    marginTop: -1,
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: 'rgba(52,199,89,0.95)',
    backgroundColor: 'rgba(52,199,89,0.22)',
  },
});

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  hint: { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  mapShell: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  map: { ...StyleSheet.absoluteFillObject },
  centerPin: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  resolvingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMap: {
    height: 140,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyMapText: { fontSize: 13, color: '#8E8E93' },
  coordsLine: { fontSize: 12, marginTop: 8, lineHeight: 18 },
});
