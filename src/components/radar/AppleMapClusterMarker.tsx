import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { formatClusterCount, resolveClusterMarkerDimensions } from '../../utils/mapClusterStyle';

type ClusterGeometry = {
  coordinates: [number, number];
};

type ClusterProperties = {
  point_count: number;
};

type Props = {
  geometry: ClusterGeometry;
  properties: ClusterProperties;
  onPress: () => void;
  accentColor: string;
  gradient: [string, string, string];
};

function AppleMapClusterMarkerInner({ geometry, properties, onPress, accentColor, gradient }: Props) {
  const count = properties.point_count;
  const { outer, inner, fontSize } = resolveClusterMarkerDimensions(count);
  const label = formatClusterCount(count);

  return (
    <Marker
      coordinate={{
        longitude: geometry.coordinates[0],
        latitude: geometry.coordinates[1],
      }}
      onPress={onPress}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={Math.min(count, 999) + 20}
    >
      <View style={[styles.root, { width: outer, height: outer }]} collapsable={false}>
        <View
          style={[
            styles.halo,
            {
              width: outer,
              height: outer,
              borderRadius: outer / 2,
              backgroundColor: `${accentColor}26`,
            },
          ]}
          pointerEvents="none"
        />
        <View
          style={[
            styles.core,
            {
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              shadowColor: accentColor,
            },
          ]}
        >
          <LinearGradient
            colors={gradient}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={[styles.gradient, { borderRadius: inner / 2 }]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)', 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.6 }}
              style={[styles.sheen, { borderRadius: inner / 2 }]}
              pointerEvents="none"
            />
            <Text style={[styles.count, { fontSize }]} numberOfLines={1} allowFontScaling={false}>
              {label}
            </Text>
          </LinearGradient>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 9,
    elevation: 9,
  },
  gradient: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
  },
  count: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export const AppleMapClusterMarker = memo(AppleMapClusterMarkerInner);
