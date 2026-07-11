import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../i18n';

export type ProPhotoSessionExampleId = 'warsaw' | 'berlin' | 'kyiv';

type ExampleConfig = {
  id: ProPhotoSessionExampleId;
  imageUri: string;
  flag: string;
  accent: string;
};

const EXAMPLES: ExampleConfig[] = [
  {
    id: 'warsaw',
    imageUri: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1200&auto=format&fit=crop',
    flag: '🇵🇱',
    accent: '#10b981',
  },
  {
    id: 'berlin',
    imageUri: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1200&auto=format&fit=crop',
    flag: '🇩🇪',
    accent: '#0ea5e9',
  },
  {
    id: 'kyiv',
    imageUri: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop',
    flag: '🇺🇦',
    accent: '#f59e0b',
  },
];

type Props = {
  borderColor: string;
  textColor: string;
  subtitleColor: string;
  isDark: boolean;
  onSelectSample?: (id: ProPhotoSessionExampleId) => void;
};

function ExampleCard({ config, borderColor, textColor, subtitleColor, isDark, onSelectSample }: Props & { config: ExampleConfig }) {
  const { t } = useI18n();
  const base = `addOffer.step5.proSession.examples.${config.id}`;
  const badges = [
    t(`${base}.badge1`),
    t(`${base}.badge2`),
    t(`${base}.badge3`),
  ];

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelectSample?.(config.id);
      }}
      style={({ pressed }) => [styles.card, { borderColor, backgroundColor: isDark ? '#141418' : '#fff' }, pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }]}
    >
      <View style={styles.imageWrap}>
        <Image source={{ uri: config.imageUri }} style={styles.image} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.72)']}
          style={styles.imageGradient}
        />
        <View style={styles.studioPill}>
          <Ionicons name="camera" size={11} color="#fff" />
          <Text style={styles.studioPillText}>{t('addOffer.step5.proSession.examples.studioBadge')}</Text>
        </View>
        <View style={styles.countryPill}>
          <Text style={styles.countryFlag}>{config.flag}</Text>
          <Text style={styles.countryText}>{t(`${base}.country`)}</Text>
        </View>
        <View style={[styles.priceOnImage, { backgroundColor: config.accent }]}>
          <Text style={styles.priceOnImageText}>{t(`${base}.price`)}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
          {t(`${base}.title`)}
        </Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={subtitleColor} />
          <Text style={[styles.location, { color: subtitleColor }]} numberOfLines={1}>
            {t(`${base}.location`)}
          </Text>
        </View>

        <View style={styles.specsRow}>
          <View style={styles.specItem}>
            <Ionicons name="resize-outline" size={12} color={config.accent} />
            <Text style={[styles.specText, { color: textColor }]}>{t(`${base}.area`)}</Text>
          </View>
          <View style={styles.specDot} />
          <View style={styles.specItem}>
            <Ionicons name="bed-outline" size={12} color={config.accent} />
            <Text style={[styles.specText, { color: textColor }]}>{t(`${base}.rooms`)}</Text>
          </View>
          <View style={styles.specDot} />
          <Text style={[styles.txType, { color: config.accent }]}>{t(`${base}.transaction`)}</Text>
        </View>

        <Text style={[styles.teaser, { color: subtitleColor }]} numberOfLines={2}>
          {t(`${base}.teaser`)}
        </Text>

        <View style={styles.badgesRow}>
          {badges.map((badge) => (
            <View
              key={badge}
              style={[
                styles.badge,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: textColor }]} numberOfLines={1}>
                {badge}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.viewOfferRow}>
          <Text style={[styles.viewOfferText, { color: config.accent }]}>{t('addOffer.step5.proSession.examples.viewOffer')}</Text>
          <Ionicons name="arrow-forward-circle" size={16} color={config.accent} />
        </View>
      </View>
    </Pressable>
  );
}

export default function ProPhotoSessionExamples({
  borderColor,
  textColor,
  subtitleColor,
  isDark,
  onSelectSample,
}: Props) {
  return (
    <View style={styles.row}>
      {EXAMPLES.map((config) => (
        <ExampleCard
          key={config.id}
          config={config}
          borderColor={borderColor}
          textColor={textColor}
          subtitleColor={subtitleColor}
          isDark={isDark}
          onSelectSample={onSelectSample}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingBottom: 14 },
  card: {
    width: 248,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  imageWrap: { width: '100%', height: 148, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageGradient: { ...StyleSheet.absoluteFillObject },
  studioPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  studioPillText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  countryPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  countryFlag: { fontSize: 12 },
  countryText: { color: '#111', fontSize: 10, fontWeight: '800' },
  priceOnImage: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  priceOnImageText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: -0.3 },
  body: { padding: 12, gap: 7 },
  title: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, lineHeight: 19 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { flex: 1, fontSize: 11, fontWeight: '600' },
  specsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  specText: { fontSize: 11, fontWeight: '700' },
  specDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.55)' },
  txType: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  teaser: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  badgeText: { fontSize: 9, fontWeight: '700' },
  viewOfferRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  viewOfferText: { fontSize: 11, fontWeight: '800' },
});
