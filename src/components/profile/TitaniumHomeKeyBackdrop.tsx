import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  Line,
  Pattern,
  Rect,
} from 'react-native-svg';

export type MetalVariant = 'titanium' | 'gold';

type Props = {
  isDark: boolean;
  /** `gold` keeps every titanium effect and swaps only the alloy tone. */
  variant?: MetalVariant;
};

const DARK_TITANIUM = '#1C2129';
const DARK_GOLD = '#2A2214';

function lightPalette() {
  return {
    base: ['#A8B2C0', '#DDE3EA', '#F4F7FA', '#B4BECA', '#E4E9EF'] as const,
    undertone: ['#98A4B4', '#C8D0DA', '#F0F4F8', '#AEB8C6'] as const,
    brushLight: 'rgba(255, 255, 255, 0.95)',
    brushMid: 'rgba(220, 228, 238, 0.35)',
    brushShadow: 'rgba(55, 65, 85, 0.18)',
    glossHot: 'rgba(255, 255, 255, 0.95)',
    glossWarm: 'rgba(255, 252, 245, 0.35)',
    glossCool: 'rgba(220, 232, 255, 0.18)',
    specularCore: 'rgba(255, 255, 255, 0.98)',
    specularTail: 'rgba(235, 240, 248, 0.22)',
    rimLight: 'rgba(255, 255, 255, 0.88)',
    rimShadow: 'rgba(45, 55, 75, 0.22)',
    aoDeep: 'rgba(35, 45, 65, 0.28)',
    aoMid: 'rgba(60, 70, 90, 0.14)',
    vignette: 'rgba(45, 55, 75, 0.2)',
    edgeHighlight: 'rgba(255, 255, 255, 0.95)',
    edgeShadow: 'rgba(50, 60, 80, 0.22)',
    chromaticCool: 'rgba(170, 200, 255, 0.12)',
    chromaticWarm: 'rgba(255, 225, 190, 0.08)',
    svgHotSpot: ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0)'] as const,
    svgAoBr: ['rgba(0,0,0,0)', 'rgba(35,45,65,0.35)'] as const,
    svgAoTl: ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)'] as const,
  };
}

function lightGoldPalette() {
  return {
    base: ['#B98B2C', '#E4C275', '#FAF0CE', '#C89B38', '#EED9A2'] as const,
    undertone: ['#A87C20', '#D9B75F', '#F8EBC2', '#C0943A'] as const,
    brushLight: 'rgba(255, 252, 236, 0.95)',
    brushMid: 'rgba(240, 214, 150, 0.35)',
    brushShadow: 'rgba(96, 66, 12, 0.2)',
    glossHot: 'rgba(255, 253, 240, 0.95)',
    glossWarm: 'rgba(255, 240, 200, 0.38)',
    glossCool: 'rgba(255, 228, 172, 0.18)',
    specularCore: 'rgba(255, 255, 246, 0.98)',
    specularTail: 'rgba(250, 235, 194, 0.24)',
    rimLight: 'rgba(255, 250, 228, 0.88)',
    rimShadow: 'rgba(95, 66, 14, 0.24)',
    aoDeep: 'rgba(78, 52, 8, 0.28)',
    aoMid: 'rgba(104, 76, 22, 0.14)',
    vignette: 'rgba(92, 63, 12, 0.22)',
    edgeHighlight: 'rgba(255, 250, 228, 0.95)',
    edgeShadow: 'rgba(94, 65, 14, 0.24)',
    chromaticCool: 'rgba(255, 236, 190, 0.12)',
    chromaticWarm: 'rgba(255, 214, 150, 0.1)',
    svgHotSpot: ['rgba(255,252,235,0.72)', 'rgba(255,252,235,0)'] as const,
    svgAoBr: ['rgba(0,0,0,0)', 'rgba(78,52,8,0.35)'] as const,
    svgAoTl: ['rgba(255,250,228,0.28)', 'rgba(255,250,228,0)'] as const,
  };
}

