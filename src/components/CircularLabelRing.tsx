/**
 * ====================================================================
 *  EstateOS™ — Etykieta po okręgu dla okrągłych przycisków FAB
 * ====================================================================
 *
 *  Renderuje tekst ułożony po łuku okręgu (jak grawer na zegarku Apple
 *  Watch wokół tarczy), używając SVG + `TextPath`. Domyślnie wspiera dwa
 *  warianty:
 *
 *    • `arcPosition='top'`    — łuk GÓRNY, czytany od lewej do prawej.
 *      Używamy przy stanie „plus" (Dodaj ofertę) — etykieta zwisa nad
 *      okrągłym przyciskiem jak korona.
 *
 *    • `arcPosition='bottom'` — łuk DOLNY, czytany od lewej do prawej.
 *      Używamy przy stanie „strzałka dalej" — etykieta siedzi pod
 *      przyciskiem jak data na rolexie.
 *
 *  Dla efektu „zanurzenia liter do połowy w szkle Apple" oferujemy prop
 *  `submerge`. Po włączeniu, na fill tekstu nakładamy gradient liniowy
 *  z `userSpaceOnUse`:
 *
 *    • dla `arcPosition='top'`    — gradient FADE-OUT do dołu liter,
 *      więc górne piksele liter zostają jasne, dolne rozpływają się w
 *      półprzezroczystość — symulując „wynurzanie się ze szkła".
 *    • dla `arcPosition='bottom'` — gradient FADE-OUT do GÓRY liter,
 *      bo „szkło" tab bara w tym przypadku jest NAD literami.
 *
 *  Komponent jest BEZSTANOWY i `pointerEvents='none'` — leży tylko jako
 *  warstwa wizualna nad/wokół FAB i NIGDY nie kradnie gestów. Wszystkie
 *  rozmiary są wyliczane z propsów (`buttonDiameter`, `gap`), więc można
 *  go bez bólu podpiąć pod inne okrągłe przyciski w przyszłości.
 *
 *  Geometria SVG (dla CW/CCW): patrz komentarz `arcPath()` poniżej.
 */

import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Text as SvgText, TextPath } from 'react-native-svg';

type Props = {
  /** Tekst do wyrysowania. Wewnętrznie zamieniamy na UPPERCASE i rozkładamy
   *  na łuku za pomocą `letterSpacing`. */
  text: string;
  /** Pozycja łuku — góra lub dół FAB. */
  arcPosition: 'top' | 'bottom';
  /**
   * Średnica okrągłego przycisku, NA KTÓRYM osadzamy etykietę. Etykieta
   * wyląduje na łuku o promieniu = (buttonDiameter / 2) + `gap`.
   */
  buttonDiameter: number;
  /** Odstęp między krawędzią przycisku a literami (px). Default: 14. */
  gap?: number;
  /** Rozmiar czcionki (px). Default: 11. */
  fontSize?: number;
  /** Letter-spacing. Default: 2.2. */
  letterSpacing?: number;
  /** Główny kolor tekstu. */
  color?: string;
  /**
   * Kolor obrysu (stroke) — dodaje cienką poświatę dla czytelności na
   * dowolnym tle. Default: półprzezroczyste czarne dla jasnego motywu.
   */
  strokeColor?: string;
  /** Grubość obrysu. Default: 0.4. */
  strokeWidth?: number;
  /**
   * Procent łuku jaki ma zajmować tekst (0..1). 0.5 oznacza pół-łuku
   * (180°). 0.62 daje dłuższy łuk, lepiej rozłożone „DODAJ OFERTĘ". Default 0.62.
   */
  arcFraction?: number;
  /**
   * Przesunięcie etykiety w pionie względem środka kontenera (px). Dodatnie
   * wartości przesuwają w DÓŁ, ujemne w GÓRĘ. Używamy do „zanurzenia"
   * etykiety w obszar szklanego tab bara.
   */
  verticalOffset?: number;
  /**
   * Włącza efekt 3D — gradient FADE na fill tekstu od pełnej opacity
   * (strona „daleko od szkła") do prawie zera (strona „blisko szkła"),
   * dzięki czemu dolna połowa liter (dla `top` arc) rozpływa się w mgle,
   * tworząc iluzję wynurzania się grawerunku z taflowej powierzchni.
   * Default: false (litery pełne, bez maskowania).
   */
  submerge?: boolean;
  /**
   * Jak ostre ma być zanikanie liter (0..1). 0.5 oznacza że dokładnie pół
   * litery znika; 0.35 że dolne ~65% litery znika (mocniejszy efekt);
   * 0.7 że tylko sama końcówka znika. Default: 0.42 — Apple-glass premium.
   */
  submergeMidpoint?: number;
};

