import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import LuxSheet from './LuxSheet';
import { plnFormat, SENTIMENT_LABEL, sentimentOf, type LuxPalette } from './luxTheme';
import type { LuxMatch } from './types';

type Row = { label: string; values: string[]; best?: number | null };

function bestIndex(values: Array<number | null>, lowest: boolean): number | null {
  let best: number | null = null;
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) return;
    if (best == null || (lowest ? v < (values[best] as number) : v > (values[best] as number))) best = i;
  });
  const filled = values.filter((v) => v != null).length;
  return filled >= 2 ? best : null;
}
const yesNo = (v: boolean | null | undefined) => (v == null ? '—' : v ? 'Tak' : 'Nie');

/** Porównywarka: parametry, wizualnie (zdjęcia obok siebie) i mapa z pinezkami ze zdjęciem. */
export default function LuxCompareSheet({
  open,
  onClose,
  matches,
  palette,
  onOpenOffer,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  matches: LuxMatch[];
  palette: LuxPalette;
  onOpenOffer: (m: LuxMatch) => void;
  onRemove: (id: number) => void;
}) {
  const [tab, setTab] = useState<'params' | 'visual' | 'map'>('params');
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [selected, setSelected] = useState(0);

  const rows: Row[] = useMemo(() => {
    const o = matches.map((m) => m.offer);
    const ppsm = o.map((x) => (Number(x.price) && Number(x.area) ? Math.round(Number(x.price) / Number(x.area)) : null));
    const out: Row[] = [
      { label: 'Cena', values: o.map((x) => plnFormat(x.price)), best: bestIndex(o.map((x) => Number(x.price) || null), true) },
      { label: 'Cena za m²', values: ppsm.map((v) => (v ? `${v.toLocaleString('pl-PL')} zł` : '—')), best: bestIndex(ppsm, true) },
      { label: 'Metraż', values: o.map((x) => (x.area ? `${x.area} m²` : '—')), best: bestIndex(o.map((x) => Number(x.area) || null), false) },
      { label: 'Pokoje', values: o.map((x) => (x.rooms ? String(x.rooms) : '—')), best: bestIndex(o.map((x) => x.rooms ?? null), false) },
      { label: 'Piętro', values: o.map((x) => (x.floor != null ? `${x.floor}${x.totalFloors ? ` / ${x.totalFloors}` : ''}` : '—')) },
      { label: 'Rok budowy', values: o.map((x) => (x.yearBuilt ? String(x.yearBuilt) : '—')), best: bestIndex(o.map((x) => x.yearBuilt ?? null), false) },
      { label: 'Balkon', values: o.map((x) => yesNo(x.hasBalcony)) },
      { label: 'Parking', values: o.map((x) => yesNo(x.hasParking)) },
      { label: 'Winda', values: o.map((x) => yesNo(x.hasElevator)) },
      { label: 'Lokalizacja', values: o.map((x) => [x.district, x.city].filter(Boolean).join(', ') || '—') },
      { label: 'Twoja ocena', values: matches.map((m) => (sentimentOf(m.clientFeedback) ? SENTIMENT_LABEL[sentimentOf(m.clientFeedback) as string] : '—')) },
    ];
    const partnerNames = [...new Set(matches.flatMap((m) => (m.partnerFeedback || []).map((p) => p.name)))];
    for (const name of partnerNames) {
      out.push({
        label: `Ocena: ${name}`,
        values: matches.map((m) => {
          const f = (m.partnerFeedback || []).find((p) => p.name === name);
          return f ? SENTIMENT_LABEL[f.sentiment] : '—';
        }),
      });
    }
    return out;
  }, [matches]);

  const visibleRows = onlyDiff ? rows.filter((r) => new Set(r.values).size > 1 || r.label.startsWith('Ocena') || r.label === 'Twoja ocena') : rows;
  const pins = matches.filter((m) => Number.isFinite(Number(m.offer.lat)) && Number.isFinite(Number(m.offer.lng)) && m.offer.lat && m.offer.lng);
  const region = useMemo(() => {
    if (!pins.length) return { latitude: 52.2297, longitude: 21.0122, latitudeDelta: 0.2, longitudeDelta: 0.2 };
    const lats = pins.map((m) => Number(m.offer.lat));
    const lngs = pins.map((m) => Number(m.offer.lng));
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.6),
      longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.6),
    };
  }, [pins]);
  const colW = matches.length <= 2 ? 150 : 128;

  return (
    <LuxSheet open={open} onClose={onClose} kicker="Porównanie" title={`${matches.length} ${matches.length === 1 ? 'oferta' : 'oferty'} obok siebie`} palette={palette} scroll={false}>
      <View style={[styles.tabs, { backgroundColor: palette.cardAlt }]}>
        {(
          [
            ['params', 'Parametry'],
            ['visual', 'Wizualnie'],
            ['map', 'Mapa'],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && { backgroundColor: palette.isDark ? palette.gold : '#000' }]}>
            <Text style={{ fontWeight: '800', fontSize: 14, color: tab === id ? (palette.isDark ? '#000' : '#D8C3A0') : palette.muted }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {matches.length < 2 ? (
        <Text style={{ padding: 20, color: palette.muted, fontSize: 15 }}>Zaznacz „Porównaj” przy co najmniej dwóch ofertach.</Text>
      ) : tab === 'params' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Pressable onPress={() => setOnlyDiff((v) => !v)} style={styles.diffToggle}>
            <Ionicons name={onlyDiff ? 'checkbox' : 'square-outline'} size={18} color={palette.accent} />
            <Text style={{ color: palette.ink, fontSize: 14 }}>Pokaż tylko różnice</Text>
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={{ flexDirection: 'row', paddingLeft: 110 }}>
                {matches.map((m) => (
                  <Pressable key={m.id} onPress={() => onOpenOffer(m)} style={{ width: colW, padding: 6 }}>
                    {m.offer.imageUrl ? <Image source={{ uri: m.offer.imageUrl }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: palette.cardAlt }]} />}
                    <Text style={{ fontSize: 13, fontWeight: '800', color: palette.ink, marginTop: 6 }} numberOfLines={2}>
                      {m.offer.title}
                    </Text>
                    <Pressable onPress={() => onRemove(m.id)} hitSlop={8}>
                      <Text style={{ fontSize: 12, color: palette.muted, marginTop: 4 }}>Usuń</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </View>
              {visibleRows.map((row, ri) => (
                <View key={row.label} style={[styles.row, { backgroundColor: ri % 2 ? 'transparent' : palette.cardAlt }]}>
                  <Text style={{ width: 110, paddingLeft: 16, fontSize: 12, fontWeight: '700', color: palette.muted }}>{row.label}</Text>
                  {row.values.map((v, i) => (
                    <Text
                      key={i}
                      style={{ width: colW, paddingHorizontal: 6, fontSize: 14, fontWeight: row.best === i ? '800' : '600', color: row.best === i ? palette.good : palette.ink }}
                    >
                      {v}
                      {row.best === i ? ' ✓' : ''}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      ) : tab === 'visual' ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 18 }}>
          {matches.map((m) => (
            <Pressable key={m.id} onPress={() => onOpenOffer(m)}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: palette.ink, marginBottom: 8 }}>
                {m.offer.title} · {plnFormat(m.offer.price)}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {(m.offer.imageUrls?.length ? m.offer.imageUrls : m.offer.imageUrl ? [m.offer.imageUrl] : []).slice(0, 8).map((uri) => (
                  <Image key={uri} source={{ uri }} style={{ width: 220, height: 150, borderRadius: 16 }} />
                ))}
                {m.offer.floorPlanUrl ? <Image source={{ uri: m.offer.floorPlanUrl }} style={{ width: 150, height: 150, borderRadius: 16, backgroundColor: '#fff' }} resizeMode="contain" /> : null}
              </ScrollView>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {pins.length ? (
            <MapView style={{ flex: 1 }} initialRegion={region}>
              {pins.map((m, i) => (
                <Marker
                  key={m.id}
                  coordinate={{ latitude: Number(m.offer.lat), longitude: Number(m.offer.lng) }}
                  onPress={() => setSelected(matches.indexOf(m))}
                  tracksViewChanges={false}
                >
                  <View style={[styles.pin, { borderColor: matches.indexOf(m) === selected ? '#D8C3A0' : '#fff', transform: [{ scale: matches.indexOf(m) === selected ? 1.15 : 1 }] }]}>
                    {m.offer.imageUrl ? <Image source={{ uri: m.offer.imageUrl }} style={styles.pinPhoto} /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{i + 1}</Text>}
                  </View>
                  <View style={styles.pinTail} />
                </Marker>
              ))}
            </MapView>
          ) : (
            <Text style={{ padding: 20, color: palette.muted }}>Te oferty nie mają jeszcze punktu na mapie.</Text>
          )}
          {matches[selected] ? (
            <Pressable onPress={() => onOpenOffer(matches[selected])} style={[styles.mapCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {matches[selected].offer.imageUrl ? <Image source={{ uri: matches[selected].offer.imageUrl as string }} style={{ width: 64, height: 64, borderRadius: 12 }} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: palette.ink }} numberOfLines={1}>
                  {matches[selected].offer.title}
                </Text>
                <Text style={{ color: palette.muted, fontSize: 13, marginTop: 2 }}>{plnFormat(matches[selected].offer.price)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.muted} />
            </Pressable>
          ) : null}
        </View>
      )}
    </LuxSheet>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', margin: 16, borderRadius: 999, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999 },
  diffToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  thumb: { width: '100%', aspectRatio: 1.3, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  pin: { width: 54, height: 54, borderRadius: 27, borderWidth: 3, backgroundColor: '#000', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pinPhoto: { width: 54, height: 54 },
  pinTail: { alignSelf: 'center', width: 10, height: 10, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], marginTop: -6 },
  mapCard: { position: 'absolute', left: 16, right: 16, bottom: 30, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
});