function DarkUniformMetal({ variant }: { variant: MetalVariant }) {
  const gold = variant === 'gold';
  return (
    <View style={styles.root} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: gold ? DARK_GOLD : DARK_TITANIUM }]} />

      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <Pattern
            id={`ti-brush-dark-uniform-${variant}`}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(16)"
          >
            <Line x1="0" y1="0" x2="0" y2="5" stroke="rgba(0,0,0,0.22)" strokeWidth="0.65" opacity="0.55" />
            <Line
              x1="2.5"
              y1="0"
              x2="2.5"
              y2="5"
              stroke={gold ? 'rgba(255,225,160,0.06)' : 'rgba(255,255,255,0.04)'}
              strokeWidth="0.35"
              opacity="0.7"
            />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#ti-brush-dark-uniform-${variant})`} opacity="0.55" />
      </Svg>

      <LinearGradient
        colors={
          gold
            ? ['rgba(255,224,160,0.045)', 'transparent', 'rgba(255,224,160,0.025)']
            : ['rgba(255,255,255,0.025)', 'transparent', 'rgba(255,255,255,0.015)']
        }
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[StyleSheet.absoluteFill, styles.darkMicroSheen]}
      />

      <View
        style={[
          styles.bevelHighlight,
          { borderColor: gold ? 'rgba(255,226,163,0.16)' : 'rgba(255,255,255,0.08)' },
        ]}
      />
      <View style={[styles.bevelShadow, styles.darkBevelShadow]} />
    </View>
  );
}

export default function TitaniumHomeKeyBackdrop({ isDark, variant = 'titanium' }: Props) {
  const palette = useMemo(() => (variant === 'gold' ? lightGoldPalette() : lightPalette()), [variant]);

  if (isDark) {
    return <DarkUniformMetal variant={variant} />;
  }

  const brushId = `ti-brush-light-${variant}`;
  const fineId = `ti-fine-light-${variant}`;
  const crossId = `ti-cross-light-${variant}`;

  return (
    <View style={styles.root} pointerEvents="none">
      <LinearGradient colors={[...palette.base]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <LinearGradient
        colors={[...palette.undertone]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.undertoneWash]}
      />

      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <Pattern id={brushId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(16)">
            <Line x1="0" y1="0" x2="0" y2="5" stroke={palette.brushShadow} strokeWidth="0.7" opacity="0.7" />
            <Line x1="1.6" y1="0" x2="1.6" y2="5" stroke={palette.brushMid} strokeWidth="0.35" opacity="0.55" />
            <Line x1="3.2" y1="0" x2="3.2" y2="5" stroke={palette.brushLight} strokeWidth="0.45" opacity="0.85" />
          </Pattern>

          <Pattern id={fineId} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(16)">
            <Line x1="0" y1="0" x2="0" y2="3" stroke={palette.brushLight} strokeWidth="0.25" opacity="0.35" />
          </Pattern>

          <Pattern id={crossId} width="18" height="18" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="9" x2="18" y2="9" stroke={palette.brushShadow} strokeWidth="0.3" opacity="0.22" />
            <Line x1="9" y1="0" x2="9" y2="18" stroke={palette.brushLight} strokeWidth="0.22" opacity="0.16" />
          </Pattern>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${brushId})`} opacity={0.82} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${fineId})`} opacity={0.42} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${crossId})`} opacity={0.3} />
      </Svg>

      <LinearGradient
        colors={[palette.glossHot, palette.glossWarm, palette.glossCool, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.92, y: 0.82 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={['transparent', palette.specularCore, palette.specularTail, 'transparent']}
        start={{ x: 0.02, y: 0.1 }}
        end={{ x: 0.98, y: 0.38 }}
        style={[StyleSheet.absoluteFill, styles.specularSweep]}
      />

      <LinearGradient
        colors={['transparent', palette.vignette]}
        start={{ x: 0.5, y: 0.35 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.bevelHighlight, { borderColor: palette.edgeHighlight }]} />
      <View style={[styles.bevelShadow, { borderColor: palette.edgeShadow }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  darkMicroSheen: {
    opacity: 0.55,
  },
  darkBevelShadow: {
    borderColor: 'rgba(0,0,0,0.35)',
    opacity: 0.45,
  },
  undertoneWash: {
    opacity: 0.38,
  },
  specularSweep: {
    opacity: 0.95,
  },
  bevelHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: StyleSheet.hairlineWidth * 1.5,
    borderLeftWidth: StyleSheet.hairlineWidth * 1.5,
    borderRadius: 20,
    margin: StyleSheet.hairlineWidth,
  },
  bevelShadow: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 20,
    opacity: 0.55,
  },
});