/**
 * Buduje atrybut `d` ścieżki SVG odpowiadającej łukowi:
 *   • `top`    — od (cx-r, cy) PO GÓRZE do (cx+r, cy), kierunek CW (sweep=1).
 *                Litery są obrócone tak, że góra znaku celuje w niebo —
 *                tekst czytamy normalnie od lewej do prawej.
 *   • `bottom` — od (cx-r, cy) PO DOLE do (cx+r, cy), kierunek CCW (sweep=0).
 *                Litery są obrócone głowami w stronę środka koła (czyli
 *                w górę ekranu) — tekst dalej czytamy od lewej do prawej.
 */
function arcPath(cx: number, cy: number, r: number, arcPosition: 'top' | 'bottom', arcFraction: number) {
  const totalRad = Math.PI * arcFraction * 2;
  const halfRad = totalRad / 2;
  const centerAngle = arcPosition === 'top' ? -Math.PI / 2 : Math.PI / 2;
  const startAngle = arcPosition === 'top' ? centerAngle - halfRad : centerAngle + halfRad;
  const endAngle   = arcPosition === 'top' ? centerAngle + halfRad : centerAngle - halfRad;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = arcFraction > 0.5 ? 1 : 0;
  const sweep = arcPosition === 'top' ? 1 : 0;
  return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2.toFixed(3)} ${y2.toFixed(3)}`;
}

export default function CircularLabelRing({
  text,
  arcPosition,
  buttonDiameter,
  gap = 14,
  fontSize = 11,
  letterSpacing = 2.2,
  color = '#FFFFFF',
  strokeColor,
  strokeWidth = 0.4,
  arcFraction = 0.62,
  verticalOffset = 0,
  submerge = false,
  submergeMidpoint = 0.42,
}: Props) {
  const safeText = String(text || '').trim().toUpperCase();

  // Promień łuku: środek przycisku + odstęp + pół fontu (żeby baseline
  // tekstu siedział równo nad/pod krawędzią).
  const r = buttonDiameter / 2 + gap + fontSize / 2;
  // SVG-box: zostawiamy zapas po obu stronach na zewnętrzne litery
  // (dla większego letter-spacing tekst odstaje od idealnego łuku
  // o ~10–14 px, więc bezpieczny padding = fontSize × 2).
  const padding = fontSize * 2;
  const boxSize = (r + padding) * 2;
  const cx = boxSize / 2;
  const cy = boxSize / 2;

  const pathId = useMemo(
    () => `arc-${arcPosition}-${Math.round(r)}-${arcFraction.toFixed(2)}`,
    [arcPosition, r, arcFraction],
  );
  const fadeId = useMemo(
    () => `fade-${arcPosition}-${Math.round(r)}-${submergeMidpoint.toFixed(2)}`,
    [arcPosition, r, submergeMidpoint],
  );
  const d = useMemo(
    () => arcPath(cx, cy, r, arcPosition, arcFraction),
    [cx, cy, r, arcPosition, arcFraction],
  );

  const effectiveStroke = strokeColor ?? 'rgba(0,0,0,0.32)';

  // ----------------------------------------------------------------
  //  GRADIENT ZANURZENIA
  // ----------------------------------------------------------------
  //  Litery na łuku top są pisane „głowami do nieba" (cap-line wyżej
  //  niż baseline). Baseline tangencjalnej linii TextPath leży DOKŁADNIE
  //  na łuku (y = cy − r dla top, y = cy + r dla bottom). Cap-line jest
  //  ~fontSize wyżej (mniejsze y) dla `top`, niżej (większe y) dla `bottom`.
  //
  //  Dla efektu 3D-zanurzenia w szkło Apple chcemy aby strona BLIŻSZA
  //  szkła była przezroczysta. „Szkło" — czyli tab bar — jest ZAWSZE
  //  POD przyciskiem (na dole ekranu). Więc:
  //    • dla `top`    — fade idzie z GÓRY (jasno) do DOŁU liter (znika),
  //    • dla `bottom` — fade idzie z DOŁU (jasno) do GÓRY liter (znika),
  //      bo dla bottom-arc dolna krawędź liter jest „dalej" od szkła
  //      (litery są obrócone i ich „top of letter" celuje w górę ekranu,
  //      ale wizualnie dół ekranu = bliżej tab bara).
  //
  //  W praktyce, dla bottom-arc litery są na łuku poniżej środka SVG,
  //  ale ich „top of letter" celuje w górę ekranu (czyli y MNIEJSZE), bo
  //  zewnętrzna styczna idzie w stronę GÓRY ekranu. Czyli y_capLine_bottom
  //  ≈ cy + r − fontSize, y_baseline_bottom ≈ cy + r. Strona „blisko
  //  szkła" to baseline (y większe), strona „daleko" to capline (y mniejsze).
  //  → fade idzie z capline (jasno) do baseline (znika). Spójnie z top.
  //
  //  Czyli w obu przypadkach gradient idzie z BAR DALSZA od szkła →
  //  bliższa szkła, czyli z MNIEJSZEGO y → WIĘKSZE y. Spójna konwencja.
  // ----------------------------------------------------------------
  const fadeY1 =
    arcPosition === 'top'
      ? cy - r - fontSize * 0.55          // ~capline liter top arc
      : cy + r - fontSize * 0.55;         // ~capline liter bottom arc
  const fadeY2 =
    arcPosition === 'top'
      ? cy - r + fontSize * 0.55          // baseline + lekki descender
      : cy + r + fontSize * 0.55;
  // Punkty pośrednie gradientu — `submergeMidpoint` mówi, w jakim miejscu
  // litera ma być już półprzezroczysta.
  const midA = Math.max(0, Math.min(1, submergeMidpoint - 0.06));
  const midB = Math.max(0, Math.min(1, submergeMidpoint));

  const fillAttribute = submerge ? `url(#${fadeId})` : color;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          width: boxSize,
          height: boxSize,
          // Centrujemy SVG dokładnie na środku przycisku — minus pół boxa,
          // plus opcjonalny `verticalOffset` (dodatni = w dół, ujemny = w górę).
          marginLeft: -boxSize / 2,
          marginTop: -boxSize / 2 + verticalOffset,
        },
      ]}
    >
      <Svg width={boxSize} height={boxSize} viewBox={`0 0 ${boxSize} ${boxSize}`}>
        <Defs>
          <Path id={pathId} d={d} fill="none" />
          {submerge ? (
            <LinearGradient
              id={fadeId}
              x1={cx}
              y1={fadeY1}
              x2={cx}
              y2={fadeY2}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={color} stopOpacity="1" />
              <Stop offset={String(midA)} stopColor={color} stopOpacity="0.95" />
              <Stop offset={String(midB)} stopColor={color} stopOpacity="0.55" />
              <Stop offset="0.78" stopColor={color} stopOpacity="0.18" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          ) : null}
        </Defs>
        {/*
          Render w TRZECH przebiegach, jak Apple grawer:
            (1) SOFT HALO — szeroki obrys (×2.4) o niskiej opacity, daje
                aureolę światła wokół liter — wzmacnia czytelność w light
                mode, gdzie biały fill ginąłby w mlecznym szkle.
            (2) HARD STROKE — wąski obrys (×1.0), buduje wyraźny kontur
                liter, daje optyczną masę i czytelność w obu motywach.
            (3) FILL z gradient fade — właściwy kolor liter, dolna połowa
                rozpływa się w „szkło" tab bara (efekt 3D zanurzenia).
          Każdy przebieg używa TEJ SAMEJ ścieżki TextPath, więc wszystkie
          warstwy są idealnie zsynchronizowane.
        */}
        {submerge ? (
          <SvgText
            fill="none"
            stroke={effectiveStroke}
            strokeOpacity={0.42}
            strokeWidth={strokeWidth * 2.4}
            strokeLinejoin="round"
            fontSize={fontSize}
            fontWeight="900"
            letterSpacing={letterSpacing}
            fontFamily={Platform.OS === 'ios' ? 'System' : 'sans-serif'}
            textAnchor="middle"
          >
            <TextPath href={`#${pathId}`} startOffset="50%">
              {safeText}
            </TextPath>
          </SvgText>
        ) : null}
        <SvgText
          fill="none"
          stroke={effectiveStroke}
          strokeWidth={submerge ? strokeWidth + 0.3 : strokeWidth}
          strokeLinejoin="round"
          fontSize={fontSize}
          fontWeight="900"
          letterSpacing={letterSpacing}
          fontFamily={Platform.OS === 'ios' ? 'System' : 'sans-serif'}
          textAnchor="middle"
        >
          <TextPath href={`#${pathId}`} startOffset="50%">
            {safeText}
          </TextPath>
        </SvgText>
        <SvgText
          fill={fillAttribute}
          stroke="none"
          fontSize={fontSize}
          fontWeight="900"
          letterSpacing={letterSpacing}
          // SF Rounded jeśli iOS — domyślnie systemowa, na iOS będzie
          // wyglądać jak Apple Watch grawer. Na Android fallback do roboto.
          fontFamily={Platform.OS === 'ios' ? 'System' : 'sans-serif'}
          textAnchor="middle"
        >
          <TextPath href={`#${pathId}`} startOffset="50%">
            {safeText}
          </TextPath>
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
});
