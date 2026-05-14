import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useThemeStore } from '../../store/useThemeStore';

type Props = {
  /** ISO daty startu prezentacji */
  presentationIso: string;
  /** Tekst pomocniczy nad odliczaniem */
  label?: string;
  /** Stonowany styl (modal) vs jaśniejszy (panel czatu / lista dealroomów) */
  variant?: 'panel' | 'modal';
};

function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, '0');
}

function computeParts(msLeft: number) {
  if (msLeft <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const days = Math.floor(msLeft / 86400000);
  const hours = Math.floor((msLeft % 86400000) / 3600000);
  const minutes = Math.floor((msLeft % 3600000) / 60000);
  const seconds = Math.floor((msLeft % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

/**
 * Pojedynczy „kafelek" jednostki czasu (np. DNI / GODZ / MIN / SEK).
 * Wewnątrz duża cyfra (Apple SF-style) + uppercase label pod.
 * `pulsing` = true tylko dla SEK, gdzie chcemy oddech.
 */
function CountdownUnit({
  value,
  label,
  isDark,
  accent,
  glowAccent,
  pulsing = false,
}: {
  value: string;
  label: string;
  isDark: boolean;
  accent: string;
  glowAccent: string;
  pulsing?: boolean;
}) {
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulsing) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, pulsing]);

  const opacity = pulsing ? breathe.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) : 1;

  /*
   * Tło kafelka — w trybie ciemnym używamy GŁĘBOKIEGO grafitu z lekkim
   * niebiesko-zielonym hue (matowy onyks, jak w Apple Vision / Watch).
   * To buduje wrażenie premium zamiast „taniego białego prostokąta"
   * (jak wcześniej, gdy bg = rgba(255,255,255,0.05) zlewało się z BlurView'em
   * karty dealroomu i wychodziło jasno-szare).
   */
  const tileBgPrimary = isDark ? 'rgba(20,28,28,0.92)' : 'rgba(255,255,255,0.95)';
  const tileBorder = isDark ? 'rgba(16,185,129,0.22)' : 'rgba(15,23,42,0.07)';
  const tileGlossColor = isDark ? 'rgba(52,211,153,0.10)' : 'rgba(255,255,255,0.85)';
  // Wewnętrzny highlight u góry (jaśniejsza krawędź dla 3D efektu kafelka).
  const tileInnerHighlight = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.0)';

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          backgroundColor: tileBgPrimary,
          borderColor: tileBorder,
          shadowColor: isDark ? glowAccent : accent,
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: isDark ? 14 : 10,
          opacity,
        },
      ]}
    >
      {/* TOP GLOSS — refleks (emerald w dark, white w light) na górnej krawędzi. */}
      <View
        pointerEvents="none"
        style={[styles.tileGloss, { backgroundColor: tileGlossColor }]}
      />
      {/* INNER HIGHLIGHT — cienka jasna linia na samej górze, daje 3D look. */}
      {isDark ? (
        <View pointerEvents="none" style={[styles.tileInnerHighlight, { backgroundColor: tileInnerHighlight }]} />
      ) : null}
      <Text
        style={[
          styles.tileValue,
          {
            color: isDark ? glowAccent : accent,
            textShadowColor: isDark ? `${glowAccent}AA` : 'transparent',
            textShadowRadius: isDark ? 12 : 8,
          },
        ]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.tileLabel,
          { color: isDark ? 'rgba(255,255,255,0.62)' : 'rgba(15,23,42,0.55)' },
        ]}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

/** Dwukropek między kafelkami — delikatny puls. */
function Sep({ isDark, accent }: { isDark: boolean; accent: string }) {
  const blink = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 0.45,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink]);

  return (
    <View style={styles.sepCol}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: accent, opacity: blink },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: accent, opacity: blink, marginTop: 6 },
        ]}
      />
    </View>
  );
}

