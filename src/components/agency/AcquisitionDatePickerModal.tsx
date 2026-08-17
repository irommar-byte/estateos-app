import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Mode = 'meeting' | 'timeline';

const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const TIME_OPTIONS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00',
];

const TIMELINE_PRESETS = [
  { label: '2 tygodnie', days: 14 },
  { label: '1 miesiąc', days: 30 },
  { label: '3 miesiące', days: 90 },
  { label: '6 miesięcy', days: 180 },
  { label: '12 miesięcy', days: 365 },
  { label: 'Bez pośpiechu', days: null as number | null },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function parseInitial(initialValue?: string): { date: Date; time: string; preset?: string } {
  const now = new Date();
  if (!initialValue?.trim()) return { date: now, time: '10:00' };
  const raw = initialValue.trim();
  if (raw.toLowerCase().includes('pośpiech') || raw.toLowerCase().includes('pospiech')) {
    return { date: now, time: '10:00', preset: 'Bez pośpiechu' };
  }
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return { date: now, time: '10:00' };
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const time = m[4] && m[5] ? `${m[4]}:${m[5]}` : '10:00';
  return { date, time };
}

function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = new Date(first);
  const dow = start.getDay();
  start.setDate(start.getDate() + (dow === 0 ? -6 : 1 - dow));
  const end = new Date(last);
  const endDow = end.getDay();
  end.setDate(end.getDate() + (endDow === 0 ? 0 : 7 - endDow));
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export default function AcquisitionDatePickerModal({
  visible,
  initialValue,
  onClose,
  onSelect,
  isDark,
  mode = 'meeting',
  title,
}: {
  visible: boolean;
  initialValue?: string;
  onClose: () => void;
  onSelect: (formattedDate: string) => void;
  isDark?: boolean;
  mode?: Mode;
  title?: string;
}) {
  const parsed = useMemo(() => parseInitial(initialValue), [initialValue, visible]);
  const [viewYear, setViewYear] = useState(parsed.date.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.date.getMonth());
  const [selectedDate, setSelectedDate] = useState(startOfDay(parsed.date));
  const [selectedTime, setSelectedTime] = useState(parsed.time);
  const [timelinePreset, setTimelinePreset] = useState<string | null>(parsed.preset || null);

  useEffect(() => {
    if (!visible) return;
    const next = parseInitial(initialValue);
    setSelectedDate(startOfDay(next.date));
    setSelectedTime(next.time);
    setViewYear(next.date.getFullYear());
    setViewMonth(next.date.getMonth());
    setTimelinePreset(next.preset || null);
  }, [visible, initialValue]);

  const colors = {
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    input: isDark ? '#2C2C2E' : '#F2F2F7',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    accent: '#34C759',
  };

  const today = startOfDay(new Date());
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('pl-PL', {
    month: 'long',
    year: 'numeric',
  });

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const formattedMeeting = `${toYmd(selectedDate)} ${selectedTime}`;
  const formattedTimeline =
    timelinePreset === 'Bez pośpiechu' ? 'Bez pośpiechu' : toYmd(selectedDate);

  const handleConfirm = () => {
    onSelect(mode === 'timeline' ? formattedTimeline : formattedMeeting);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.overlay}>
        <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {title || (mode === 'timeline' ? 'Horyzont sprzedaży' : 'Termin spotkania')}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close-circle" size={24} color={colors.secondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
            {mode === 'timeline' ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.secondary }]}>ORIENTACYJNIE</Text>
                <View style={styles.presetWrap}>
                  {TIMELINE_PRESETS.map((item) => {
                    const active =
                      item.days == null
                        ? timelinePreset === item.label
                        : timelinePreset === item.label;
                    return (
                      <Pressable
                        key={item.label}
                        onPress={() => {
                          setTimelinePreset(item.label);
                          if (item.days != null) {
                            const d = new Date();
                            d.setDate(d.getDate() + item.days);
                            setSelectedDate(startOfDay(d));
                            setViewYear(d.getFullYear());
                            setViewMonth(d.getMonth());
                          }
                        }}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: active ? colors.accent : colors.input,
                            borderColor: active ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text style={{ color: active ? '#000' : colors.text, fontWeight: '800', fontSize: 12 }}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {timelinePreset === 'Bez pośpiechu' && mode === 'timeline' ? null : (
              <>
                <View style={styles.monthNav}>
                  <Pressable onPress={() => shiftMonth(-1)} hitSlop={10}>
                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                  </Pressable>
                  <Text style={{ color: colors.text, fontWeight: '800', textTransform: 'capitalize' }}>
                    {monthLabel}
                  </Text>
                  <Pressable onPress={() => shiftMonth(1)} hitSlop={10}>
                    <Ionicons name="chevron-forward" size={22} color={colors.text} />
                  </Pressable>
                </View>

                <View style={styles.weekRow}>
                  {WEEKDAYS.map((wd) => (
                    <Text key={wd} style={[styles.wd, { color: colors.secondary }]}>
                      {wd}
                    </Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {grid.map((d) => {
                    const inMonth = d.getMonth() === viewMonth;
                    const isToday = sameDay(d, today);
                    const selected = sameDay(d, selectedDate);
                    const past = startOfDay(d) < today;
                    return (
                      <Pressable
                        key={d.toISOString()}
                        disabled={past && mode === 'meeting'}
                        onPress={() => {
                          setSelectedDate(startOfDay(d));
                          if (mode === 'timeline') setTimelinePreset(null);
                        }}
                        style={[
                          styles.day,
                          selected && { backgroundColor: colors.accent },
                          isToday && !selected && { borderColor: colors.accent, borderWidth: 1 },
                        ]}
                      >
                        <Text
                          style={{
                            color: selected ? '#000' : past && mode === 'meeting' ? colors.secondary : inMonth ? colors.text : colors.secondary,
                            fontWeight: selected || isToday ? '800' : '600',
                            opacity: inMonth ? 1 : 0.4,
                          }}
                        >
                          {d.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {mode === 'meeting' ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.secondary, marginTop: 12 }]}>GODZINA</Text>
                <View style={styles.timeGrid}>
                  {TIME_OPTIONS.map((time) => {
                    const active = selectedTime === time;
                    return (
                      <Pressable
                        key={time}
                        onPress={() => setSelectedTime(time)}
                        style={[
                          styles.timeChip,
                          {
                            backgroundColor: active ? colors.accent : colors.input,
                            borderColor: active ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text style={{ color: active ? '#000' : colors.text, fontWeight: active ? '800' : '600', fontSize: 13 }}>
                          {time}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={{ color: colors.secondary, fontSize: 12, fontWeight: '700', flex: 1 }}>
              {mode === 'meeting' ? formattedMeeting : formattedTimeline}
            </Text>
            <Pressable onPress={handleConfirm} style={[styles.btn, { backgroundColor: colors.accent }]}>
              <Text style={styles.btnText}>Zatwierdź</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '800', flex: 1, paddingRight: 12 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekRow: { flexDirection: 'row' },
  wd: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  footer: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  btnText: { color: '#000', fontWeight: '800', fontSize: 13 },
});
