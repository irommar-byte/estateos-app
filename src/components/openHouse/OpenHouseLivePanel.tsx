import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useThemeStore } from '../../store/useThemeStore';
import { useOpenHouseLiveStore } from '../../store/useOpenHouseLiveStore';
import type { OpenHouseTickerItem } from '../../contracts/openHouseContract';
import { useI18n, getAppLocale } from '../../i18n';
import { resolveMediaUrl } from '../../utils/userAvatar';
import {
  formatOpenHouseLiveDateShort,
  formatOpenHouseLiveDetail,
  formatOpenHouseLiveLocation,
} from './openHouseLiveFormat';
import LiveEventCountdown from './LiveEventCountdown';
import ScrollingNewsLine from './ScrollingNewsLine';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function OpenHouseLivePanel({ visible, onClose }: Props) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const locale = getAppLocale();
  const items = useOpenHouseLiveStore((s) => s.items);
  const reservedEventIds = useOpenHouseLiveStore((s) => s.reservedEventIds);
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';
  const text = isDark ? '#F3F4F6' : '#111827';
  const muted = isDark ? 'rgba(235,235,245,0.55)' : '#6B7280';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const accent = isDark ? '#9CA3AF' : '#4B5563';

  const reservedSet = useMemo(() => new Set(reservedEventIds), [reservedEventIds]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aMine = reservedSet.has(a.eventId) ? 0 : 1;
      const bMine = reservedSet.has(b.eventId) ? 0 : 1;
      return aMine - bMine;
    });
  }, [items, reservedSet]);

  const openEvent = useCallback(
    (eventId: number) => {
      onClose();
      navigation.navigate('OpenHouseEvent', { eventId });
    },
    [navigation, onClose]
  );

  const renderItem = useCallback(
    ({ item }: { item: OpenHouseTickerItem }) => {
      const thumb = resolveMediaUrl(item.imageUrl);
      const location = formatOpenHouseLiveLocation(item);
      const dateShort = formatOpenHouseLiveDateShort(item.startsAt, locale);
      const invite = formatOpenHouseLiveDetail(item, locale);
      const isMine = reservedSet.has(item.eventId);

      return (
        <Pressable
          onPress={() => openEvent(item.eventId)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: isMine ? (isDark ? '#6B7280' : '#9CA3AF') : cardBorder,
            },
            isMine && styles.cardPinned,
            pressed && { opacity: 0.88 },
          ]}
        >
          <View style={styles.cardRow}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback, isDark && styles.thumbFallbackDark]}>
                <Ionicons name="home-outline" size={16} color={muted} />
              </View>
            )}
            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <Text style={[styles.cardTitle, { color: text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {isMine ? (
                  <View style={[styles.pinBadge, isDark && styles.pinBadgeDark]}>
                    <Ionicons name="pin" size={9} color={muted} />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.metaLine, { color: muted }]} numberOfLines={1}>
                {location} · {dateShort}
              </Text>
              <View style={styles.metaRow}>
                <Text style={[styles.spotsText, { color: muted }]}>
                  {t('openHouse.hub.spotsLeft', { n: item.spotsLeft })}
                </Text>
                <LiveEventCountdown
                  startsAt={item.startsAt}
                  accent={accent}
                  muted={muted}
                  compact
                />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={14} color={muted} style={styles.chevron} />
          </View>
          <ScrollingNewsLine
            text={invite}
            textStyle={[styles.tickerText, { color: muted }]}
            height={22}
            backgroundColor={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}
            borderBottomRadius={10}
            pxPerSec={40}
          />
        </Pressable>
      );
    },
    [accent, cardBg, cardBorder, isDark, locale, muted, openEvent, reservedSet, t, text]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={isDark ? 50 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      </Pressable>
      <View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + 12,
            paddingTop: insets.top + 10,
            backgroundColor: isDark ? 'rgba(18,18,20,0.96)' : 'rgba(247,247,248,0.98)',
          },
        ]}
      >
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: text }]}>{t('openHouse.live.panelTitle')}</Text>
            <Text style={[styles.sheetSubtitle, { color: muted }]}>
              {sortedItems.length > 0
                ? t('openHouse.live.panelEventsCount', { n: String(sortedItems.length) })
                : t('openHouse.live.panelSubtitle')}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <Ionicons name="close" size={18} color={text} />
          </Pressable>
        </View>
        <FlatList
          data={sortedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
          ListEmptyComponent={
            <Text style={{ color: muted, textAlign: 'center', marginTop: 32, fontSize: 13 }}>
              {t('openHouse.hub.emptyDiscover')}
            </Text>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    flex: 1,
    marginTop: 56,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sheetSubtitle: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardPinned: {
    borderWidth: 1.5,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
  },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  thumbFallback: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFallbackDark: { backgroundColor: 'rgba(255,255,255,0.06)' },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 16 },
  pinBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBadgeDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  metaLine: { fontSize: 11, lineHeight: 14 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  spotsText: { fontSize: 10, fontWeight: '600' },
  chevron: { marginTop: 10 },
  tickerText: { fontSize: 10, fontWeight: '500' },
});
