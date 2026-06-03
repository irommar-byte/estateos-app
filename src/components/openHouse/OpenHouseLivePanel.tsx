import React, { useCallback } from 'react';
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
import { formatOpenHouseLiveBroadcast } from './openHouseLiveFormat';
import LiveEventCountdown from './LiveEventCountdown';
import GreenNewsTicker from './GreenNewsTicker';

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
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';
  const card = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#111827';
  const muted = isDark ? 'rgba(235,235,245,0.6)' : '#6B7280';
  const countdownAccent = '#10B981';
  const countdownMuted = isDark ? 'rgba(52,211,153,0.7)' : 'rgba(5,150,105,0.75)';

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
      const broadcast = formatOpenHouseLiveBroadcast(item, locale);

      return (
        <Pressable
          onPress={() => openEvent(item.eventId)}
          style={[
            styles.card,
            {
              backgroundColor: card,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          <View style={styles.cardTop}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <Ionicons name="home-outline" size={22} color="#10B981" />
              </View>
            )}
            <View style={styles.cardBody}>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>{t('openHouse.live.panelLive')}</Text>
              </View>
              <Text style={[styles.cardTitle, { color: text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={{ color: muted, fontSize: 13 }}>
                {item.city}
                {item.district ? ` · ${item.district}` : ''}
              </Text>
              <Text style={styles.spotsMeta}>
                {t('openHouse.hub.spotsLeft', { n: item.spotsLeft })}
              </Text>
              <LiveEventCountdown
                startsAt={item.startsAt}
                accent={countdownAccent}
                muted={countdownMuted}
              />
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" style={styles.chevron} />
          </View>
          <GreenNewsTicker text={broadcast} />
        </Pressable>
      );
    },
    [card, countdownAccent, countdownMuted, isDark, locale, muted, openEvent, t, text]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={isDark ? 55 : 65} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      </Pressable>
      <View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + 16,
            paddingTop: insets.top + 12,
            backgroundColor: isDark ? 'rgba(18,18,20,0.94)' : 'rgba(242,242,247,0.96)',
          },
        ]}
      >
        <View style={styles.sheetHeader}>
          <View>
            <Text style={[styles.sheetTitle, { color: text }]}>{t('openHouse.live.panelTitle')}</Text>
            <Text style={{ color: muted, fontSize: 13, marginTop: 4 }}>{t('openHouse.live.panelSubtitle')}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={text} />
          </Pressable>
        </View>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={{ color: muted, textAlign: 'center', marginTop: 40 }}>
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
    marginTop: 48,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    paddingBottom: 10,
  },
  thumb: { width: 80, height: 80, borderRadius: 12 },
  thumbFallback: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  chevron: { marginTop: 28 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,185,129,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 2,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  livePillText: { fontSize: 10, fontWeight: '800', color: '#047857', letterSpacing: 0.6 },
  cardTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  spotsMeta: { fontSize: 12, fontWeight: '700', color: '#10B981', marginTop: 2 },
});
