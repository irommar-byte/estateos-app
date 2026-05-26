import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';
import Animated, {
  Extrapolation,
  SensorType,
  interpolate,
  useAnimatedReaction,
  useAnimatedSensor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useI18n } from '../../i18n';

type Props = {
  compact?: boolean;
  label?: string;
};

const BEAM_WIDTH = 48;
const BEAM_WIDTH_COMPACT = 39;
const BEAM_TRAVEL = 102;

/** Snappy but smooth — follows tilt without feeling stuck. */
const HOLO_SPRING = {
  damping: 14,
  stiffness: 280,
  mass: 0.22,
};

export default function InvestorProShimmerBadge({ compact = false, label }: Props) {
  const { t } = useI18n();
  const text = label || t('offer.badges.investorPro');

  const rotation = useAnimatedSensor(SensorType.ROTATION, {
    interval: 8,
    adjustToInterfaceOrientation: true,
  });
  const gravity = useAnimatedSensor(SensorType.GRAVITY, {
    interval: 8,
    adjustToInterfaceOrientation: true,
  });

  const beamX = useSharedValue(0);
  const beamY = useSharedValue(0);

  useAnimatedReaction(
    () => {
      const { roll, pitch } = rotation.sensor.value;
      const { x, y } = gravity.sensor.value;
      return { roll, pitch, gx: x, gy: y };
    },
    ({ roll, pitch, gx, gy }) => {
      const travel = compact ? BEAM_TRAVEL * 0.86 : BEAM_TRAVEL;
      const tiltRoll = roll + (gx / 9.8) * 0.45;
      const tiltPitch = pitch + (gy / 9.8) * 0.35;

      const targetX = interpolate(
        tiltRoll,
        [-0.22, 0.22],
        [travel, -travel],
        Extrapolation.CLAMP
      );
      const targetY = interpolate(
        tiltPitch,
        [-0.18, 0.18],
        [9, -9],
        Extrapolation.CLAMP
      );

      beamX.value = withSpring(targetX, HOLO_SPRING);
      beamY.value = withSpring(targetY, HOLO_SPRING);
    },
    [compact]
  );

  const beamStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: beamX.value },
      { translateY: beamY.value },
      { skewX: '-14deg' },
    ],
  }));

  return (
    <View style={[styles.shell, compact ? styles.shellCompact : null]}>
      <LinearGradient
        colors={['#3a424f', '#556070', '#4d5868', '#343c48']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.innerBevel} pointerEvents="none" />
      <Animated.View
        pointerEvents="none"
        style={[styles.beam, compact ? styles.beamCompact : null, beamStyle]}
      >
        <LinearGradient
          colors={[
            'rgba(255,255,255,0)',
            'rgba(255,255,255,0.42)',
            'rgba(255,255,255,0.88)',
            'rgba(255,255,255,0.42)',
            'rgba(255,255,255,0)',
          ]}
          locations={[0, 0.28, 0.5, 0.72, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={styles.content}>
        <Crown size={compact ? 11 : 12} color="#F4F7FC" strokeWidth={2.4} />
        <Text style={[styles.text, compact ? styles.textCompact : null]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(220,228,240,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#C5D0E0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  shellCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  innerBevel: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.22)',
    borderBottomColor: 'rgba(0,0,0,0.28)',
  },
  beam: {
    position: 'absolute',
    top: -12,
    bottom: -12,
    left: '50%',
    width: BEAM_WIDTH,
    marginLeft: -BEAM_WIDTH / 2,
    opacity: 0.96,
  },
  beamCompact: {
    width: BEAM_WIDTH_COMPACT,
    marginLeft: -BEAM_WIDTH_COMPACT / 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    zIndex: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: '#F8FAFD',
  },
  textCompact: {
    fontSize: 10,
  },
});
