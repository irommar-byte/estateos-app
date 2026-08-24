import React, { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

type Props = {
  size?: number;
  isDark?: boolean;
  accent?: string;
  variant?: 'steel' | 'gold' | 'red';
  brandLine?: string | null;
  /** Engraved date carved into the gold beside the dial — no plate/frame. */
  showEngravedDate?: boolean;
};

/** SF Pro on iOS (default system), Roboto medium on Android — bold, never italic. */
const APPLE_TYPE = Platform.select({
  ios: undefined,
  android: 'sans-serif-medium',
  default: undefined,
}) as string | undefined;

const WEEKDAYS_PL = [
  'niedziela',
  'poniedziałek',
  'wtorek',
  'środa',
  'czwartek',
  'piątek',
  'sobota',
] as const;

const MONTHS_PL = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
] as const;

function truncateBrand(raw: string | null | undefined, max = 16): string {
  const t = String(raw || '').trim();
  if (!t) return 'ESTATEOS';
  if (t.length <= max) return t.toUpperCase();
  return `${t.slice(0, max - 1).trim().toUpperCase()}…`;
}

function capitalizePl(word: string) {
  if (!word) return word;
  return word.charAt(0).toLocaleUpperCase('pl-PL') + word.slice(1);
}

function formatEngravedParts(date: Date) {
  return {
    weekday: capitalizePl(WEEKDAYS_PL[date.getDay()]),
    dayNum: String(date.getDate()),
    monthWord: capitalizePl(MONTHS_PL[date.getMonth()]),
    year: String(date.getFullYear()),
  };
}

/**
 * Luxury engraved metal lettering — bold SF, no italic.
 * Hero day: raised polished metal with sun-flare gleam (not flat titanium).
 */
function EngravedLine({
  text,
  size,
  isDark,
  gold,
  letterSpacing = 0.4,
  emphasis = 'normal',
  gleam,
}: {
  text: string;
  size: number;
  isDark: boolean;
  gold: boolean;
  letterSpacing?: number;
  emphasis?: 'normal' | 'hero';
  gleam?: Animated.Value;
}) {
  const hero = emphasis === 'hero';

  // Raised polished brass / deep gold carve — strong emboss + specular lip.
  const fill = gold
    ? isDark
      ? hero
        ? 'rgba(42, 30, 8, 0.96)'
        : 'rgba(68, 48, 12, 0.9)'
      : hero
        ? 'rgba(48, 34, 8, 0.92)'
        : 'rgba(58, 42, 10, 0.8)'
    : isDark
      ? hero
        ? 'rgba(22,22,26,0.96)'
        : 'rgba(28,28,32,0.86)'
      : hero
        ? 'rgba(28,28,32,0.9)'
        : 'rgba(42,42,46,0.78)';

  const lip = gold
    ? isDark
      ? hero
        ? 'rgba(255, 248, 220, 0.78)'
        : 'rgba(255, 240, 190, 0.42)'
      : hero
        ? 'rgba(255, 255, 255, 0.88)'
        : 'rgba(255, 250, 230, 0.58)'
    : isDark
      ? 'rgba(255,255,255,0.28)'
      : 'rgba(255,255,255,0.48)';

  const shadowColor = gold
    ? isDark
      ? hero
        ? 'rgba(0, 0, 0, 0.95)'
        : 'rgba(0, 0, 0, 0.75)'
      : hero
        ? 'rgba(30, 20, 4, 0.55)'
        : 'rgba(40, 28, 6, 0.48)'
    : 'rgba(0,0,0,0.4)';

  const ambientGlow = gold
    ? isDark
      ? hero
        ? 'rgba(255, 214, 120, 0.38)'
        : 'rgba(201, 162, 39, 0.28)'
      : hero
        ? 'rgba(201, 162, 39, 0.32)'
        : 'rgba(201, 162, 39, 0.2)'
    : 'rgba(0,0,0,0.08)';

  const weight = hero ? ('800' as const) : ('700' as const);

  const base = {
    ...(APPLE_TYPE ? { fontFamily: APPLE_TYPE } : null),
    fontSize: size,
    fontWeight: weight,
    letterSpacing,
    fontVariant: ['tabular-nums' as const],
  };

  const flareOpacity = gleam
    ? gleam.interpolate({
        inputRange: [0, 0.35, 0.5, 0.7, 1],
        outputRange: [0.35, 0.95, 1, 0.7, 0.35],
      })
    : 1;

  return (
    <View style={styles.engraveWrap}>
      <Text
        pointerEvents="none"
        style={[
          base,
          styles.engraveLayer,
          {
            color: ambientGlow,
            top: hero ? 2.6 : 2,
            left: hero ? 1 : 0.7,
            textShadowColor: ambientGlow,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: hero ? 12 : 5,
          },
        ]}
      >
        {text}
      </Text>
      <Text
        style={[
          base,
          {
            color: fill,
            textShadowColor: shadowColor,
            textShadowOffset: { width: hero ? 1.1 : 0.7, height: hero ? 2.6 : 1.4 },
            textShadowRadius: hero ? 5.5 : 2.4,
          },
        ]}
      >
        {text}
      </Text>
      <Text
        pointerEvents="none"
        style={[
          base,
          styles.engraveLayer,
          {
            color: lip,
            top: hero ? -1.1 : -0.6,
            left: hero ? -0.75 : -0.4,
            opacity: hero ? 0.98 : 0.92,
            textShadowColor: hero
              ? isDark
                ? 'rgba(255, 248, 210, 0.55)'
                : 'rgba(255, 255, 255, 0.7)'
              : 'transparent',
            textShadowOffset: { width: -0.4, height: -0.6 },
            textShadowRadius: hero ? 3.5 : 0,
          },
        ]}
      >
        {text}
      </Text>
      {hero ? (
        <Animated.Text
          pointerEvents="none"
          style={[
            base,
            styles.engraveLayer,
            {
              color: isDark ? 'rgba(255, 250, 230, 0.55)' : 'rgba(255, 255, 255, 0.72)',
              top: -1.4,
              left: -1,
              opacity: flareOpacity,
              textShadowColor: isDark ? 'rgba(255, 230, 150, 0.85)' : 'rgba(255, 250, 220, 0.95)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 8,
            },
          ]}
        >
          {text}
        </Animated.Text>
      ) : null}
    </View>
  );
}

