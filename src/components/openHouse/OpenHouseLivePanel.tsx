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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useThemeStore } from '../../store/useThemeStore';
import { useOpenHouseLiveStore } from '../../store/useOpenHouseLiveStore';
import type { OpenHouseTickerItem } from '../../contracts/openHouseContract';
import { useI18n, getAppLocale } from '../../i18n';
import { resolveMediaUrl } from '../../utils/userAvatar';
import {
  formatOpenHouseLiveBroadcast,
  formatOpenHouseLiveDateLong,
  formatOpenHouseLiveDateShort,
  formatOpenHouseLiveDetail,
  formatOpenHouseLiveLocation,
} from './openHouseLiveFormat';
import LiveEventCountdown from './LiveEventCountdown';
import GreenNewsTicker from './GreenNewsTicker';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function DetailChip({
  icon,
  label,
  value,
  accent,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent: string;
  valueColor: string;
}) {
  return (
    <View style={styles.detailChip}>
      <View style={[styles.detailChipIcon, { backgroundColor: `${accent}22` }]}>
        <Ionicons name={icon} size={14} color={accent} />
      </View>
      <View style={styles.detailChipCopy}>
        <Text style={styles.detailChipLabel}>{label}</Text>
        <Text style={[styles.detailChipValue, { color: valueColor }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

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
  const text = isDark ? '#FFFFFF' : '#111827';
  const muted = isDark ? 'rgba(235,235,245,0.62)' : '#6B7280';
  const accent = '#10B981';
  const countdownMuted = isDark ? 'rgba(52,211,153,0.7)' : 'rgba(5,150,105,0.75)';
  const chipValue = isDark ? '#E5E7EB' : '#111827';

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
      const broadcast = formatOpenHouseLiveBroadcast(item, locale);
      const invite = formatOpenHouseLiveDetail(item, locale);
      const location = formatOpenHouseLiveLocation(item);
      const dateLong = formatOpenHouseLiveDateLong(item.startsAt, locale);
      const dateShort = formatOpenHouseLiveDateShort(item.startsAt, locale);
      const isMine = reservedSet.has(item.eventId);

      return (
        <Pressable
          onPress={() => openEvent(item.eventId)}
          style={({ pressed }) => [
            styles.card,
            isMine ? styles.cardPinned : null,
            pressed && { opacity: 0.94, transform: [{ scale: 0.992 }] },
          ]}
        >
          <View style={styles.cardHero}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={isMine ? 0 : 1} />
            ) : (
              <LinearGradient
                colors={['#065F46', '#047857', '#059669']}
                style={StyleSheet.absoluteFill}
              />
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            {isMine ? (
              <View style={styles.pinnedRibbon}>
                <Ionicons name="pin" size={12} color="#FFFFFF" />
                <Text style={styles.pinnedRibbonText}>{t('openHouse.live.yourReservationPinned')}</Text>
              </View>
            ) : null}
            <View style={styles.cardHeroTop}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDotPulse} />
                <Text style={styles.liveBadgeText}>
                  {isMine ? t('openHouse.event.reservedCta') : t('openHouse.live.panelLive')}
                </Text>
              </View>
              <View style={styles.spotsBadge}>
                <Ionicons name="people" size={12} color="#FFFFFF" />
                <Text style={styles.spotsBadgeText}>
                  {t('openHouse.hub.spotsLeft', { n: item.spotsLeft })}
                </Text>
              </View>
            </View>
            <View style={styles.cardHeroBody}>
              <Text style={styles.cardHeroTitle} numberOfLines={3}>
                {item.title}
              </Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={14} color="#A7F3D0" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {location}
                </Text>
              </View>
              <Text style={styles.dateShort}>{dateShort}</Text>
            </View>
          </View>

          <View style={[styles.cardDetails, { backgroundColor: isDark ? '#141416' : '#FFFFFF' }]}>
            <View style={styles.countdownGlass}>
              <Text style={[styles.countdownCaption, { color: muted }]}>
                {t('openHouse.live.panelCountdownCaption')}
              </Text>
              <LiveEventCountdown startsAt={item.startsAt} accent={accent} muted={countdownMuted} />
            </View>

            <View style={styles.chipsGrid}>
              <DetailChip
                icon="calendar"
                label={t('openHouse.live.panelWhen')}
                value={dateLong}
                accent={accent}
                valueColor={chipValue}
              />
              <DetailChip
                icon="navigate"
                label={t('openHouse.live.panelWhere')}
                value={location}
                accent="#F59E0B"
                valueColor={chipValue}
              />
              <DetailChip
                icon="ticket"
                label={t('openHouse.live.panelSpots')}
                value={t('openHouse.hub.spotsLeft', { n: item.spotsLeft })}
                accent="#6366F1"
                valueColor={chipValue}
              />
            </View>

            <Text style={[styles.inviteCopy, { color: muted }]} numberOfLines={3}>
              {invite}
            </Text>

            <View style={styles.ctaRow}>
              <View style={styles.ctaBtn}>
                <Ionicons name="time-outline" size={16} color="#FFFFFF" />
                <Text style={styles.ctaBtnText}>{t('openHouse.live.panelReserveCta')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={isDark ? '#6B7280' : '#C7C7CC'} />
            </View>
          </View>

          <GreenNewsTicker text={broadcast} />
        </Pressable>
      );
    },
    [accent, chipValue, countdownMuted, isDark, locale, muted, openEvent, reservedSet, t]
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
            backgroundColor: isDark ? 'rgba(12,12,14,0.97)' : 'rgba(242,242,247,0.98)',
          },
        ]}
      >
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.sheetTitleRow}>
              <View style={styles.sheetLiveDot} />
              <Text style={[styles.sheetTitle, { color: text }]}>{t('openHouse.live.panelTitle')}</Text>
            </View>
            <Text style={{ color: muted, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
              {t('openHouse.live.panelSubtitle')}
            </Text>
            {sortedItems.length > 0 ? (
              <Text style={styles.sheetMeta}>
                {t('openHouse.live.panelEventsCount', { n: String(sortedItems.length) })}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, isDark && styles.closeBtnDark]}>
            <Ionicons name="close" size={22} color={text} />
          </Pressable>
        </View>
        <FlatList
          data={sortedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
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
    marginTop: 40,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 12,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetLiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  sheetTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.6 },
  sheetMeta: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  closeBtnDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
  },
  cardPinned: {
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOpacity: 0.35,
  },
  cardHero: {
    minHeight: 196,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 14,
  },
  pinnedRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(5,150,105,0.92)',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  pinnedRibbonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  liveDotPulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  spotsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  spotsBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cardHeroBody: { gap: 6, paddingBottom: 4 },
  cardHeroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: {
    flex: 1,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    fontWeight: '600',
  },
  dateShort: {
    color: 'rgba(167,243,208,0.95)',
    fontSize: 13,
    fontWeight: '700',
  },
  cardDetails: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 10,
  },
  countdownGlass: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(16,185,129,0.18)',
  },
  countdownCaption: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  chipsGrid: { gap: 8 },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 2,
  },
  detailChipIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailChipCopy: { flex: 1, minWidth: 0 },
  detailChipLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  detailChipValue: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  inviteCopy: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 4,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
