import React from 'react';
import ClusteredMapView from 'react-native-map-clustering';

/**
 * Clustered map for Radar. ClusteredMapView is a functional forwardRef wrapper
 * around MapView — it cannot be wrapped in NativeViewGestureHandler (RNGH crash).
 * Gesture priority vs. bottom carousel is handled by map scrollEnabled / z-order.
 */
export const RadarMapView: React.ComponentType<any> = ClusteredMapView;

type Props = {
  children: React.ReactElement;
};

/** @deprecated Use <RadarMapView /> directly. */
export default function MapGestureHost({ children }: Props) {
  return children;
}
