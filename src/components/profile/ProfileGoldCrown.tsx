import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

type Props = {
  size?: number;
};

/**
 * Realistyczna korona w złocie — warstwy gradientu, cienie i błyski jak mały render 3D.
 * Statyczna; bez animacji (diament zostaje dla aktywnego Pro).
 */
export default function ProfileGoldCrown({ size = 32 }: Props) {
  const uid = useId().replace(/:/g, '');
  const gMain = `pgc-main-${uid}`;
  const gBand = `pgc-band-${uid}`;
  const gHi = `pgc-hi-${uid}`;
  const gSh = `pgc-sh-${uid}`;
  const gOrb = `pgc-orb-${uid}`;
  const gGem = `pgc-gem-${uid}`;

  const height = Math.round(size * 0.72);

  return (
    <View style={[styles.wrap, { width: size, height }]} pointerEvents="none">
      <Svg width={size} height={height} viewBox="0 0 80 58">
        <Defs>
          <LinearGradient id={gMain} x1="8" y1="8" x2="72" y2="48" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFF4C2" />
            <Stop offset="0.28" stopColor="#FFD95A" />
            <Stop offset="0.58" stopColor="#E8AE1C" />
            <Stop offset="1" stopColor="#A87212" />
          </LinearGradient>
          <LinearGradient id={gBand} x1="40" y1="36" x2="40" y2="52" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFE082" />
            <Stop offset="0.45" stopColor="#D4A017" />
            <Stop offset="1" stopColor="#8B5A0A" />
          </LinearGradient>
          <LinearGradient id={gHi} x1="16" y1="6" x2="48" y2="40" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.72" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id={gSh} x1="52" y1="10" x2="76" y2="46" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#6B3F08" stopOpacity="0" />
            <Stop offset="1" stopColor="#4A2804" stopOpacity="0.55" />
          </LinearGradient>
          <RadialGradient id={gOrb} cx="50%" cy="35%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#FFF9E6" />
            <Stop offset="0.55" stopColor="#F5C842" />
            <Stop offset="1" stopColor="#B8860B" />
          </RadialGradient>
          <RadialGradient id={gGem} cx="45%" cy="35%" rx="55%" ry="55%">
            <Stop offset="0" stopColor="#FFFDE7" />
            <Stop offset="0.4" stopColor="#FFE082" />
            <Stop offset="1" stopColor="#C9922E" />
          </RadialGradient>
        </Defs>

        <Ellipse cx="40" cy="54.5" rx="27" ry="2.6" fill="#000000" opacity="0.14" />

        <Path
          d="M6 44.5 C6 40.5 10 38.5 14 38.5 H66 C70 38.5 74 40.5 74 44.5 V48.5 C74 51 71.5 53 68.5 53 H11.5 C8.5 53 6 51 6 48.5 Z"
          fill={`url(#${gBand})`}
        />
        <Path
          d="M10 41.5 H70"
          stroke="#FFF8DC"
          strokeWidth="0.9"
          opacity="0.45"
          strokeLinecap="round"
        />
        <Path
          d="M12 44 H68"
          stroke="#7A4E0C"
          strokeWidth="0.7"
          opacity="0.35"
          strokeLinecap="round"
        />

        <Path
          d="M14 44.5 L18.5 30.5 L22.5 37.5 L27 24 L31.5 34 L36 18 L40 28.5 L44 18 L48.5 34 L53 24 L57.5 37.5 L61.5 30.5 L66 44.5 Z"
          fill={`url(#${gMain})`}
        />
        <Path
          d="M14 44.5 L18.5 30.5 L22.5 37.5 L27 24 L31.5 34 L36 18 L40 28.5 L44 18 L48.5 34 L53 24 L57.5 37.5 L61.5 30.5 L66 44.5 Z"
          fill={`url(#${gSh})`}
        />
        <Path
          d="M14 44.5 L18.5 30.5 L22.5 37.5 L27 24 L31.5 34 L36 18 L40 28.5 L44 18 L48.5 34 L53 24 L57.5 37.5 L61.5 30.5 L66 44.5 Z"
          fill={`url(#${gHi})`}
        />

        <Path
          d="M14 44.5 L18.5 30.5 L22.5 37.5 L27 24 L31.5 34 L36 18 L40 28.5 L44 18 L48.5 34 L53 24 L57.5 37.5 L61.5 30.5 L66 44.5 Z"
          fill="none"
          stroke="#8B5A0A"
          strokeWidth="0.65"
          opacity="0.42"
        />

        <G>
          {[
            { cx: 18.5, cy: 28.5, r: 3.1 },
            { cx: 27, cy: 22, r: 2.8 },
            { cx: 36, cy: 15.5, r: 3.4 },
            { cx: 44, cy: 15.5, r: 3.4 },
            { cx: 53, cy: 22, r: 2.8 },
            { cx: 61.5, cy: 28.5, r: 3.1 },
          ].map((orb) => (
            <Circle
              key={`${orb.cx}-${orb.cy}`}
              cx={orb.cx}
              cy={orb.cy}
              r={orb.r}
              fill={`url(#${gOrb})`}
              stroke="#B8860B"
              strokeWidth="0.45"
            />
          ))}
        </G>

        <Circle cx="40" cy="21" r="4.2" fill={`url(#${gGem})`} stroke="#C9922E" strokeWidth="0.55" />
        <Path
          d="M38.2 19.2 L40 17.2 L41.8 19.2 L40 21.4 Z"
          fill="#FFFEF5"
          opacity="0.85"
        />

        <Path
          d="M16 40.5 C22 39.5 28 41 34 40.2 C38 39.7 42 39.7 46 40.2 C52 41 58 39.5 64 40.5"
          stroke="#FFF8DC"
          strokeWidth="0.75"
          opacity="0.28"
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
