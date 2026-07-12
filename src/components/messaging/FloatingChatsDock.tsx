import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MessageCircle, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { navigationRef } from '../../../navigationRef';
import { navigateToContactChat } from '../../utils/navigateToContactChat';
import { useFloatingChatsStore } from '../../store/useFloatingChatsStore';
import { useFloatingChatsLayoutStore } from '../../store/useFloatingChatsLayoutStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useI18n } from '../../i18n';
import ContactPeerAvatar from './ContactPeerAvatar';

const BUBBLE_SIZE = 52;
const DOCK_SPRING = { damping: 22, stiffness: 320, mass: 0.82 };
const POPUP_SPRING = { damping: 24, stiffness: 340, mass: 0.78 };

function ChatRows({
  entries,
  isDark,
  onOpen,
  onRemove,
}: {
  entries: ReturnType<typeof useFloatingChatsStore.getState>['entries'];
  isDark: boolean;
  onOpen: (entry: (typeof entries)[number]) => void;
  onRemove: (threadId: number) => void;
}) {
  const nameColor = isDark ? '#fff' : '#111';
  const previewColor = isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.55)';
  const closeColor = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(60,60,67,0.55)';

  return (
    <View style={styles.list}>
      {entries.map((entry) => (
        <View key={entry.threadId} style={styles.row}>
          <Pressable style={styles.rowMain} onPress={() => onOpen(entry)}>
            <ContactPeerAvatar
              name={entry.peerName}
              peer={{ name: entry.peerName, image: entry.peerImage }}
              size={34}
              isDark={isDark}
            />
            <View style={styles.rowText}>
              <Text style={[styles.rowName, { color: nameColor }]} numberOfLines={1}>
                {entry.peerName}
              </Text>
              {entry.lastPreview ? (
                <Text style={[styles.rowPreview, { color: previewColor }]} numberOfLines={1}>
                  {entry.lastPreview}
                </Text>
              ) : null}
            </View>
            {(entry.unread ?? 0) > 0 ? (
              <View style={styles.unread}>
                <Text style={styles.unreadText}>{entry.unread! > 9 ? '9+' : entry.unread}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable hitSlop={8} onPress={() => onRemove(entry.threadId)} style={styles.closeBtn}>
            <X size={14} color={closeColor} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export default function FloatingChatsDock() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const entries = useFloatingChatsStore((s) => s.entries);
  const minimized = useFloatingChatsStore((s) => s.minimized);
  const dockSuppressed = useFloatingChatsStore((s) => s.dockSuppressed);
  const setMinimized = useFloatingChatsStore((s) => s.setMinimized);
  const removeThread = useFloatingChatsStore((s) => s.removeThread);
  const anchor = useFloatingChatsLayoutStore((s) => s.anchor);

  const dockVisible = entries.length > 0 && !dockSuppressed;
  const totalUnread = entries.reduce((acc, e) => acc + (e.unread ?? 0), 0);
  const expanded = !minimized;
  const isRadarFilter = anchor.mode === 'radarFilter';

  const themeStyles = useMemo(
    () => ({
      bubbleBg: isDark ? 'rgba(22,22,24,0.92)' : 'rgba(255,255,255,0.94)',
      bubbleBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
      bubbleTint: isDark ? ('dark' as const) : ('light' as const),
      bubbleIntensity: isDark ? 88 : 72,
      popupBg: isDark ? 'rgba(18,18,20,0.88)' : 'rgba(255,255,255,0.94)',
      popupBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
      popupTitle: isDark ? '#fff' : '#111',
      popupClose: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(60,60,67,0.65)',
      badgeBorder: isDark ? 'rgba(22,22,24,0.95)' : 'rgba(255,255,255,0.98)',
      iconColor: '#34C759',
    }),
    [isDark],
  );

  const dockProgress = useSharedValue(dockVisible ? 1 : 0);
  const popupProgress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    dockProgress.value = withSpring(dockVisible ? 1 : 0, DOCK_SPRING);
  }, [dockVisible, dockProgress]);

  useEffect(() => {
    if (!dockVisible) {
      popupProgress.value = 0;
      return;
    }
    popupProgress.value = withSpring(expanded ? 1 : 0, POPUP_SPRING);
  }, [dockVisible, expanded, popupProgress]);

  const dockAnimStyle = useAnimatedStyle(() => {
    const p = dockProgress.value;
    const slide = isRadarFilter ? -14 * (1 - p) : 18 * (1 - p);
    return {
      opacity: p,
      transform: [{ scale: 0.84 + p * 0.16 }, { translateY: slide }],
    };
  });

  const popupAnimStyle = useAnimatedStyle(() => {
    const p = popupProgress.value;
    const originY = isRadarFilter ? -8 : 10;
    return {
      opacity: p,
      transform: [
        { scale: 0.92 + p * 0.08 },
        { translateY: originY * (1 - p) },
      ],
      maxHeight: p < 0.02 ? 0 : 9999,
      marginTop: isRadarFilter ? 10 * p : 0,
      marginBottom: isRadarFilter ? 0 : 12 * p,
      overflow: 'hidden' as const,
    };
  });

  const badgeAnimStyle = useAnimatedStyle(() => ({
    opacity: dockProgress.value,
    transform: [{ scale: 0.6 + dockProgress.value * 0.4 }],
  }));

  if (!entries.length && !dockSuppressed) return null;

  const wrapStyle = isRadarFilter
    ? { top: anchor.top, right: anchor.right }
    : { bottom: Math.max(insets.bottom, 10) + 62, right: 16 };

  const openEntry = (entry: (typeof entries)[number]) => {
    Haptics.selectionAsync();
    setMinimized(true);
    navigateToContactChat(navigationRef, {
      threadId: entry.threadId,
      peerUserId: entry.peerUserId,
      peerName: entry.peerName,
    });
  };

  const bubble = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('contact.floating.title')}
      onPress={() => {
        Haptics.selectionAsync();
        if (expanded) {
          setMinimized(true);
          return;
        }
        if (entries.length === 1) {
          openEntry(entries[0]);
          return;
        }
        setMinimized(false);
      }}
      style={({ pressed }) => [styles.bubblePressable, pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] }]}
    >
      <BlurView
        intensity={themeStyles.bubbleIntensity}
        tint={themeStyles.bubbleTint}
        style={[
          styles.bubble,
          {
            borderColor: themeStyles.bubbleBorder,
            backgroundColor: themeStyles.bubbleBg,
          },
        ]}
      >
        <MessageCircle size={24} color={themeStyles.iconColor} strokeWidth={2.2} />
      </BlurView>
      {totalUnread > 0 ? (
        <Animated.View style={[styles.bubbleBadge, { borderColor: themeStyles.badgeBorder }, badgeAnimStyle]}>
          <Text style={styles.bubbleBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
        </Animated.View>
      ) : null}
    </Pressable>
  );

  const popup = (
    <BlurView
      intensity={isDark ? 78 : 68}
      tint={themeStyles.bubbleTint}
      style={[
        styles.popup,
        {
          borderColor: themeStyles.popupBorder,
          backgroundColor: themeStyles.popupBg,
        },
      ]}
    >
      <View style={styles.popupHeader}>
        <Text style={[styles.popupTitle, { color: themeStyles.popupTitle }]}>{t('contact.floating.title')}</Text>
        <Pressable
          hitSlop={10}
          onPress={() => {
            Haptics.selectionAsync();
            setMinimized(true);
          }}
          style={styles.popupClose}
        >
          <X size={16} color={themeStyles.popupClose} />
        </Pressable>
      </View>
      <ChatRows
        entries={entries}
        isDark={isDark}
        onOpen={openEntry}
        onRemove={(threadId) => {
          Haptics.selectionAsync();
          removeThread(threadId);
        }}
      />
    </BlurView>
  );

  return (
    <Animated.View
      pointerEvents={dockVisible ? 'box-none' : 'none'}
      style={[styles.anchor, wrapStyle, dockAnimStyle]}
    >
      {isRadarFilter ? (
        <>
          {bubble}
          {expanded ? <Animated.View style={popupAnimStyle}>{popup}</Animated.View> : null}
        </>
      ) : (
        <>
          {expanded ? <Animated.View style={popupAnimStyle}>{popup}</Animated.View> : null}
          {bubble}
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    zIndex: 90,
    elevation: 90,
    alignItems: 'flex-end',
  },
  popup: {
    width: 288,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  popupTitle: {
    fontWeight: '700',
    fontSize: 13,
  },
  popupClose: {
    padding: 4,
  },
  list: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontWeight: '700', fontSize: 14 },
  rowPreview: { fontSize: 12, marginTop: 2 },
  unread: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  closeBtn: { padding: 8 },
  bubblePressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 10,
  },
  bubbleBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
  },
  bubbleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
});
