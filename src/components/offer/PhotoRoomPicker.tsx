import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

/** Typowe pomieszczenia — gdy oferta nie ma skanu, a i tak warto opisać zdjęcia. */
export const DEFAULT_PHOTO_ROOMS = [
  'Salon',
  'Kuchnia',
  'Sypialnia',
  'Pokój',
  'Pokój dziecięcy',
  'Gabinet',
  'Łazienka',
  'WC',
  'Przedpokój',
  'Garderoba',
  'Balkon',
  'Taras',
  'Ogród',
  'Garaż',
  'Budynek',
  'Widok',
];

/** Lista do wyboru: najpierw pomieszczenia ze skanu (te same nazwy co na rzucie), potem typowe. */
export function photoRoomOptions(scannedNames: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of [...scannedNames, ...DEFAULT_PHOTO_ROOMS]) {
    const label = String(name || '').trim();
    const key = label.toLocaleLowerCase('pl');
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

type PickerProps = {
  visible: boolean;
  options: string[];
  scannedCount: number;
  current?: string | null;
  /** Podpowiedź AI — oznaczona na liście złotym „AI”. */
  suggested?: string | null;
  isDark?: boolean;
  onPick: (room: string | null) => void;
  onClose: () => void;
};

/** Arkusz „Które to pomieszczenie?” — opcjonalne przypisanie zdjęcia do pokoju (łączy zdjęcia z rzutem). */
export function PhotoRoomPicker({ visible, options, scannedCount, current, suggested, isDark, onPick, onClose }: PickerProps) {
  const fg = isDark ? '#f5f5f7' : '#15171a';
  const sub = isDark ? 'rgba(245,245,247,0.6)' : '#6b6e75';
  const pick = (room: string | null) => {
    Haptics.selectionAsync().catch(() => undefined);
    onPick(room);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' }]}>
        <View style={styles.grabber} />
        <Text style={[styles.title, { color: fg }]}>Które to pomieszczenie?</Text>
        <Text style={[styles.lead, { color: sub }]}>
          Zdjęcie połączy się z rzutem — klient kliknie pokój i zobaczy jego zdjęcia.
        </Text>
        <ScrollView contentContainerStyle={styles.grid} style={{ maxHeight: 360 }}>
          {options.map((room, index) => {
            const active = Boolean(current) && current!.toLocaleLowerCase('pl') === room.toLocaleLowerCase('pl');
            const fromScan = index < scannedCount;
            return (
              <Pressable
                key={room}
                onPress={() => pick(room)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: active ? (isDark ? '#f3eee6' : '#15171a') : isDark ? 'rgba(255,255,255,0.06)' : '#f3f1ec',
                    borderColor: fromScan ? 'rgba(201,169,110,0.7)' : 'transparent',
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              >
                {fromScan ? <Ionicons name="scan-outline" size={13} color={active ? (isDark ? '#15171a' : '#fff') : '#b08a47'} /> : null}
                <Text style={[styles.chipText, { color: active ? (isDark ? '#15171a' : '#fff') : fg }]}>{room}</Text>
                {!current && suggested && suggested.toLocaleLowerCase('pl') === room.toLocaleLowerCase('pl') ? (
                  <View style={styles.aiTag}>
                    <Ionicons name="sparkles" size={9} color="#15171a" />
                    <Text style={styles.aiTagText}>AI</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.footer}>
          {current ? (
            <Pressable onPress={() => pick(null)} style={styles.clearBtn} hitSlop={8}>
              <Text style={[styles.clearText, { color: sub }]}>Usuń przypisanie</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable onPress={onClose} style={[styles.doneBtn, { backgroundColor: isDark ? '#f3eee6' : '#15171a' }]}>
            <Text style={[styles.doneText, { color: isDark ? '#15171a' : '#fff' }]}>Gotowe</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Mała plakietka na kafelku zdjęcia: nazwa pomieszczenia albo „+”. */
export function PhotoRoomBadge({
  label,
  suggestion,
  onPress,
  style,
}: {
  label?: string | null;
  /** Podpowiedź AI do zatwierdzenia — „Kuchnia?”. */
  suggestion?: string | null;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const ai = !label && suggestion;
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.badge, label ? styles.badgeSet : null, ai ? styles.badgeAi : null, style]}>
      <Ionicons name={label ? 'location' : ai ? 'sparkles' : 'add'} size={11} color={ai ? '#ecd7a9' : '#fff'} />
      {label || ai ? (
        <Text style={styles.badgeText} numberOfLines={1}>
          {label || `${suggestion}?`}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 34, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(120,120,128,0.35)', marginBottom: 14 },
  title: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  lead: { fontSize: 13, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 14, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  clearBtn: { paddingVertical: 10 },
  clearText: { fontSize: 14, fontWeight: '600' },
  doneBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 },
  doneText: { fontSize: 15, fontWeight: '700' },
  badge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    maxWidth: '78%',
    height: 22,
    minWidth: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  badgeSet: { backgroundColor: 'rgba(21,23,26,0.85)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.8)' },
  badgeText: { color: '#fff', fontSize: 10.5, fontWeight: '700', flexShrink: 1 },
  badgeAi: { backgroundColor: 'rgba(42,36,24,0.9)', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(236,215,169,0.95)' },
  aiTag: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999, backgroundColor: '#e6cf9f' },
  aiTagText: { fontSize: 9, fontWeight: '800', color: '#15171a' },
  aiBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(201,169,110,0.5)', backgroundColor: '#1b1a17', paddingLeft: 14, paddingRight: 6, paddingVertical: 6, marginBottom: 10 },
  aiBarText: { flex: 1, color: '#f3eee6', fontSize: 12.5, fontWeight: '600' },
  aiBarBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: '#e2c992', paddingHorizontal: 12, paddingVertical: 7 },
  aiBarBtnText: { color: '#15171a', fontSize: 12, fontWeight: '800' },
});

/** Pasek „AI rozpoznało pomieszczenia — Zatwierdź wszystkie”. */
export function PhotoRoomAiBar({ busy, pending, onAcceptAll }: { busy: boolean; pending: number; onAcceptAll: () => void }) {
  if (!busy && !pending) return null;
  return (
    <View style={styles.aiBar}>
      {busy ? <ActivityIndicator size="small" color="#e2c992" /> : <Ionicons name="sparkles" size={15} color="#e2c992" />}
      <Text style={styles.aiBarText} numberOfLines={2}>
        {busy ? 'AI rozpoznaje pomieszczenia…' : `AI rozpoznało pomieszczenia na ${pending} ${pending === 1 ? 'zdjęciu' : 'zdjęciach'}`}
      </Text>
      {!busy && pending ? (
        <Pressable
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            onAcceptAll();
          }}
          style={({ pressed }) => [styles.aiBarBtn, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
        >
          <Ionicons name="checkmark" size={14} color="#15171a" />
          <Text style={styles.aiBarBtnText}>Zatwierdź</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