/** Catholic Easter (Gregorian computus) — Poland uses this calendar. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

const FIXED_PL_HOLIDAYS: Array<{ m: number; d: number; name: string }> = [
  { m: 0, d: 1, name: 'Nowy Rok' },
  { m: 0, d: 6, name: 'Święto Trzech Króli' },
  { m: 4, d: 1, name: 'Święto Pracy' },
  { m: 4, d: 3, name: 'Święto Konstytucji 3 Maja' },
  { m: 7, d: 15, name: 'Wniebowzięcie NMP' },
  { m: 10, d: 1, name: 'Wszystkich Świętych' },
  { m: 10, d: 11, name: 'Narodowe Święto Niepodległości' },
  { m: 11, d: 25, name: 'Boże Narodzenie' },
  { m: 11, d: 26, name: 'Drugi dzień Bożego Narodzenia' },
];

function polishHolidayName(year: number, monthIndex: number, day: number): string | null {
  for (const h of FIXED_PL_HOLIDAYS) {
    if (h.m === monthIndex && h.d === day) return h.name;
  }
  const easter = easterSunday(year);
  const movable: Array<{ date: Date; name: string }> = [
    { date: easter, name: 'Niedziela Wielkanocna' },
    { date: addDays(easter, 1), name: 'Poniedziałek Wielkanocny' },
    { date: addDays(easter, 60), name: 'Boże Ciało' },
  ];
  for (const h of movable) {
    if (h.date.getFullYear() === year && h.date.getMonth() === monthIndex && h.date.getDate() === day) {
      return h.name;
    }
  }
  return null;
}

const MONTHS_NOM_PL = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
] as const;

const DOW_SHORT = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'] as const;

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildMonthGrid(year: number, monthIndex: number) {
  // Monday-first weeks — always 6 rows so month flips never resize the plate.
  const first = new Date(year, monthIndex, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<{ day: number; inMonth: boolean } | null> = [];
  for (let i = 0; i < startDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push({ day: d, inMonth: true });
  while (cells.length < 42) cells.push(null);
  return cells;
}

const MONTH_RETURN_MS = 20_000;

function EngravedMiniMonthCalendar({
  today,
  isDark,
  gold,
  width = 132,
}: {
  today: Date;
  isDark: boolean;
  gold: boolean;
  width?: number;
}) {
  const todayMonthKey = `${today.getFullYear()}-${today.getMonth()}`;
  const todayMonth = useMemo(() => startOfMonth(today), [todayMonthKey]);
  const [cursor, setCursor] = useState(() => startOfMonth(today));
  const [holidayTip, setHolidayTip] = useState<string | null>(null);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelOpacity = useRef(new Animated.Value(1)).current;
  const tipOpacity = useRef(new Animated.Value(0)).current;
  const userBrowsing = useRef(false);

  const clearReturnTimer = () => {
    if (returnTimer.current) {
      clearTimeout(returnTimer.current);
      returnTimer.current = null;
    }
  };

  const animateToTodayMonth = () => {
    Animated.timing(panelOpacity, {
      toValue: 0.22,
      duration: 420,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setCursor(startOfMonth(new Date()));
      userBrowsing.current = false;
      setHolidayTip(null);
      Animated.timing(panelOpacity, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const scheduleReturnToToday = () => {
    clearReturnTimer();
    userBrowsing.current = true;
    returnTimer.current = setTimeout(() => {
      returnTimer.current = null;
      animateToTodayMonth();
    }, MONTH_RETURN_MS);
  };

  useEffect(() => () => clearReturnTimer(), []);

  // Only snap back when the real calendar day rolls over — never every second tick.
  useEffect(() => {
    if (!userBrowsing.current) {
      setCursor(todayMonth);
    }
  }, [todayMonth]);

  const cells = useMemo(
    () => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  const ink = gold
    ? isDark
      ? 'rgba(58, 40, 8, 0.92)'
      : 'rgba(50, 34, 6, 0.82)'
    : isDark
      ? 'rgba(40,40,44,0.8)'
      : 'rgba(50,50,54,0.72)';
  const mute = gold
    ? isDark
      ? 'rgba(120, 90, 28, 0.52)'
      : 'rgba(100, 75, 20, 0.44)'
    : 'rgba(120,120,128,0.45)';
  const todayFill = gold
    ? isDark
      ? 'rgba(201, 162, 39, 0.28)'
      : 'rgba(201, 162, 39, 0.32)'
    : 'rgba(52,199,89,0.2)';
  const todayRing = gold
    ? isDark
      ? 'rgba(245, 223, 166, 0.72)'
      : 'rgba(120, 86, 18, 0.55)'
    : 'rgba(52,199,89,0.55)';
  const todayInk = gold ? (isDark ? '#F5DFA6' : '#3F2B05') : isDark ? '#FFFFFF' : '#000000';
  const festInk = isDark ? '#FF6B5C' : '#C41E2A';
  const festDow = isDark ? 'rgba(255, 107, 92, 0.88)' : 'rgba(196, 30, 42, 0.82)';
  const arrow = gold
    ? isDark
      ? 'rgba(201, 162, 39, 0.92)'
      : 'rgba(107, 76, 16, 0.8)'
    : '#8E8E93';
  const cell = Math.floor(width / 7);
  const rowH = cell - 1;
  const gridH = rowH * 6;
  const tipSlotH = 26;
  const isViewingTodayMonth =
    cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth();

  const shiftMonth = (delta: number) => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    tipOpacity.setValue(0);
    setHolidayTip(null);
    scheduleReturnToToday();
  };

  const showTip = (name: string | null) => {
    if (!name) {
      Animated.timing(tipOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setHolidayTip(null);
      });
      return;
    }
    setHolidayTip(name);
    tipOpacity.setValue(0);
    Animated.timing(tipOpacity, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const type = {
    ...(APPLE_TYPE ? { fontFamily: APPLE_TYPE } : null),
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums' as const],
  };

  const engravedNum = (festive: boolean, todayMark: boolean) => ({
    fontSize: 9,
    color: todayMark ? todayInk : festive ? festInk : ink,
    textShadowColor: festive
      ? isDark
        ? 'rgba(40,0,4,0.7)'
        : 'rgba(90,12,16,0.35)'
      : isDark
        ? 'rgba(0,0,0,0.72)'
        : 'rgba(40,28,6,0.4)',
    textShadowOffset: { width: 0.55, height: 1.05 },
    textShadowRadius: todayMark ? 2.4 : 1.5,
    fontWeight: todayMark ? ('800' as const) : ('700' as const),
  });

  return (
    <Animated.View style={[styles.miniCal, { width, opacity: panelOpacity }]}>
      <View style={styles.miniCalBody}>
        <View style={styles.miniCalHeader}>
          <Pressable
            onPress={() => shiftMonth(-1)}
            hitSlop={8}
            style={styles.miniCalArrow}
            accessibilityLabel="Poprzedni miesiąc"
          >
            <Ionicons name="chevron-back" size={12} color={arrow} />
          </Pressable>
          <View style={styles.miniCalTitleWrap}>
            <Text
              numberOfLines={1}
              pointerEvents="none"
              style={[
                type,
                styles.miniCalTitle,
                styles.miniCalTitleDepth,
                {
                  color: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(40,28,6,0.28)',
                },
              ]}
            >
              {MONTHS_NOM_PL[cursor.getMonth()]}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                type,
                styles.miniCalTitle,
                {
                  color: ink,
                  textShadowColor: isDark ? 'rgba(255, 240, 180, 0.28)' : 'rgba(255,255,255,0.55)',
                  textShadowOffset: { width: -0.35, height: -0.55 },
                  textShadowRadius: 1.2,
                },
              ]}
            >
              {MONTHS_NOM_PL[cursor.getMonth()]}
            </Text>
          </View>
          <Pressable
            onPress={() => shiftMonth(1)}
            hitSlop={8}
            style={styles.miniCalArrow}
            accessibilityLabel="Następny miesiąc"
          >
            <Ionicons name="chevron-forward" size={12} color={arrow} />
          </Pressable>
        </View>

        <View style={styles.miniCalDowRow}>
          {DOW_SHORT.map((label, i) => {
            const isSundayCol = i === 6;
            return (
              <Text
                key={`${label}-${i}`}
                style={[
                  type,
                  {
                    width: cell,
                    color: isSundayCol ? festDow : mute,
                    fontSize: 8,
                    textAlign: 'center',
                    textShadowColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(40,28,6,0.22)',
                    textShadowOffset: { width: 0.3, height: 0.65 },
                    textShadowRadius: 1,
                  },
                ]}
              >
                {label}
              </Text>
            );
          })}
        </View>

        <View style={[styles.miniCalGrid, { height: gridH }]}>
          {cells.map((cellData, index) => {
            if (!cellData) {
              return <View key={`e-${index}`} style={{ width: cell, height: rowH }} />;
            }
            const holiday = polishHolidayName(cursor.getFullYear(), cursor.getMonth(), cellData.day);
            const isToday = isViewingTodayMonth && cellData.day === today.getDate();
            const isSunday = index % 7 === 6;
            const isFestive = isSunday || Boolean(holiday);
            return (
              <Pressable
                key={`d-${index}`}
                accessibilityLabel={holiday ? `${cellData.day}, ${holiday}` : `${cellData.day}`}
                onHoverIn={() => {
                  if (holiday) showTip(holiday);
                }}
                onHoverOut={() => showTip(null)}
                onPress={() => {
                  if (holiday) {
                    showTip(holidayTip === holiday ? null : holiday);
                  } else {
                    showTip(null);
                  }
                }}
                style={[
                  styles.miniCalCell,
                  {
                    width: cell,
                    height: rowH,
                    borderRadius: rowH / 2,
                    backgroundColor: isToday
                      ? todayFill
                      : holiday && !isToday
                        ? isDark
                          ? 'rgba(196, 30, 42, 0.14)'
                          : 'rgba(196, 30, 42, 0.09)'
                        : 'transparent',
                    borderWidth: isToday ? 1.5 : 0,
                    borderColor: isToday ? todayRing : 'transparent',
                    shadowColor: isToday ? '#C9A227' : 'transparent',
                    shadowOffset: { width: 0, height: isToday ? 1 : 0 },
                    shadowOpacity: isToday ? 0.4 : 0,
                    shadowRadius: isToday ? 3 : 0,
                    elevation: isToday ? 2 : 0,
                  },
                ]}
              >
                <View style={styles.miniCalDayCarve}>
                  <Text
                    pointerEvents="none"
                    style={[
                      type,
                      styles.miniCalDayDepth,
                      engravedNum(isFestive, isToday),
                      {
                        color: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(40,28,6,0.22)',
                        textShadowRadius: 0,
                      },
                    ]}
                  >
                    {cellData.day}
                  </Text>
                  <Text style={[type, engravedNum(isFestive, isToday)]}>{cellData.day}</Text>
                  <Text
                    pointerEvents="none"
                    style={[
                      type,
                      styles.miniCalDayLip,
                      engravedNum(isFestive, isToday),
                      {
                        color: isDark
                          ? isFestive
                            ? 'rgba(255, 180, 170, 0.35)'
                            : 'rgba(255, 236, 180, 0.32)'
                          : 'rgba(255,255,255,0.55)',
                        textShadowRadius: 0,
                      },
                    ]}
                  >
                    {cellData.day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.miniCalTipSlot, { height: tipSlotH }]}>
        <Animated.View pointerEvents="none" style={[styles.miniCalTip, { opacity: tipOpacity }]}>
          {holidayTip ? (
            <>
              <Text
                numberOfLines={2}
                pointerEvents="none"
                style={[
                  type,
                  styles.miniCalTipDepth,
                  {
                    color: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(40,28,6,0.25)',
                  },
                ]}
              >
                {holidayTip}
              </Text>
              <Text
                numberOfLines={2}
                style={[
                  type,
                  styles.miniCalTipText,
                  {
                    color: ink,
                    textShadowColor: isDark ? 'rgba(255, 240, 180, 0.22)' : 'rgba(255,255,255,0.5)',
                    textShadowOffset: { width: -0.3, height: -0.45 },
                    textShadowRadius: 1,
                  },
                ]}
              >
                {holidayTip}
              </Text>
            </>
          ) : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function EngravedDateBeside({
  date,
  isDark,
  gold,
  height,
  gleam,
}: {
  date: Date;
  isDark: boolean;
  gold: boolean;
  height: number;
  gleam: Animated.Value;
}) {
  const parts = useMemo(() => formatEngravedParts(date), [date]);
  const daySize = height >= 160 ? 22 : 19;
  const monthSize = height >= 160 ? 14 : 13;
  const weekSize = height >= 160 ? 12 : 11;
  const yearSize = height >= 160 ? 13 : 12;

  const shine = gleam.interpolate({
    inputRange: [0, 0.4, 0.55, 1],
    outputRange: [0.96, 1, 0.98, 0.96],
  });

  return (
    <Animated.View
      style={[
        styles.dateCarve,
        {
          opacity: shine,
        },
      ]}
    >
      <EngravedLine text={parts.weekday} size={weekSize} isDark={isDark} gold={gold} letterSpacing={0.7} />
      <View style={styles.dateHairline}>
        <View
          style={[
            styles.dateHairlineFill,
            {
              backgroundColor: gold
                ? isDark
                  ? 'rgba(201,162,39,0.35)'
                  : 'rgba(120,86,18,0.28)'
                : 'rgba(0,0,0,0.15)',
            },
          ]}
        />
      </View>
      <EngravedLine
        text={parts.dayNum}
        size={daySize}
        isDark={isDark}
        gold={gold}
        letterSpacing={1.2}
        emphasis="hero"
        gleam={gleam}
      />
      <EngravedLine text={parts.monthWord} size={monthSize} isDark={isDark} gold={gold} letterSpacing={0.5} />
      <View style={styles.dateGapSm} />
      <EngravedLine text={parts.year} size={yearSize} isDark={isDark} gold={gold} letterSpacing={1.8} />
    </Animated.View>
  );
}

function AnalogAppleClock({
  size = 180,
  isDark = true,
  accent = '#34C759',
  variant = 'steel',
  brandLine,
  showEngravedDate = true,
}: Props) {
  const gold = variant === 'gold';
  const red = variant === 'red';
  const uid = useId().replace(/:/g, '');
  const [time, setTime] = useState(() => new Date());
  const gleam = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2200),
        Animated.timing(gleam, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(gleam, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(3800),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [gleam]);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const secondAngle = seconds * 6;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const hourAngle = (hours + minutes / 60) * 30;

  const radius = size / 2;
  const center = radius;
  const bezelWidth = 12;
  const innerRadius = radius - bezelWidth;
  const dayOfMonth = time.getDate();
  const brand = useMemo(() => truncateBrand(brandLine), [brandLine]);

  const dialFill = red
    ? isDark
      ? '#14090A'
      : '#FBEFEE'
    : gold
      ? isDark
        ? '#0A0803'
        : '#FBF4DF'
      : isDark
        ? '#0F0F11'
        : '#F7F7FA';

  const hourTick = gold ? (isDark ? '#F8E7B0' : '#6B4C10') : isDark ? '#FFFFFF' : '#1C1C1E';
  const hourTickShade = gold ? (isDark ? 'rgba(40,28,5,0.92)' : 'rgba(40,28,5,0.42)') : 'rgba(0,0,0,0.4)';
  const minuteTick = gold
    ? isDark
      ? 'rgba(255,214,120,0.82)'
      : 'rgba(140,100,20,0.6)'
    : isDark
      ? 'rgba(255,255,255,0.28)'
      : 'rgba(0,0,0,0.22)';
  const handFill = gold ? (isDark ? '#EFD9A4' : '#5A3F0A') : isDark ? '#E5E5EA' : '#2C2C2E';
  const handShade = 'rgba(0,0,0,0.55)';
  const secondColor = '#FF3B30';

  const gleamX = gleam.interpolate({
    inputRange: [0, 1],
    outputRange: [-size * 0.35, size * 0.85],
  });
  const gleamOpacity = gleam.interpolate({
    inputRange: [0, 0.35, 0.55, 1],
    outputRange: [0, 0.58, 0.32, 0],
  });

  const dial = (
    <View
      style={[
        styles.outerRing,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: gold
            ? isDark
              ? '#1A1408'
              : '#E8D090'
            : red
              ? isDark
                ? '#1A0C0D'
                : '#F4D8D4'
              : isDark
                ? '#141416'
                : '#E8E8ED',
          shadowColor: gold ? '#C9A227' : '#000',
        },
      ]}
    >
      {gold ? (
        <View
          pointerEvents="none"
          style={[
            styles.ambientGlow,
            {
              width: size + 28,
              height: size + 28,
              borderRadius: (size + 28) / 2,
              left: -14,
              top: -14,
            },
          ]}
        />
      ) : null}

      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={`caseBody-${uid}`} cx="30%" cy="26%" r="80%">
            <Stop offset="0%" stopColor={gold ? (isDark ? '#FFF8E8' : '#FFFBEA') : '#FFFFFF'} stopOpacity={1} />
            <Stop offset="18%" stopColor={gold ? (isDark ? '#F0D878' : '#F5E4A8') : '#E8E8ED'} stopOpacity={1} />
            <Stop offset="40%" stopColor={gold ? (isDark ? '#C9A227' : '#D4B24A') : '#AEAEB2'} stopOpacity={1} />
            <Stop offset="62%" stopColor={gold ? (isDark ? '#7A5C12' : '#A88828') : '#8E8E93'} stopOpacity={1} />
            <Stop offset="82%" stopColor={gold ? (isDark ? '#3A2A08' : '#6B5420') : '#636366'} stopOpacity={1} />
            <Stop offset="100%" stopColor={gold ? (isDark ? '#100C04' : '#3A2A10') : '#1C1C1E'} stopOpacity={1} />
          </RadialGradient>
          <LinearGradient id={`bezelRim-${uid}`} x1="12%" y1="0%" x2="88%" y2="100%">
            <Stop offset="0%" stopColor={gold ? '#FFFCF0' : '#FFFFFF'} stopOpacity={1} />
            <Stop offset="16%" stopColor={gold ? '#F5E08A' : '#D1D1D6'} stopOpacity={0.95} />
            <Stop offset="38%" stopColor={gold ? '#8A6A14' : '#8E8E93'} stopOpacity={0.95} />
            <Stop offset="58%" stopColor={gold ? '#E8D090' : '#C7C7CC'} stopOpacity={0.75} />
            <Stop offset="78%" stopColor={gold ? '#5C4510' : '#636366'} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={gold ? '#1A1206' : '#2C2C2E'} stopOpacity={1} />
          </LinearGradient>
          <RadialGradient id={`dialShade-${uid}`} cx="34%" cy="28%" r="76%">
            <Stop offset="0%" stopColor={isDark ? '#3A2E14' : '#FFFFFF'} stopOpacity={gold ? 0.75 : 0.4} />
            <Stop offset="32%" stopColor={dialFill} stopOpacity={1} />
            <Stop offset="72%" stopColor={isDark ? '#060503' : '#E0D0A0'} stopOpacity={1} />
            <Stop offset="100%" stopColor={isDark ? '#000000' : '#B8A474'} stopOpacity={1} />
          </RadialGradient>
          <RadialGradient id={`dialVignette-${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="48%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={isDark ? 0.62 : 0.26} />
          </RadialGradient>
          <LinearGradient id={`handHighlight-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.65} />
            <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={0.04} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.42} />
          </LinearGradient>
          <LinearGradient id={`specularArc-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="32%" stopColor="#FFFFFF" stopOpacity={0.62} />
            <Stop offset="48%" stopColor="#FFF8E0" stopOpacity={0.18} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Circle cx={center} cy={center} r={radius - 0.5} fill={`url(#caseBody-${uid})`} />

        <Circle cx={center} cy={center} r={radius - 1.2} fill="none" stroke={`url(#bezelRim-${uid})`} strokeWidth={5.2} />
        <Circle
          cx={center}
          cy={center}
          r={radius - 3.8}
          fill="none"
          stroke={gold ? (isDark ? 'rgba(255,250,230,0.55)' : 'rgba(255,255,255,0.6)') : 'rgba(255,255,255,0.35)'}
          strokeWidth={1.35}
        />
        <Circle cx={center} cy={center} r={radius - 6.2} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={2.2} />
        <Circle
          cx={center}
          cy={center}
          r={radius - 8}
          fill="none"
          stroke={gold ? 'rgba(255,220,140,0.2)' : 'rgba(255,255,255,0.08)'}
          strokeWidth={1}
        />

        <Circle
          cx={center}
          cy={center}
          r={innerRadius + 4}
          fill="none"
          stroke={gold ? (isDark ? 'rgba(180,140,30,0.6)' : 'rgba(120,86,18,0.45)') : 'rgba(0,0,0,0.22)'}
          strokeWidth={5.5}
        />
        <Circle cx={center} cy={center} r={innerRadius + 1.4} fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth={2.8} />
        <Circle
          cx={center}
          cy={center}
          r={innerRadius + 0.35}
          fill="none"
          stroke={gold ? 'rgba(255,230,160,0.28)' : 'rgba(255,255,255,0.12)'}
          strokeWidth={1}
        />

        <Circle cx={center} cy={center} r={innerRadius} fill={`url(#dialShade-${uid})`} />
        <Circle cx={center} cy={center} r={innerRadius} fill={`url(#dialVignette-${uid})`} />

        <Ellipse
          cx={center - radius * 0.2}
          cy={center - radius * 0.24}
          rx={radius * 0.3}
          ry={radius * 0.19}
          fill={gold ? 'rgba(255,242,200,0.14)' : 'rgba(255,255,255,0.08)'}
        />

        {Array.from({ length: 60 }).map((_, i) => {
          if (i % 5 === 0) return null;
          const angle = (i * 6 * Math.PI) / 180;
          const r1 = innerRadius - 2.5;
          const r2 = innerRadius - 8.5;
          const x1 = center + r1 * Math.sin(angle);
          const y1 = center - r1 * Math.cos(angle);
          const x2 = center + r2 * Math.sin(angle);
          const y2 = center - r2 * Math.cos(angle);
          return (
            <G key={`tick-${i}`}>
              <Line x1={x1 + 0.7} y1={y1 + 0.7} x2={x2 + 0.7} y2={y2 + 0.7} stroke="rgba(0,0,0,0.42)" strokeWidth={1.3} />
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={minuteTick} strokeWidth={1.45} strokeLinecap="round" />
              <Line
                x1={x1 - 0.35}
                y1={y1 - 0.35}
                x2={x2 - 0.35}
                y2={y2 - 0.35}
                stroke={gold ? 'rgba(255,248,220,0.4)' : 'rgba(255,255,255,0.25)'}
                strokeWidth={0.75}
                strokeLinecap="round"
              />
            </G>
          );
        })}

        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const r1 = innerRadius - 2.5;
          const r2 = innerRadius - 17;
          const x1 = center + r1 * Math.sin(angle);
          const y1 = center - r1 * Math.cos(angle);
          const x2 = center + r2 * Math.sin(angle);
          const y2 = center - r2 * Math.cos(angle);
          const w = i % 3 === 0 ? 3.7 : 2.55;
          return (
            <G key={`hour-${i}`}>
              <Line
                x1={x1 + 1.05}
                y1={y1 + 1.05}
                x2={x2 + 1.05}
                y2={y2 + 1.05}
                stroke={hourTickShade}
                strokeWidth={w + 1.1}
                strokeLinecap="round"
              />
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={hourTick} strokeWidth={w} strokeLinecap="round" />
              <Line
                x1={x1 - 0.55}
                y1={y1 - 0.55}
                x2={x2 - 0.55}
                y2={y2 - 0.55}
                stroke={gold ? 'rgba(255,252,235,0.7)' : 'rgba(255,255,255,0.45)'}
                strokeWidth={Math.max(1, w - 1.5)}
                strokeLinecap="round"
              />
            </G>
          );
        })}

        <SvgText
          x={center + 0.5}
          y={center - radius * 0.32 + 0.6}
          textAnchor="middle"
          fill="rgba(0,0,0,0.5)"
          fontSize={8}
          fontWeight="900"
          letterSpacing={2}
        >
          ESTATEOS
        </SvgText>
        <SvgText
          x={center}
          y={center - radius * 0.32}
          textAnchor="middle"
          fill={
            gold
              ? isDark
                ? 'rgba(245,223,166,0.72)'
                : 'rgba(107,76,16,0.65)'
              : isDark
                ? 'rgba(255,255,255,0.45)'
                : 'rgba(0,0,0,0.45)'
          }
          fontSize={8}
          fontWeight="900"
          letterSpacing={2}
        >
          ESTATEOS
        </SvgText>
        <SvgText
          x={center}
          y={center - radius * 0.22}
          textAnchor="middle"
          fill={accent}
          fontSize={brand.length > 12 ? 5.5 : 6.5}
          fontWeight="800"
          letterSpacing={0.8}
        >
          {brand}
        </SvgText>

        <G transform={`translate(${center + radius * 0.4}, ${center - 10})`}>
          <Rect x={1} y={1.2} width={20} height={20} rx={4} fill="rgba(0,0,0,0.55)" />
          <Rect
            x={0}
            y={0}
            width={20}
            height={20}
            rx={4}
            fill={gold ? (isDark ? '#141008' : '#FFFDF3') : isDark ? '#1C1C1E' : '#FFFFFF'}
            stroke={gold ? (isDark ? 'rgba(255,226,163,0.45)' : 'rgba(120,86,18,0.4)') : 'rgba(255,255,255,0.2)'}
            strokeWidth={1}
          />
          <SvgText
            x={10.5}
            y={14.5}
            textAnchor="middle"
            fill={gold ? (isDark ? '#F7E7BC' : '#4F3808') : isDark ? '#FFFFFF' : '#000000'}
            fontSize={11}
            fontWeight="900"
          >
            {dayOfMonth}
          </SvgText>
        </G>

        <G transform={`rotate(${hourAngle}, ${center}, ${center})`}>
          <Rect x={center - 2} y={center - radius * 0.45} width={6.5} height={radius * 0.5} rx={3} fill={handShade} opacity={0.65} />
          <Rect x={center - 3} y={center - radius * 0.48} width={6} height={radius * 0.52} rx={3} fill={handFill} />
          <Rect
            x={center - 1.5}
            y={center - radius * 0.46}
            width={2.2}
            height={radius * 0.4}
            rx={1.1}
            fill={`url(#handHighlight-${uid})`}
          />
        </G>

        <G transform={`rotate(${minuteAngle}, ${center}, ${center})`}>
          <Rect x={center - 1} y={center - radius * 0.69} width={4.2} height={radius * 0.74} rx={2} fill={handShade} opacity={0.58} />
          <Rect
            x={center - 2}
            y={center - radius * 0.72}
            width={4}
            height={radius * 0.76}
            rx={2}
            fill={gold ? (isDark ? '#FFF6DC' : '#3F2B05') : isDark ? '#FFFFFF' : '#000000'}
          />
          <Rect
            x={center - 0.85}
            y={center - radius * 0.7}
            width={1.4}
            height={radius * 0.58}
            rx={0.7}
            fill={`url(#handHighlight-${uid})`}
          />
        </G>

        <G transform={`rotate(${secondAngle}, ${center}, ${center})`}>
          <Line
            x1={center + 0.9}
            y1={center + 15}
            x2={center + 0.9}
            y2={center - radius * 0.8}
            stroke="rgba(0,0,0,0.42)"
            strokeWidth={1.9}
          />
          <Line
            x1={center}
            y1={center + 14}
            x2={center}
            y2={center - radius * 0.82}
            stroke={secondColor}
            strokeWidth={1.55}
            strokeLinecap="round"
          />
          <Circle cx={center} cy={center - radius * 0.62} r={3.1} fill={secondColor} />
          <Circle cx={center} cy={center - radius * 0.62} r={1.15} fill="rgba(255,255,255,0.5)" />
          <Circle cx={center} cy={center + 12} r={2.3} fill={secondColor} />
        </G>

        <Circle cx={center + 0.7} cy={center + 0.9} r={5.4} fill="rgba(0,0,0,0.48)" />
        <Circle
          cx={center}
          cy={center}
          r={5.1}
          fill={gold ? (isDark ? '#FFF6DC' : '#3F2B05') : isDark ? '#FFFFFF' : '#000000'}
        />
        <Circle cx={center} cy={center} r={2.7} fill={secondColor} />
        <Circle cx={center - 0.7} cy={center - 0.9} r={1.15} fill="rgba(255,255,255,0.62)" />

        <Path
          d={`M ${center - radius * 0.72} ${center - radius * 0.55}
              A ${radius * 0.85} ${radius * 0.85} 0 0 1 ${center + radius * 0.15} ${center - radius * 0.78}`}
          fill="none"
          stroke={`url(#specularArc-${uid})`}
          strokeWidth={3.4}
          strokeLinecap="round"
          opacity={0.75}
        />
      </Svg>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.gleamSweep,
          {
            height: size,
            width: size * 0.22,
            opacity: gleamOpacity,
            transform: [{ translateX: gleamX }, { skewX: '-18deg' }],
          },
        ]}
      />
    </View>
  );

  if (!showEngravedDate) {
    return <View style={[styles.wrapper, { width: size, height: size }]}>{dial}</View>;
  }

  // One rigid assembly — clock + engraved date + mini month calendar.
  return (
    <View collapsable={false} style={styles.assembly}>
      {dial}
      <View style={styles.sideStack}>
        <EngravedDateBeside date={time} isDark={isDark} gold={gold || red} height={size} gleam={gleam} />
        <EngravedMiniMonthCalendar today={time} isDark={isDark} gold={gold || red} width={132} />
      </View>
    </View>
  );
}

export default memo(AnalogAppleClock);

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 8,
  },
  assembly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 12,
    marginVertical: 6,
  },
  sideStack: {
    justifyContent: 'center',
    gap: 6,
    maxWidth: 138,
  },
  outerRing: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.58,
    shadowRadius: 22,
    elevation: 16,
  },
  ambientGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(201,162,39,0.2)',
  },
  gleamSweep: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(255,248,220,0.38)',
  },
  dateCarve: {
    maxWidth: 138,
    paddingLeft: 2,
    paddingVertical: 0,
  },
  dateGap: { height: 6 },
  dateGapSm: { height: 4 },
  dateHairline: {
    height: 7,
    justifyContent: 'center',
    paddingRight: 6,
  },
  dateHairlineFill: {
    height: StyleSheet.hairlineWidth * 2,
    width: '68%',
    borderRadius: 1,
    opacity: 0.9,
  },
  engraveWrap: {
    position: 'relative',
  },
  engraveLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  miniCal: {
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  miniCalBody: {
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  miniCalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
    gap: 2,
  },
  miniCalArrow: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCalTitleWrap: {
    flex: 1,
    position: 'relative',
    height: 14,
    justifyContent: 'center',
  },
  miniCalTitle: {
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.15,
  },
  miniCalTitleDepth: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 1.1,
  },
  miniCalDowRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  miniCalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  miniCalCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCalDayCarve: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCalDayDepth: {
    position: 'absolute',
    top: 1.05,
    left: 0.55,
  },
  miniCalDayLip: {
    position: 'absolute',
    top: -0.55,
    left: -0.4,
  },
  miniCalTipSlot: {
    marginTop: 3,
    width: '100%',
    justifyContent: 'center',
  },
  miniCalTip: {
    position: 'relative',
    paddingHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCalTipText: {
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  miniCalTipDepth: {
    position: 'absolute',
    left: 2,
    right: 2,
    top: 1,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 0.15,
    textAlign: 'center',
  },
});
