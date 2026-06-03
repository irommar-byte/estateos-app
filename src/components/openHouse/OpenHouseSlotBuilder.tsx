import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buildOpenHouseDays, buildOpenHouseHours } from '../../services/openHouseService';
import type { OpenHouseSlotDraft } from '../../contracts/openHouseContract';
import { useI18n, localeToDateFormat } from '../../i18n';

type Props = {
  isDark: boolean;
  slots: OpenHouseSlotDraft[];
  onChange: (slots: OpenHouseSlotDraft[]) => void;
};

function defaultSlot(): OpenHouseSlotDraft {
  const days = buildOpenHouseDays(1);
  return {
    date: days[0],
    startHour: '10:00',
    endHour: '11:00',
    capacity: 8,
  };
}

export default function OpenHouseSlotBuilder({ isDark, slots, onChange }: Props) {
  const { t, locale } = useI18n();
  const days = useMemo(() => buildOpenHouseDays(21), []);
  const hours = useMemo(() => buildOpenHouseHours(), []);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);

  const text = isDark ? '#FFFFFF' : '#000000';
  const muted = isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93';
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : '#EFEFF4';
  const chipActive = isDark ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.18)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  const active = slots[activeSlotIndex] ?? defaultSlot();

  const updateActive = (patch: Partial<OpenHouseSlotDraft>) => {
    const next = slots.map((slot, idx) => (idx === activeSlotIndex ? { ...slot, ...patch } : slot));
    onChange(next);
  };

  const addSlot = () => {
    onChange([...slots, defaultSlot()]);
    setActiveSlotIndex(slots.length);
  };

  const removeSlot = (idx: number) => {
    const next = slots.filter((_, i) => i !== idx);
    onChange(next.length ? next : [defaultSlot()]);
    setActiveSlotIndex(0);
  };

  return (
    <View style={styles.root}>
      <View style={styles.slotTabs}>
        {slots.map((slot, idx) => (
          <Pressable
            key={`slot-tab-${idx}`}
            onPress={() => setActiveSlotIndex(idx)}
            style={[
              styles.slotTab,
              { backgroundColor: idx === activeSlotIndex ? chipActive : chipBg, borderColor: border },
            ]}
          >
            <Text style={[styles.slotTabText, { color: text }]}>
              {slot.date.toLocaleDateString(localeToDateFormat(locale), { day: 'numeric', month: 'short' })}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={addSlot} style={[styles.addTab, { borderColor: border }]}>
          <Ionicons name="add" size={18} color="#F59E0B" />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayRow}>
        {days.map((day) => {
          const selected = active.date.toDateString() === day.toDateString();
          return (
            <Pressable
              key={day.toISOString()}
              onPress={() => updateActive({ date: day })}
              style={[styles.dayChip, { backgroundColor: selected ? chipActive : chipBg, borderColor: border }]}
            >
              <Text style={[styles.dayChipDay, { color: muted }]}>
                {day.toLocaleDateString(localeToDateFormat(locale), { weekday: 'short' })}
              </Text>
              <Text style={[styles.dayChipDate, { color: text }]}>
                {day.toLocaleDateString(localeToDateFormat(locale), { day: 'numeric', month: 'short' })}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.sectionLabel, { color: muted }]}>{t('openHouse.create.slotStart')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourRow}>
        {hours.map((hour) => {
          const selected = active.startHour === hour;
          return (
            <Pressable
              key={`start-${hour}`}
              onPress={() => updateActive({ startHour: hour })}
              style={[styles.hourChip, { backgroundColor: selected ? chipActive : chipBg, borderColor: border }]}
            >
              <Text style={{ color: text, fontWeight: '700' }}>{hour}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.sectionLabel, { color: muted }]}>{t('openHouse.create.slotEnd')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourRow}>
        {hours.map((hour) => {
          const selected = active.endHour === hour;
          return (
            <Pressable
              key={`end-${hour}`}
              onPress={() => updateActive({ endHour: hour })}
              style={[styles.hourChip, { backgroundColor: selected ? chipActive : chipBg, borderColor: border }]}
            >
              <Text style={{ color: text, fontWeight: '700' }}>{hour}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.sectionLabel, { color: muted }]}>{t('openHouse.create.slotCapacity')}</Text>
      <View style={styles.capacityRow}>
        {[4, 6, 8, 10, 12, 16].map((cap) => {
          const selected = active.capacity === cap;
          return (
            <Pressable
              key={`cap-${cap}`}
              onPress={() => updateActive({ capacity: cap })}
              style={[styles.hourChip, { backgroundColor: selected ? chipActive : chipBg, borderColor: border }]}
            >
              <Text style={{ color: text, fontWeight: '700' }}>{cap}</Text>
            </Pressable>
          );
        })}
      </View>

      {slots.length > 1 ? (
        <Pressable onPress={() => removeSlot(activeSlotIndex)} style={styles.removeBtn}>
          <Text style={styles.removeText}>{t('openHouse.create.removeSlot')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  slotTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotTab: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  slotTabText: { fontSize: 13, fontWeight: '700' },
  addTab: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRow: { marginTop: 4 },
  dayChip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  dayChipDay: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  dayChipDate: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  hourRow: { marginTop: 2 },
  hourChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
  },
  capacityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  removeBtn: { alignSelf: 'flex-start', paddingVertical: 8 },
  removeText: { color: '#FF3B30', fontWeight: '700' },
});
