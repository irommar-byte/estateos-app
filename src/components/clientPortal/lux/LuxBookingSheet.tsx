import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import LuxSheet from './LuxSheet';
import { LuxButton, LuxChip, LuxField } from './LuxUI';
import { luxAction } from './luxApi';
import type { LuxPalette } from './luxTheme';

type Slot = { startsAt: string; label: string; day: string };
export type BookingOffer = { offerId: number; title: string };

/** Samodzielne umawianie: wolne godziny agenta → propozycja terminu (agent potwierdza). */
export default function LuxBookingSheet({
  open,
  onClose,
  token,
  offers,
  initialOfferId,
  agentName,
  palette,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  offers: BookingOffer[];
  initialOfferId?: number | null;
  agentName: string;
  palette: LuxPalette;
  onBooked: () => void;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [offerId, setOfferId] = useState<number>(initialOfferId || offers[0]?.offerId || 0);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setOfferId(initialOfferId || offers[0]?.offerId || 0);
    setPicked(null);
    setDone(null);
    setSlots(null);
    void luxAction<{ enabled?: boolean; slots?: Slot[] }>(token, 'list_free_slots')
      .then((res) => {
        setEnabled(res.enabled !== false);
        setSlots(res.slots || []);
      })
      .catch(() => setSlots([]));
  }, [open, token, initialOfferId, offers]);

  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots || []) map.set(s.day, [...(map.get(s.day) || []), s]);
    return [...map.entries()].slice(0, 7);
  }, [slots]);

  const book = async () => {
    if (!picked || !offerId) return;
    setBusy(true);
    try {
      const res = await luxAction<{ booking?: { label: string } }>(token, 'request_booking', { offerId, startsAt: picked, note });
      setDone(res.booking?.label || 'Termin wysłany');
      onBooked();
    } catch (e) {
      Alert.alert('Termin', e instanceof Error ? e.message : 'Nie udało się.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LuxSheet open={open} onClose={onClose} kicker="Oglądanie" title={`Wolne terminy ${agentName}`} palette={palette}>
      {done ? (
        <View>
          <Text style={{ fontSize: 17, fontWeight: '800', color: palette.ink }}>Gotowe — {done}</Text>
          <Text style={{ fontSize: 15, color: palette.muted, marginTop: 8, lineHeight: 21 }}>
            {agentName} potwierdzi termin — dostaniesz powiadomienie. Dzień wcześniej przypomnimy o oglądaniu.
          </Text>
          <LuxButton palette={palette} label="Zamknij" onPress={onClose} style={{ marginTop: 18 }} />
        </View>
      ) : !enabled ? (
        <Text style={{ fontSize: 15, color: palette.muted }}>Terminy ustala {agentName} — napisz w rozmowie, kiedy Ci pasuje.</Text>
      ) : slots == null ? (
        <ActivityIndicator color={palette.accent} />
      ) : (
        <>
          {offers.length > 1 ? (
            <>
              <Text style={styles.label}>Którą ofertę?</Text>
              <View style={styles.wrap}>
                {offers.map((o) => (
                  <LuxChip key={o.offerId} palette={palette} label={o.title.slice(0, 40)} on={offerId === o.offerId} onPress={() => setOfferId(o.offerId)} />
                ))}
              </View>
            </>
          ) : null}
          {days.length === 0 ? <Text style={{ color: palette.muted, marginTop: 12 }}>Brak wolnych terminów w najbliższych dniach — napisz w rozmowie.</Text> : null}
          {days.map(([day, list]) => (
            <View key={day} style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: palette.ink, textTransform: 'capitalize' }}>{day}</Text>
              <View style={[styles.wrap, { marginTop: 8 }]}>
                {list.map((s) => (
                  <Pressable
                    key={s.startsAt}
                    onPress={() => setPicked(s.startsAt)}
                    style={[styles.slot, { borderColor: picked === s.startsAt ? palette.accent : palette.border, backgroundColor: picked === s.startsAt ? (palette.isDark ? palette.gold : '#000') : palette.card }]}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '800', color: picked === s.startsAt ? (palette.isDark ? '#000' : '#D8C3A0') : palette.ink }}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <LuxField palette={palette} label="Uwagi (opcjonalnie)" value={note} onChangeText={setNote} placeholder="np. będę z partnerem, wolę po 17" />
          <LuxButton palette={palette} label="Wyślij termin do potwierdzenia" onPress={() => void book()} busy={busy} disabled={!picked} style={{ marginTop: 18 }} />
        </>
      )}
    </LuxSheet>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: '#8C877D', marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 },
});
