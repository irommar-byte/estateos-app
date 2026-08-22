import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { crmKindColor, type CrmScheduleEvent } from '../../hooks/useCrmSchedule';
import { crmKindTone, type CrmPalette } from './crmGoldTheme';
import { capitalizeSentence } from '../../lib/polishText';

type Props = {
  events: CrmScheduleEvent[];
  isDark: boolean;
  onEventPress?: (event: CrmScheduleEvent) => void;
  /** Drops the own card chrome so a parent surface (e.g. metal recess) provides it. */
  plain?: boolean;
  /** Colour of the "today" marker and other highlights. */
  accent?: string;
  /** Overrides the stock iOS accents, e.g. to stay readable on the gold panel. */
  palette?: CrmPalette;
};

const WEEKDAYS = ['PN', 'WT', 'ŚR', 'CZ', 'PT', 'SB', 'ND'];

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Monday-first offset of the 1st day of the month. */
function leadingBlanks(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay();
  return (firstWeekday + 6) % 7;
}

/** Picks black or white for text drawn on top of `hex`. */
function readableOn(hex: string) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#FFFFFF';
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0D0D0F' : '#FFFFFF';
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1)
    .toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
    .toUpperCase();
}

export default function CrmMonthCalendar({
  events,
  isDark,
  onEventPress,
  plain,
  accent = '#34C759',
  palette,
}: Props) {
  const kindTone = (kind: CrmScheduleEvent['kind']) =>
    palette ? crmKindTone(palette, kind) : crmKindColor(kind);
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState<string>(dayKey(today));
  const fade = useRef(new Animated.Value(1)).current;

  const text = palette?.text ?? (isDark ? '#FFFFFF' : '#0D0D0F');
  const secondary = palette?.secondary ?? (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)');
  const weekendLabel = palette?.muted ?? (isDark ? '#5E5E63' : '#B0B0B5');
  const trackBg = plain ? 'transparent' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)';
  const hairline = palette?.hairline ?? (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)');
  const rowBg =
    palette?.surface ??
    (plain
      ? isDark
        ? 'rgba(255,255,255,0.09)'
        : 'rgba(255,255,255,0.5)'
      : isDark
        ? 'rgba(255,255,255,0.06)'
        : '#FFFFFF');
  const selectedBg = palette?.surfaceStrong ?? (isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.55)');

  const byDay = useMemo(() => {
    const map = new Map<string, CrmScheduleEvent[]>();
    for (const event of events) {
      const date = new Date(event.startsAt);
      if (Number.isNaN(date.getTime())) continue;
      const key = dayKey(date);
      const bucket = map.get(key);
      if (bucket) bucket.push(event);
      else map.set(key, [event]);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [events]);

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const blanks = leadingBlanks(cursor.year, cursor.month);
  const cells = useMemo(() => {
    const list: Array<{ day: number; key: string } | null> = [];
    for (let i = 0; i < blanks; i += 1) list.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      list.push({ day, key: `${cursor.year}-${cursor.month + 1}-${day}` });
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [blanks, daysInMonth, cursor.year, cursor.month]);

  const monthEventCount = useMemo(
    () =>
      events.filter((event) => {
        const date = new Date(event.startsAt);
        return date.getFullYear() === cursor.year && date.getMonth() === cursor.month;
      }).length,
    [events, cursor.year, cursor.month],
  );

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cursor.year, cursor.month, fade]);

  const shiftMonth = (delta: number) => {
    void Haptics.selectionAsync();
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const selectedEvents = byDay.get(selected) || [];
  const selectedDate = useMemo(() => {
    const [y, m, d] = selected.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [selected]);

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: trackBg, borderColor: hairline },
        plain ? styles.wrapPlain : null,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerMonth, { color: text }]}>{monthLabel(cursor.year, cursor.month)}</Text>
          <Text style={[styles.headerMeta, { color: secondary }]}>
            {monthEventCount === 0
              ? 'Brak wydarzeń w tym miesiącu'
              : `${monthEventCount} ${monthEventCount === 1 ? 'wydarzenie' : 'wydarzenia'} w planie`}
          </Text>
        </View>
        <View style={styles.navRow}>
          <Pressable
            onPress={() => shiftMonth(-1)}
            hitSlop={10}
            style={({ pressed }) => [styles.navBtn, { borderColor: hairline, opacity: pressed ? 0.55 : 1 }]}
          >
            <Ionicons name="chevron-back" size={15} color={text} />
          </Pressable>
          <Pressable
            onPress={() => shiftMonth(1)}
            hitSlop={10}
            style={({ pressed }) => [styles.navBtn, { borderColor: hairline, opacity: pressed ? 0.55 : 1 }]}
          >
            <Ionicons name="chevron-forward" size={15} color={text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((label, i) => (
          <View key={label} style={styles.weekCell}>
            <Text style={[styles.weekLabel, { color: i > 4 ? weekendLabel : secondary }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <Animated.View
        style={[
          styles.grid,
          {
            opacity: fade,
            transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
          },
        ]}
      >
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.weekRow}>
            {cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((cell, index) => {
          if (!cell) return <View key={`blank-${weekIndex}-${index}`} style={styles.weekCell} />;
          const dayEvents = byDay.get(cell.key) || [];
          const isToday =
            cell.day === today.getDate() &&
            cursor.month === today.getMonth() &&
            cursor.year === today.getFullYear();
          const isSelected = selected === cell.key;
          const dots = dayEvents.slice(0, 3);
          const isPast = new Date(cursor.year, cursor.month, cell.day).setHours(23, 59, 59) < today.getTime();

          return (
            <Pressable
              key={cell.key}
              onPress={() => {
                void Haptics.selectionAsync();
                setSelected(cell.key);
              }}
              style={styles.weekCell}
            >
              <View
                style={[
                  styles.dayShell,
                  isSelected && !isToday ? { backgroundColor: selectedBg } : null,
                  isToday ? [styles.dayToday, { backgroundColor: accent, shadowColor: accent }] : null,
                ]}
              >
                <Text
                  style={[
                    styles.dayNum,
                    {
                      color: isToday ? readableOn(accent) : dayEvents.length > 0 ? text : secondary,
                      fontWeight: isToday || dayEvents.length > 0 ? '800' : '600',
                      opacity: !isToday && isPast ? 0.45 : 1,
                    },
                  ]}
                >
                  {cell.day}
                </Text>
              </View>
              <View style={styles.dotRow}>
                {dots.map((event) => (
                  <View
                    key={event.id}
                    style={[styles.dot, { backgroundColor: kindTone(event.kind), opacity: isPast ? 0.5 : 1 }]}
                  />
                ))}
              </View>
            </Pressable>
          );
            })}
          </View>
        ))}
      </Animated.View>

      <View style={styles.legendRow}>
        {[
          { color: kindTone('acquisition'), label: 'Pozyskanie' },
          { color: kindTone('presentation'), label: 'Prezentacja' },
          { color: kindTone('open_house_host'), label: 'Dzień otwarty' },
        ].map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <Text style={[styles.legendText, { color: secondary }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.divider, { backgroundColor: hairline }]} />

      <Text style={[styles.selectedLabel, { color: secondary }]}>
        {capitalizeSentence(
          selectedDate.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }),
        )}
      </Text>

      {selectedEvents.length === 0 ? (
        <Text style={[styles.selectedEmpty, { color: secondary }]}>Wolny dzień — brak zaplanowanych wydarzeń.</Text>
      ) : (
        <View style={{ gap: 6, marginTop: 6 }}>
          {selectedEvents.map((event) => (
            <Pressable
              key={event.id}
              onPress={() => onEventPress?.(event)}
              style={({ pressed }) => [
                styles.eventRow,
                { backgroundColor: rowBg, borderColor: hairline, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.eventBar, { backgroundColor: kindTone(event.kind) }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.eventTitle, { color: text }]} numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={[styles.eventMeta, { color: secondary }]} numberOfLines={1}>
                  {new Date(event.startsAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  {event.subtitle ? ` · ${event.subtitle}` : ''}
                  {event.location ? ` · ${event.location}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={secondary} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  wrapPlain: {
    borderWidth: 0,
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitleCol: { flex: 1, minWidth: 0 },
  headerMonth: { fontSize: 13, fontWeight: '900', letterSpacing: 0.7 },
  headerMeta: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  navRow: { flexDirection: 'row', gap: 6 },
  navBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: { flexDirection: 'row', width: '100%', marginBottom: 2 },
  weekLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  grid: { width: '100%' },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 2,
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 2,
  },
  dayShell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: {
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dayNum: { fontSize: 12, fontVariant: ['tabular-nums'] },
  dotRow: { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 9, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 10, marginBottom: 10 },
  selectedLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  selectedEmpty: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  eventBar: { width: 3, height: 26, borderRadius: 2 },
  eventTitle: { fontSize: 12.5, fontWeight: '800' },
  eventMeta: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
});
