import React, { useEffect, useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LUX_SERIF, plnFormat, SENTIMENT_LABEL, sentimentOf, type LuxPalette } from './luxTheme';
import { LuxButton } from './LuxUI';
import type { LuxMatch } from './types';

type Rate = 'like' | 'maybe' | 'dislike';
const TONE: Record<Rate, string> = { like: '#2F9E6A', maybe: '#C98A1B', dislike: '#C2412D' };
const W = Dimensions.get('window').width;

/** Pełnoekranowa karta oferty: galeria, rzut, dlaczego, parametry, oceny, umówienie. */
export default function LuxOfferSheet({
  match,
  palette,
  onClose,
  isPartner,
  inCompare,
  onToggleCompare,
  onToggleFavorite,
  onRate,
  onBook,
  canBook,
  onOpenListing,
}: {
  match: LuxMatch | null;
  palette: LuxPalette;
  onClose: () => void;
  isPartner: boolean;
  inCompare: boolean;
  onToggleCompare: () => void;
  onToggleFavorite: () => void;
  onRate: (sentiment: Rate, note: string) => Promise<void>;
  onBook: () => void;
  canBook: boolean;
  onOpenListing: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Rate | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  useEffect(() => {
    setIndex(0);
    setNote('');
    setPlanOpen(false);
  }, [match?.id]);

  if (!match) return null;
  const o = match.offer;
  const photos = (o.imageUrls?.length ? o.imageUrls : o.imageUrl ? [o.imageUrl] : []).slice(0, 30);
  const own = sentimentOf(match.clientFeedback);
  const ppsm = Number(o.price) && Number(o.area) ? Math.round(Number(o.price) / Number(o.area)) : null;
  const params: Array<[string, string]> = [
    ['Metraż', o.area ? `${o.area} m²` : '—'],
    ['Pokoje', o.rooms ? String(o.rooms) : '—'],
    ['Cena za m²', ppsm ? `${ppsm.toLocaleString('pl-PL')} zł` : '—'],
    ['Piętro', o.floor != null ? `${o.floor}${o.totalFloors ? ` / ${o.totalFloors}` : ''}` : '—'],
    ['Rok budowy', o.yearBuilt ? String(o.yearBuilt) : '—'],
    ['Balkon', o.hasBalcony == null ? '—' : o.hasBalcony ? 'Tak' : 'Nie'],
    ['Parking', o.hasParking == null ? '—' : o.hasParking ? 'Tak' : 'Nie'],
    ['Winda', o.hasElevator == null ? '—' : o.hasElevator ? 'Tak' : 'Nie'],
  ];

  const rate = async (s: Rate) => {
    setBusy(s);
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await onRate(s, note.trim());
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / W))}
            >
              {photos.length ? (
                photos.map((uri) => <Image key={uri} source={{ uri }} style={{ width: W, height: W * 0.85 }} />)
              ) : (
                <View style={{ width: W, height: W * 0.6, backgroundColor: palette.cardAlt }} />
              )}
            </ScrollView>
            <View style={[styles.topBar, { top: insets.top + 8 }]}>
              <Pressable onPress={onClose} style={styles.roundBtn} hitSlop={10}>
                <Ionicons name="chevron-down" size={22} color="#fff" />
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {!isPartner ? (
                  <Pressable onPress={onToggleFavorite} style={styles.roundBtn} hitSlop={10}>
                    <Ionicons name={match.favorite ? 'heart' : 'heart-outline'} size={20} color={match.favorite ? '#E5484D' : '#fff'} />
                  </Pressable>
                ) : null}
                <Pressable onPress={onToggleCompare} style={styles.roundBtn} hitSlop={10}>
                  <Ionicons name={inCompare ? 'checkmark' : 'git-compare-outline'} size={19} color={inCompare ? '#D8C3A0' : '#fff'} />
                </Pressable>
              </View>
            </View>
            {photos.length > 1 ? (
              <View style={styles.counter}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                  {index + 1} / {photos.length}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ padding: 20 }}>
            {match.favoriteBadge ? (
              <View style={styles.badge}>
                <Text style={{ color: '#D8C3A0', fontSize: 12, fontWeight: '800' }}>{match.favoriteBadge}</Text>
              </View>
            ) : null}
            <Text style={{ fontFamily: LUX_SERIF, fontSize: 28, color: palette.ink, lineHeight: 34 }}>{o.title}</Text>
            <Text style={{ fontSize: 14, color: palette.muted, marginTop: 6 }}>{[o.street, o.district, o.city].filter(Boolean).join(', ')}</Text>
            <Text style={{ fontFamily: LUX_SERIF, fontSize: 30, color: palette.ink, marginTop: 12 }}>{plnFormat(o.price)}</Text>

            {match.clientWhy ? (
              <View style={[styles.why, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: palette.accent }}>DLACZEGO TA OFERTA</Text>
                <Text style={{ fontSize: 15, color: palette.ink, marginTop: 6, lineHeight: 21 }}>{match.clientWhy}</Text>
              </View>
            ) : null}

            <View style={[styles.params, { borderColor: palette.border }]}>
              {params.map(([label, value]) => (
                <View key={label} style={styles.param}>
                  <Text style={{ fontSize: 12, color: palette.muted }}>{label}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: palette.ink, marginTop: 2 }}>{value}</Text>
                </View>
              ))}
            </View>

            {o.floorPlanUrl ? (
              <Pressable onPress={() => setPlanOpen((v) => !v)} style={[styles.planBtn, { borderColor: palette.border }]}>
                <Ionicons name="grid-outline" size={18} color={palette.ink} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: palette.ink }}>Rzut mieszkania</Text>
                <Ionicons name={planOpen ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
              </Pressable>
            ) : null}
            {planOpen && o.floorPlanUrl ? (
              <Image source={{ uri: o.floorPlanUrl }} style={{ width: '100%', aspectRatio: 1, marginTop: 10, borderRadius: 18, backgroundColor: '#fff' }} resizeMode="contain" />
            ) : null}

            {o.description ? (
              <Text style={{ fontSize: 14, color: palette.muted, marginTop: 18, lineHeight: 21 }} numberOfLines={12}>
                {o.description}
              </Text>
            ) : null}

            {match.partnerFeedback?.length ? (
              <View style={{ marginTop: 18 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: palette.accent }}>OCENY</Text>
                {own ? <Text style={{ marginTop: 6, color: TONE[own], fontWeight: '800' }}>Ty: {SENTIMENT_LABEL[own]}</Text> : null}
                {match.partnerFeedback.map((p) => (
                  <Text key={p.companionId} style={{ marginTop: 4, color: TONE[p.sentiment], fontWeight: '700' }}>
                    {p.name}: {SENTIMENT_LABEL[p.sentiment]}
                    {p.note ? <Text style={{ color: palette.muted, fontWeight: '400' }}> — {p.note}</Text> : null}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={[styles.rateBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: palette.accent }}>
                {isPartner ? 'TWOJA OCENA' : own ? 'ZMIEŃ OCENĘ' : 'JAK CI SIĘ PODOBA?'}
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Krótka uwaga (opcjonalnie) — np. „za mała kuchnia”"
                placeholderTextColor={palette.muted}
                style={[styles.note, { color: palette.ink, borderColor: palette.border }]}
                multiline
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {(['like', 'maybe', 'dislike'] as Rate[]).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => void rate(s)}
                    style={[styles.rateBtn, { backgroundColor: own === s ? TONE[s] : `${TONE[s]}1F`, opacity: busy && busy !== s ? 0.5 : 1 }]}
                  >
                    <Text style={{ color: own === s ? '#fff' : TONE[s], fontWeight: '800', fontSize: 13, textAlign: 'center' }}>
                      {busy === s ? '…' : SENTIMENT_LABEL[s]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {canBook ? (
              <LuxButton palette={palette} label="Umów oglądanie" onPress={onBook} style={{ marginTop: 16 }} icon={<Ionicons name="calendar" size={16} color={palette.isDark ? '#000' : '#D8C3A0'} />} />
            ) : null}
            <LuxButton palette={palette} variant="ghost" label="Pełne ogłoszenie" onPress={onOpenListing} style={{ marginTop: 10 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', right: 16, bottom: 14, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#000', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 },
  why: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginTop: 18 },
  params: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  param: { width: '50%', paddingVertical: 10 },
  planBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 14 },
  rateBox: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginTop: 20 },
  note: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 15, minHeight: 56, marginTop: 10, textAlignVertical: 'top' },
  rateBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4, justifyContent: 'center' },
});
