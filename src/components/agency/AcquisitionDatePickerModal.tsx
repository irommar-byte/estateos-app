import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { capitalizeSentence, formatPolishDateTime } from '../../lib/polishText';

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
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

/** Monday-first weeks. Each inner array has exactly 7 local calendar days. */
function buildWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  const sundayOffset = last.getDay() === 0 ? 0 : 7 - last.getDay();
  const end = new Date(year, month + 1, 0 + sundayOffset);
  const weeks: Date[][] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor.getTime() <= end.getTime()) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
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
    text: isDark ? '#FFFFFF' : '#111111',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    input: isDark ? '#2C2C2E' : '#F4F1EA',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    accent: '#34C759',
    weekend: isDark ? '#FF9F0A' : '#C2410C',
  };

  const today = startOfDay(new Date());
  const weeks = useMemo(() => buildWeeks(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = capitalizeSentence(
    new Date(viewYear, viewMonth, 1).toLocaleDateString('pl-PL', {
      month: 'long',
      year: 'numeric',
    }),
  );

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const formattedMeeting = `${toYmd(selectedDate)} ${selectedTime}`;
  const formattedTimeline =
    timelinePreset === 'Bez pośpiechu' ? 'Bez pośpiechu' : toYmd(selectedDate);

  const selectedPreview = (() => {
    if (mode === 'timeline' && timelinePreset === 'Bez pośpiechu') return 'Bez pośpiechu';
    const [hh, mm] = selectedTime.split(':').map(Number);
    const dt = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hh || 10,
      mm || 0,
    );
    return mode === 'meeting'
      ? formatPolishDateTime(dt)
      : formatPolishDateTime(dt, { time: false });
  })();

  const handleConfirm = () => {
    onSelect(mode === 'timeline' ? formattedTimeline : formattedMeeting);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.overlay}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: isDark ? '#000' : '#1a1612',
            },
          ]}
        >
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.kicker, { color: colors.secondary }]}>KALENDARZ</Text>
              <Text style={[styles.title, { color: colors.text }]}>
                {title || (mode === 'timeline' ? 'Horyzont sprzedaży' : 'Termin spotkania')}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close-circle" size={26} color={colors.secondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>
            {mode === 'timeline' ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.secondary }]}>ORIENTACYJNIE</Text>
                <View style={styles.presetWrap}>
                  {TIMELINE_PRESETS.map((item) => {
                    const active = timelinePreset === item.label;
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
                <View style={[styles.monthNav, { backgroundColor: colors.input }]}>
                  <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.monthNavBtn}>
                    <Ionicons name="chevron-back" size={20} color={colors.text} />
                  </Pressable>
                  <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17, letterSpacing: -0.3 }}>
                    {monthLabel}
                  </Text>
                  <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.monthNavBtn}>
                    <Ionicons name="chevron-forward" size={20} color={colors.text} />
                  </Pressable>
                </View>

                <View style={styles.weekRow}>
                  {WEEKDAYS.map((wd, index) => (
                    <View key={wd} style={styles.weekCell}>
                      <Text
                        style={[
                          styles.wd,
                          { color: index >= 5 ? colors.weekend : colors.secondary },
                        ]}
                      >
                        {wd}
                      </Text>
                    </View>
                  ))}
                </View>

                {weeks.map((week, wi) => (
                  <View key={`w-${viewYear}-${viewMonth}-${wi}`} style={styles.weekRow}>
                    {week.map((d) => {
                      const inMonth = d.getMonth() === viewMonth;
                      const isToday = sameDay(d, today);
                      const selected = sameDay(d, selectedDate);
                      const past = startOfDay(d) < today;
                      const weekend = d.getDay() === 0 || d.getDay() === 6;
                      const weekdayName = capitalizeSentence(
                        d.toLocaleDateString('pl-PL', { weekday: 'long' }),
                      );
                      return (
                        <View key={toYmd(d)} style={styles.weekCell}>
                          <Pressable
                            disabled={past && mode === 'meeting'}
                            onPress={() => {
                              setSelectedDate(startOfDay(d));
                              if (mode === 'timeline') setTimelinePreset(null);
                            }}
                            accessibilityLabel={`${weekdayName} ${d.getDate()}`}
                            style={[
                              styles.day,
                              selected && styles.daySelected,
                              isToday && !selected && styles.dayToday,
                              selected && { backgroundColor: colors.accent, shadowColor: colors.accent },
                            ]}
                          >
                            <Text
                              style={{
                                color: selected
                                  ? '#052e16'
                                  : past && mode === 'meeting'
                                    ? colors.secondary
                                    : isToday
                                      ? colors.accent
                                      : weekend && inMonth
                                        ? colors.weekend
                                        : inMonth
                                          ? colors.text
                                          : colors.secondary,
                                fontWeight: selected || isToday ? '900' : '700',
                                fontSize: 15,
                                opacity: inMonth ? 1 : 0.38,
                              }}
                            >
                              {d.getDate()}
                            </Text>
                          </Pressable>
                          {isToday ? (
                            <Text style={[styles.todayHint, { color: colors.accent }]}>dziś</Text>
                          ) : (
                            <Text style={styles.todayHint}> </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </>
            )}

            {mode === 'meeting' ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.secondary, marginTop: 10 }]}>GODZINA</Text>
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
                            shadowOpacity: active ? 0.18 : 0,
                          },
                        ]}
                      >
                        <Text style={{ color: active ? '#052e16' : colors.text, fontWeight: active ? '900' : '700', fontSize: 13 }}>
                          {time}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.footerKicker, { color: colors.secondary }]}>WYBRANY TERMIN</Text>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{selectedPreview}</Text>
            </View>
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
    backgroundColor: 'rgba(12,10,8,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
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
    marginBottom: 10,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: { flexDirection: 'row', width: '100%' },
  weekCell: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  wd: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, paddingBottom: 4 },
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: '#34C759',
  },
  todayHint: { fontSize: 8, fontWeight: '800', height: 12, marginTop: 1 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#34C759',
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  footerKicker: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  btn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  btnText: { color: '#052e16', fontWeight: '900', fontSize: 14 },
});
