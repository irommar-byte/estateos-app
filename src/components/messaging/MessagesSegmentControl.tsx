import React from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useThemeStore } from '../../store/useThemeStore';
import { useI18n } from '../../i18n';

export type MessagesSegment = 'contact' | 'dealrooms';

type Props = {
  value: MessagesSegment;
  onChange: (value: MessagesSegment) => void;
  contactUnread?: number;
  dealroomUnread?: number;
};

export default function MessagesSegmentControl({
  value,
  onChange,
  contactUnread = 0,
  dealroomUnread = 0,
}: Props) {
  const { t } = useI18n();
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';

  const tabs: { id: MessagesSegment; label: string; unread: number }[] = [
    { id: 'contact', label: t('contact.brand'), unread: contactUnread },
    { id: 'dealrooms', label: t('contact.brandDealrooms'), unread: dealroomUnread },
  ];

  return (
    <View style={styles.wrap}>
      <BlurView intensity={isDark ? 40 : 72} tint={isDark ? 'dark' : 'light'} style={styles.blur}>
        <View style={[styles.row, { backgroundColor: isDark ? 'rgba(28,28,30,0.72)' : 'rgba(255,255,255,0.82)' }]}>
          {tabs.map((tab) => {
            const active = value === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  onChange(tab.id);
                }}
                style={({ pressed }) => [
                  styles.tab,
                  active && (isDark ? styles.tabActiveDark : styles.tabActiveLight),
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: isDark ? '#EBEBF5' : '#1C1C1E' },
                    active && { fontWeight: '800', color: isDark ? '#fff' : '#000' },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  {tab.label}
                </Text>
                {tab.unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{tab.unread > 99 ? '99+' : tab.unread}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 10 },
  blur: { borderRadius: 16, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 6,
  },
  tabActiveLight: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  tabActiveDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabText: { fontSize: 12.5, fontWeight: '600', letterSpacing: -0.2, flexShrink: 1 },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
