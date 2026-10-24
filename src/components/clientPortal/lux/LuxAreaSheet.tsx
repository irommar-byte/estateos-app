import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, type MapPressEvent } from 'react-native-maps';
import LuxSheet from './LuxSheet';
import { LuxButton } from './LuxUI';
import { luxAction } from './luxApi';
import type { LuxPalette } from './luxTheme';

type LngLat = [number, number];

/** Obszar poszukiwań: klient stuka w mapę, punkty tworzą wielokąt. Zapis → agent akceptuje (lub od razu). */
export default function LuxAreaSheet({
  open,
  onClose,
  token,
  initial,
  criteriaEditAllowed,
  agentName,
  palette,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  initial: LngLat[] | null;
  criteriaEditAllowed: boolean;
  agentName: string;
  palette: LuxPalette;
  onSaved: () => void;
}) {
  const [points, setPoints] = useState<LngLat[]>(initial || []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setPoints(initial || []);
  }, [open, initial]);

  const start = initial?.length ? initial[0] : ([21.0122, 52.2297] as LngLat);
  const onPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPoints((prev) => [...prev, [longitude, latitude]]);
  };

  const save = async (clear = false) => {
    setBusy(true);
    try {
      const res = await luxAction<{ applied?: boolean }>(token, 'save_search_area', { polygon: clear ? null : points });
      onSaved();
      Alert.alert(
        'Obszar',
        res.applied ? 'Zapisane — nowe propozycje będą tylko z tego obszaru.' : `Wysłane — ${agentName} zatwierdzi zmianę i dopasuje propozycje.`,
      );
      onClose();
    } catch (e) {
      Alert.alert('Obszar', e instanceof Error ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LuxSheet open={open} onClose={onClose} kicker="Moje kryteria" title="Narysuj obszar na mapie" palette={palette} scroll={false}>
      <Text style={{ paddingHorizontal: 18, paddingTop: 12, fontSize: 14, color: palette.muted, lineHeight: 20 }}>
        Stukaj w mapę, żeby postawić punkty granicy (min. 3). {criteriaEditAllowed ? 'Zmiana działa od razu.' : `${agentName} zatwierdzi zmianę.`}
      </Text>
      <View style={styles.mapWrap}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: start[1], longitude: start[0], latitudeDelta: 0.12, longitudeDelta: 0.12 }}
          onPress={onPress}
        >
          {points.length >= 3 ? (
            <Polygon
              coordinates={points.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
              strokeColor="#7A5F33"
              fillColor="rgba(216,195,160,0.32)"
              strokeWidth={3}
            />
          ) : null}
          {points.map(([lng, lat], i) => (
            <Marker key={`${i}-${lng}`} coordinate={{ latitude: lat, longitude: lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.vertex} />
            </Marker>
          ))}
        </MapView>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 18 }}>
        <LuxButton palette={palette} variant="ghost" label="Cofnij" onPress={() => setPoints((p) => p.slice(0, -1))} disabled={!points.length} style={{ flex: 1 }} />
        <LuxButton palette={palette} variant="ghost" label="Wyczyść" onPress={() => setPoints([])} disabled={!points.length} style={{ flex: 1 }} />
      </View>
      <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30, gap: 8 }}>
        <LuxButton palette={palette} label={criteriaEditAllowed ? 'Zapisz obszar' : 'Wyślij do agenta'} onPress={() => void save()} busy={busy} disabled={points.length < 3} />
        {initial?.length ? <LuxButton palette={palette} variant="ghost" label="Usuń obszar (cała okolica)" onPress={() => void save(true)} /> : null}
      </View>
    </LuxSheet>
  );
}

const styles = StyleSheet.create({
  mapWrap: { flex: 1, margin: 18, borderRadius: 22, overflow: 'hidden', minHeight: 320 },
  vertex: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#000', borderWidth: 3, borderColor: '#D8C3A0' },
});
