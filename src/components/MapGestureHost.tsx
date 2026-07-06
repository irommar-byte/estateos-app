import React from 'react';
import EstateClusteredMapView from './map/EstateClusteredMapView';

/**
 * Clustered map for Radar. ClusteredMapView is a functional forwardRef wrapper
 * around MapView — it cannot be wrapped in NativeViewGestureHandler (RNGH crash).
 * Gesture priority vs. bottom carousel is handled by map scrollEnabled / z-order.
 *
 * EstateClusteredMapView expands the supercluster query bbox so edge clusters
 * do not disappear on a small pan.
 */
export const RadarMapView: React.ComponentType<any> = EstateClusteredMapView;

type Props = {
  children: React.ReactElement;
};

/** @deprecated Use <RadarMapView /> directly. */
export default function MapGestureHost({ children }: Props) {
  return children;
}
