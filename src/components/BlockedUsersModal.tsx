import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { X, Ban, RotateCcw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../store/useAuthStore';
import { useBlockedUsersStore } from '../store/useBlockedUsersStore';

/**
 * Lista zablokowanych użytkowników z możliwością odblokowania.
 *
 * Apple Guideline 1.2 mówi wprost: każda blokada musi być REWERSYBILNA.
 * Reviewer w 100% sprawdzi, czy z poziomu aplikacji da się odblokować
 * wcześniej zablokowanego usera — dlatego wystawiamy tę listę w Profilu.
 *
 * Lista pobierana z `useBlockedUsersStore` (lokalny stan + sync z backendu).
 * Etykiety (nazwa, e-mail) pobieramy lazy z publicznego endpointu profilu,
 * żeby store nie musiał trzymać żadnych danych osobowych.
 */

type Props = {
  visible: boolean;
  onClose: () => void;
  isDark?: boolean;
};

export default function BlockedUsersModal({ visible, onClose, isDark = true }: Props) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => (s as any).token);
  const userId = useAuthStore((s) => (s as any).user?.id);
  const blockedIds = useBlockedUsersStore((s) => s.blockedIds);
  const usersById = useBlockedUsersStore((s) => s.usersById);
  const unblock = useBlockedUsersStore((s) => s.unblock);
  const syncFromBackend = useBlockedUsersStore((s) => s.syncFromBackend);

  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());

  const idsArr = useMemo(() => Array.from(blockedIds).sort((a, b) => a - b), [blockedIds]);

  // Backend zwraca user-shape razem z listą blokad — czyli w 99% przypadków
  // mamy już `name/role/companyName` w `usersById` (zsynchronizowane przy
  // starcie i po każdym `block`). Wystarczy sync przy otwarciu, żeby na pewno
  // zobaczyć świeżą listę gdy user blokował kogoś na innym urządzeniu.
  useEffect(() => {
    if (!visible || !token) return;
    void syncFromBackend(token);
  }, [visible, token, syncFromBackend]);

  const handleUnblock = useCallback(
    async (targetId: number) => {
      if (!token || !userId) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setLoadingIds((prev) => {
        const n = new Set(prev);
        n.add(targetId);
        return n;
      });
      try {
        await unblock(targetId, token, userId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } finally {
        setLoadingIds((prev) => {
          const n = new Set(prev);
          n.delete(targetId);
          return n;
        });
      }
    },
    [token, unblock, userId]
  );

  const surface = isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.97)';
  const textMain = isDark ? '#FFFFFF' : '#111827';
  const textMuted = isDark ? 'rgba(235,235,245,0.62)' : 'rgba(17,24,39,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(17,24,39,0.08)';
  const cardBg = isDark ? 'rgba(58,58,60,0.55)' : 'rgba(0,0,0,0.04)';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <BlurView
        intensity={isDark ? 55 : 70}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          pointerEvents="box-none"
          style={[styles.kav, { paddingTop: insets.top + 40 }]}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: surface,
                borderColor: border,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: textMain }]}>
                  Zablokowani użytkownicy
                </Text>
                <Text style={[styles.subtitle, { color: textMuted }]}>
                  {idsArr.length === 0
                    ? 'Lista jest pusta — nikogo nie blokujesz.'
                    : `${idsArr.length} ${idsArr.length === 1 ? 'osoba zablokowana' : 'osób zablokowanych'}`}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={({ pressed }) => [
                  styles.closeBtn,
                  { backgroundColor: cardBg, opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Zamknij"
              >
                <X color={textMain} size={18} />
              </Pressable>
            </View>

            {idsArr.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View
                  style={[
                    styles.emptyIcon,
                    { backgroundColor: isDark ? 'rgba(48,209,88,0.18)' : 'rgba(52,199,89,0.15)' },
                  ]}
                >
                  <Ban color={isDark ? '#30D158' : '#34C759'} size={28} strokeWidth={2.4} />
                </View>
                <Text style={[styles.emptyTitle, { color: textMain }]}>
                  Nikogo nie blokujesz
                </Text>
                <Text style={[styles.emptyText, { color: textMuted }]}>
                  Jeśli ktoś zachowa się niewłaściwie, możesz go zablokować z poziomu
                  oferty lub czatu w Dealroom — wróci tutaj.
                </Text>
              </View>
            ) : (
              <FlatList
                data={idsArr}
                keyExtractor={(id) => String(id)}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingVertical: 4 }}
                renderItem={({ item: id }) => {
                  const shape = usersById[id];
                  const isBusy = loadingIds.has(id);
                  const subtitle = shape?.companyName
                    ? shape.companyName
                    : shape?.role && shape.role.toUpperCase() === 'AGENT'
                      ? 'Agent EstateOS™'
                      : undefined;
                  return (
                    <View
                      style={[
                        styles.row,
                        { backgroundColor: cardBg, borderColor: border },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: textMain }]}>
                          {shape?.name || `Użytkownik #${id}`}
                        </Text>
                        {subtitle ? (
                          <Text style={[styles.rowSubtitle, { color: textMuted }]}>
                            {subtitle}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => void handleUnblock(id)}
                        disabled={isBusy}
                        style={({ pressed }) => [
                          styles.unblockBtn,
                          {
                            borderColor: isDark ? 'rgba(48,209,88,0.55)' : 'rgba(52,199,89,0.7)',
                            opacity: isBusy ? 0.5 : pressed ? 0.7 : 1,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Odblokuj"
                      >
                        {isBusy ? (
                          <ActivityIndicator
                            size="small"
                            color={isDark ? '#30D158' : '#34C759'}
                          />
                        ) : (
                          <>
                            <RotateCcw
                              size={14}
                              color={isDark ? '#30D158' : '#34C759'}
                              strokeWidth={2.4}
                            />
                            <Text
                              style={[
                                styles.unblockText,
                                { color: isDark ? '#30D158' : '#34C759' },
                              ]}
                            >
                              Odblokuj
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, paddingHorizontal: 16 },
  sheet: {
    flex: 1,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 30,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSubtitle: { fontSize: 12.5, marginTop: 2 },
  unblockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  unblockText: { fontSize: 13, fontWeight: '700' },
});
