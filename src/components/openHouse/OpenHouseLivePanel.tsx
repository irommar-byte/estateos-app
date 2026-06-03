import React from 'react';
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
import { useI18n, localeToDateFormat } from '../../i18n';
import { resolveMediaUrl } from '../../utils/userAvatar';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function OpenHouseLivePanel({ visible, onClose }: Props) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const items = useOpenHouseLiveStore((s) => s.items);
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';
  const card = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#111827';
  const muted = isDark ? 'rgba(235,235,245,0.6)' : '#6B7280';

  const openEvent = (eventId: number) => {
    onClose();
    navigation.navigate('OpenHouseEvent', { eventId });
  };

  const renderItem = ({ item }: { item: OpenHouseTickerItem }) => {
    const dateLabel = item.startsAt
      ? new Date(item.startsAt).toLocaleString(localeToDateFormat(locale), {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';
    const thumb = resolveMediaUrl(item.imageUrl);

    return (
      <Pressable
        onPress={() => openEvent(item.eventId)}
        style={[styles.card, { backgroundColor: card, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Ionicons name="home-outline" size={22} color="#F59E0B" />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
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
          <Text style={styles.cardMeta}>
            {dateLabel} · {t('openHouse.hub.spotsLeft', { n: item.spotsLeft })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
      </Pressable>
    );
  };

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
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
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
    backgroundColor: 'rgba(242,242,247,0.92)',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbFallback: {
    backgroundColor: 'rgba(245,158,11,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  livePillText: { fontSize: 10, fontWeight: '800', color: '#B45309', letterSpacing: 0.6 },
  cardTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  cardMeta: { fontSize: 12, fontWeight: '600', color: '#F59E0B' },
});