export default function PresentationCountdown({
  presentationIso,
  label = 'DO PREZENTACJI POZOSTAŁO',
  variant = 'panel',
}: Props) {
  const targetMs = useMemo(() => new Date(presentationIso).getTime(), [presentationIso]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(targetMs)) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const msLeft = useMemo(() => targetMs - Date.now(), [targetMs, tick]);
  const parts = computeParts(msLeft);

  /*
   * Tryb ciemny — łączymy preferencję aplikacji (`useThemeStore`) z systemowym
   * `useColorScheme`. Dzięki temu komponent szanuje wybór użytkownika z ekranu
   * Profile (Auto/Light/Dark) i nie wpada w bug z poprzedniej wersji, gdzie
   * zegar pokazywał wersję jasną, mimo że cała aplikacja była ciemna.
   */
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'auto' && systemScheme === 'dark');

  if (!Number.isFinite(targetMs) || msLeft <= 0) return null;

  /*
   * Akcent — w dark mode dwustopniowy:
   *   • `accent`     — zielony „EstateOS™ baseline" do label dotu / cienia
   *     samego bloku,
   *   • `glowAccent` — JAŚNIEJSZY emerald (#34D399) używany do cyfr i top-glossu
   *     w kafelkach. Po ciemnym tle to on daje efekt „neonowego zegarka".
   * W modal-light wariancie używamy srebra zamiast emeraldu (mniej zawołań,
   * wykorzystywane tylko w `AppointmentActionModal`).
   */
  const accent = variant === 'modal' ? (isDark ? '#9ca3af' : '#475569') : '#10b981';
  const glowAccent = variant === 'modal' ? (isDark ? '#cbd5e1' : '#475569') : isDark ? '#34d399' : '#10b981';
  const labelColor = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(15,23,42,0.55)';

  /*
   * Tło CAŁEGO bloku — w dark mode rozjaśniamy go subtelną zieloną aurą,
   * a w light mode zostawiamy obecną szklaną powłokę. Brak prostego
   * `rgba(255,255,255,0.035)` z poprzedniej wersji, bo na BlurView karty
   * dealroomu wyglądał szaro-niedoprecyzowanie. Teraz to luksusowa szklana
   * powierzchnia z hue emerald i mocniejszą ramką.
   */
  const blockBg = isDark
    ? 'rgba(16,185,129,0.06)'
    : variant === 'panel'
      ? 'rgba(16,185,129,0.06)'
      : 'rgba(15,23,42,0.04)';
  const blockBorder = isDark
    ? 'rgba(16,185,129,0.32)'
    : variant === 'panel'
      ? 'rgba(16,185,129,0.22)'
      : 'rgba(15,23,42,0.08)';

  return (
    <View
      style={[
        styles.block,
        {
          backgroundColor: blockBg,
          borderColor: blockBorder,
          shadowColor: isDark ? glowAccent : 'transparent',
          shadowOpacity: isDark ? 0.18 : 0,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
        },
      ]}
    >
      <View style={styles.labelRow}>
        <View style={[styles.labelDot, { backgroundColor: glowAccent }]} />
        <Text style={[styles.labelText, { color: labelColor }]} allowFontScaling={false}>
          {label}
        </Text>
      </View>
      <View style={styles.row}>
        <CountdownUnit value={String(parts.days)} label="DNI" isDark={isDark} accent={accent} glowAccent={glowAccent} />
        <Sep isDark={isDark} accent={glowAccent} />
        <CountdownUnit value={pad2(parts.hours)} label="GODZ" isDark={isDark} accent={accent} glowAccent={glowAccent} />
        <Sep isDark={isDark} accent={glowAccent} />
        <CountdownUnit value={pad2(parts.minutes)} label="MIN" isDark={isDark} accent={accent} glowAccent={glowAccent} />
        <Sep isDark={isDark} accent={glowAccent} />
        <CountdownUnit value={pad2(parts.seconds)} label="SEK" isDark={isDark} accent={accent} glowAccent={glowAccent} pulsing />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  labelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  tile: {
    flex: 1,
    minHeight: 60,
    paddingTop: 8,
    paddingBottom: 7,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  tileGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 14,
    opacity: 0.55,
  },
  /*
   * Cieniutka jasna linia tuż pod krawędzią — daje efekt „rant kafelka" widziany
   * w skeumorficznych zegarkach Apple Watch. Tylko w dark mode.
   */
  tileInnerHighlight: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    height: StyleSheet.hairlineWidth,
    opacity: 0.9,
  },
  tileValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  tileLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  sepCol: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
