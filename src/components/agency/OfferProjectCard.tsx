import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

type Colors = {
  card: string;
  text: string;
  secondary: string;
  border: string;
  input: string;
};

function formatAcquired(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

export default function OfferProjectCard({
  title,
  offerId,
  acquiredAt,
  statusLabel,
  statusColor,
  eventStageLabel,
  eventStageColor,
  coverUrl,
  emptyHint,
  kicker = 'Oferta',
  placeholderIcon = 'home-outline',
  colors,
  isDark,
  onPress,
}: {
  title: string;
  offerId?: number | null;
  acquiredAt?: string | null;
  statusLabel?: string | null;
  statusColor?: string;
  eventStageLabel?: string | null;
  eventStageColor?: string;
  coverUrl?: string | null;
  emptyHint?: string | null;
  kicker?: string;
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
  colors: Colors;
  isDark: boolean;
  onPress?: () => void;
}) {
  const acquired = formatAcquired(acquiredAt);
  const clickable = Boolean(onPress && offerId);

  return (
    <Pressable
      disabled={!clickable}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.4 : 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        },
      ]}
    >
      <Text style={[styles.kicker, { color: colors.secondary }]}>{kicker}</Text>
      <View style={[styles.photoWrap, { backgroundColor: colors.input }]}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.photo} contentFit="cover" recyclingKey={`offer-card-${offerId || title}`} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name={placeholderIcon} size={36} color={colors.secondary} />
          </View>
        )}
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
        {title}
      </Text>
      <View style={styles.meta}>
        {offerId ? (
          <Text style={[styles.metaText, { color: colors.secondary }]}>ID {offerId}</Text>
        ) : (
          <Text style={[styles.metaText, { color: colors.secondary }]}>Szkic w przygotowaniu</Text>
        )}
        {acquired ? (
          <Text style={[styles.metaText, { color: colors.secondary }]}>Pozyskana {acquired}</Text>
        ) : null}
      </View>
      <View style={styles.badges}>
        {statusLabel ? (
          <View style={[styles.badge, { backgroundColor: `${statusColor || '#34C759'}22` }]}>
            <Text style={[styles.badgeText, { color: statusColor || '#34C759' }]}>{statusLabel.toUpperCase()}</Text>
          </View>
        ) : null}
        {eventStageLabel ? (
          <View style={[styles.badge, { backgroundColor: `${eventStageColor || '#FF9500'}22` }]}>
            <Text style={[styles.badgeText, { color: eventStageColor || '#FF9500' }]}>
              {eventStageLabel.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>
      {emptyHint && !offerId ? (
        <Text style={[styles.hint, { color: colors.secondary }]}>{emptyHint}</Text>
      ) : null}
      {clickable ? (
        <View style={styles.previewRow}>
          <Text style={styles.previewText}>Otwórz podgląd ogłoszenia</Text>
          <Ionicons name="chevron-forward" size={16} color="#007AFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  photoWrap: {
    marginTop: 12,
    width: 168,
    height: 168,
    borderRadius: 22,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: 24,
  },
  meta: {
    marginTop: 8,
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badges: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  previewRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
