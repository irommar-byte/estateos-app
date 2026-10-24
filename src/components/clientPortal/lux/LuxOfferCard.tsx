import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LUX_SERIF, plnFormat, SENTIMENT_LABEL, sentimentOf, type LuxPalette } from './luxTheme';
import type { LuxMatch } from './types';

const TONE: Record<string, string> = { like: '#2F9E6A', maybe: '#C98A1B', dislike: '#C2412D' };

export default function LuxOfferCard({
  match,
  palette,
  inCompare,
  onOpen,
  onToggleFavorite,
  onToggleCompare,
  canFavorite,
}: {
  match: LuxMatch;
  palette: LuxPalette;
  inCompare: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onToggleCompare: () => void;
  canFavorite: boolean;
}) {
  const o = match.offer;
  const sentiment = sentimentOf(match.clientFeedback);
  const ppsm = Number(o.price) && Number(o.area) ? Math.round(Number(o.price) / Number(o.area)) : null;
  const image = o.imageUrl || o.imageUrls?.[0] || null;
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, { backgroundColor: palette.card, borderColor: palette.border, opacity: pressed ? 0.92 : 1 }]}>
      <View>
        {image ? <Image source={{ uri: image }} style={styles.photo} /> : <View style={[styles.photo, { backgroundColor: palette.cardAlt }]} />}
        {match.favoriteBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{match.favoriteBadge}</Text>
          </View>
        ) : null}
        {canFavorite ? (
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onToggleFavorite();
            }}
            hitSlop={10}
            style={styles.heart}
          >
            <Ionicons name={match.favorite ? 'heart' : 'heart-outline'} size={20} color={match.favorite ? '#E5484D' : '#fff'} />
          </Pressable>
        ) : null}
        {o.imageUrls && o.imageUrls.length > 1 ? (
          <View style={styles.count}>
            <Ionicons name="images-outline" size={12} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{o.imageUrls.length}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 14 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: palette.ink }} numberOfLines={2}>
          {o.title}
        </Text>
        <Text style={{ fontSize: 13, color: palette.muted, marginTop: 3 }} numberOfLines={1}>
          {[o.street, o.district, o.city].filter(Boolean).join(', ')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <Text style={{ fontFamily: LUX_SERIF, fontSize: 22, color: palette.ink }}>{plnFormat(o.price)}</Text>
          <Text style={{ fontSize: 12, color: palette.muted }}>
            {[o.area ? `${o.area} m²` : null, o.rooms ? `${o.rooms} pok.` : null, ppsm ? `${ppsm.toLocaleString('pl-PL')} zł/m²` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {match.clientWhy ? (
          <Text style={{ fontSize: 13, color: palette.muted, marginTop: 8, lineHeight: 18 }} numberOfLines={3}>
            {match.clientWhy}
          </Text>
        ) : null}
        <View style={styles.footer}>
          {sentiment ? (
            <View style={[styles.sentiment, { backgroundColor: `${TONE[sentiment]}1F` }]}>
              <Text style={{ color: TONE[sentiment], fontSize: 12, fontWeight: '800' }}>{SENTIMENT_LABEL[sentiment]}</Text>
            </View>
          ) : (
            <Text style={{ color: palette.accent, fontSize: 13, fontWeight: '800' }}>Oceń ofertę →</Text>
          )}
          <View style={{ flex: 1 }} />
          <Pressable onPress={onToggleCompare} hitSlop={8} style={[styles.compare, { borderColor: inCompare ? palette.accent : palette.border, backgroundColor: inCompare ? `${palette.accent}22` : 'transparent' }]}>
            <Ionicons name={inCompare ? 'checkmark' : 'git-compare-outline'} size={13} color={inCompare ? palette.accent : palette.muted} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: inCompare ? palette.accent : palette.muted }}>Porównaj</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 14 },
  photo: { width: '100%', aspectRatio: 1.45 },
  badge: { position: 'absolute', left: 12, top: 12, backgroundColor: '#000', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: '#D8C3A0', fontSize: 11, fontWeight: '800' },
  heart: { position: 'absolute', right: 12, top: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  count: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  sentiment: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  compare: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
});
