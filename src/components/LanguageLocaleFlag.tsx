import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';

export type LanguageFlagId = 'system' | 'pl' | 'en' | 'ru';

type Props = {
  id: LanguageFlagId;
  size?: number;
  active?: boolean;
  isDark?: boolean;
};

const FLAG_W = 30;
const FLAG_H = 20;

function FlagGloss({ glossId }: { glossId: string }) {
  return <Rect x={0} y={0} width={FLAG_W} height={FLAG_H} rx={4} fill={`url(#${glossId})`} />;
}

function PolandFlag({ glossId }: { glossId: string }) {
  return (
    <G>
      <Rect x={0} y={0} width={FLAG_W} height={FLAG_H / 2} fill="#FFFFFF" />
      <Rect x={0} y={FLAG_H / 2} width={FLAG_W} height={FLAG_H / 2} fill="#DC143C" />
      <FlagGloss glossId={glossId} />
    </G>
  );
}

function RussiaFlag({ glossId }: { glossId: string }) {
  const h = FLAG_H / 3;
  return (
    <G>
      <Rect x={0} y={0} width={FLAG_W} height={h} fill="#FFFFFF" />
      <Rect x={0} y={h} width={FLAG_W} height={h} fill="#0039A6" />
      <Rect x={0} y={h * 2} width={FLAG_W} height={h} fill="#D52B1E" />
      <FlagGloss glossId={glossId} />
    </G>
  );
}

/** Uproszczony Union Jack — czytelny w małym rozmiarze. */
function UkFlag({ glossId }: { glossId: string }) {
  return (
    <G>
      <Rect x={0} y={0} width={FLAG_W} height={FLAG_H} fill="#012169" />
      <Path
        d={`M0,0 L${FLAG_W},${FLAG_H} M${FLAG_W},0 L0,${FLAG_H}`}
        stroke="#FFFFFF"
        strokeWidth={3.2}
      />
      <Path
        d={`M0,0 L${FLAG_W},${FLAG_H} M${FLAG_W},0 L0,${FLAG_H}`}
        stroke="#C8102E"
        strokeWidth={1.4}
      />
      <Rect x={FLAG_W / 2 - 1.2} y={0} width={2.4} height={FLAG_H} fill="#FFFFFF" />
      <Rect x={0} y={FLAG_H / 2 - 1.2} width={FLAG_W} height={2.4} fill="#FFFFFF" />
      <Rect x={FLAG_W / 2 - 0.55} y={0} width={1.1} height={FLAG_H} fill="#C8102E" />
      <Rect x={0} y={FLAG_H / 2 - 0.55} width={FLAG_W} height={1.1} fill="#C8102E" />
      <FlagGloss glossId={glossId} />
    </G>
  );
}

function SystemGlobe() {
  const cx = FLAG_W / 2;
  const cy = FLAG_H / 2;
  const r = 8.5;
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill="#1C1C1E" />
      <Circle cx={cx} cy={cy} r={r - 0.6} fill="#2C2C2E" stroke="rgba(255,255,255,0.18)" strokeWidth={0.6} />
      <Circle cx={cx} cy={cy} r={r - 1.4} fill="none" stroke="rgba(120,200,255,0.55)" strokeWidth={0.7} />
      <Line x1={cx - r + 2} y1={cy} x2={cx + r - 2} y2={cy} stroke="rgba(255,255,255,0.35)" strokeWidth={0.6} />
      <Line x1={cx} y1={cy - r + 2} x2={cx} y2={cy + r - 2} stroke="rgba(255,255,255,0.35)" strokeWidth={0.6} />
      <Path
        d={`M ${cx - 5} ${cy - 3} Q ${cx} ${cy - 6} ${cx + 5} ${cy - 3}`}
        fill="none"
        stroke="rgba(52,199,89,0.75)"
        strokeWidth={0.7}
      />
      <Path
        d={`M ${cx - 5} ${cy + 3} Q ${cx} ${cy + 6} ${cx + 5} ${cy + 3}`}
        fill="none"
        stroke="rgba(52,199,89,0.55)"
        strokeWidth={0.7}
      />
      <Circle cx={cx - 2} cy={cy - 2} r={1.2} fill="rgba(255,255,255,0.5)" />
    </G>
  );
}

function FlagArt({ id, glossId }: { id: LanguageFlagId; glossId: string }) {
  switch (id) {
    case 'pl':
      return <PolandFlag glossId={glossId} />;
    case 'en':
      return <UkFlag glossId={glossId} />;
    case 'ru':
      return <RussiaFlag glossId={glossId} />;
    default:
      return <SystemGlobe />;
  }
}

/**
 * Flagi państw w stylu premium — SVG, zaokrąglone rogi, połysk i cienka obwódka.
 */
export default function LanguageLocaleFlag({ id, size = 22, active = true, isDark = true }: Props) {
  const rawId = useId();
  const glossId = `gloss-${rawId.replace(/:/g, '')}`;
  const rimId = `rim-${rawId.replace(/:/g, '')}`;
  const scale = size / FLAG_H;
  const width = FLAG_W * scale;
  const height = size;
  const dimmed = active ? 1 : isDark ? 0.55 : 0.65;

  return (
    <View style={[styles.wrap, { width: width + 4, height: height + 4, opacity: dimmed }]}>
      <View style={[styles.frame, { width, height, borderRadius: 5 * scale }]}>
        <Svg width={width} height={height} viewBox={`0 0 ${FLAG_W} ${FLAG_H}`}>
          <Defs>
            <SvgGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.35" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </SvgGradient>
            <SvgGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.42" />
              <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.08" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.12" />
            </SvgGradient>
          </Defs>
          <Rect x={0} y={0} width={FLAG_W} height={FLAG_H} rx={4} fill="#0A0A0A" />
          <FlagArt id={id} glossId={glossId} />
          <Rect
            x={0.5}
            y={0.5}
            width={FLAG_W - 1}
            height={FLAG_H - 1}
            rx={3.5}
            fill="none"
            stroke={`url(#${rimId})`}
            strokeWidth={0.6}
          />
        </Svg>
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'transparent']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 5 * scale }]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 3,
  },
});
