// @ts-nocheck — fork of react-native-map-clustering (untyped JS internals).
import React, {
  forwardRef,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions, LayoutAnimation, Platform } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import SuperCluster from 'supercluster';
import ClusterMarker from 'react-native-map-clustering/lib/ClusteredMarker';
import {
  calculateBBox,
  generateSpiral,
  isMarker,
  markerToGeoJSONFeature,
  returnMapZoom,
} from 'react-native-map-clustering/lib/helpers';
import { calculateClusterQueryBBox } from '../../utils/radarMapViewport';

const { width } = Dimensions.get('window');

type ClusteredMapViewProps = React.ComponentProps<typeof MapView> & {
  radius?: number;
  maxZoom?: number;
  minZoom?: number;
  minPoints?: number;
  extent?: number;
  nodeSize?: number;
  edgePadding?: { top: number; left: number; right: number; bottom: number };
  onClusterPress?: (cluster: unknown, children?: unknown) => void;
  onMarkersChange?: (markers: unknown[]) => void;
  preserveClusterPressBehavior?: boolean;
  clusteringEnabled?: boolean;
  clusterColor?: string;
  clusterTextColor?: string;
  clusterFontFamily?: string;
  spiderLineColor?: string;
  layoutAnimationConf?: typeof LayoutAnimation.Presets.spring;
  animationEnabled?: boolean;
  renderCluster?: (cluster: Record<string, unknown>) => React.ReactNode;
  tracksViewChanges?: boolean;
  spiralEnabled?: boolean;
  superClusterRef?: { current: SuperCluster | null };
  mapRef?: (map: MapView | null) => void;
};

/**
 * Fork of react-native-map-clustering with an expanded supercluster query bbox.
 * Default library bbox matches the visible viewport exactly — cluster centroids
 * near edges disappear on a small pan even though member pins are still on screen.
 */
const EstateClusteredMapView = forwardRef<MapView, ClusteredMapViewProps>(
  (
    {
      radius = width * 0.06,
      maxZoom = 20,
      minZoom = 1,
      minPoints = 2,
      extent = 512,
      nodeSize = 64,
      edgePadding = { top: 50, left: 50, right: 50, bottom: 50 },
      children,
      onClusterPress = () => {},
      onRegionChangeComplete = () => {},
      onMarkersChange = () => {},
      preserveClusterPressBehavior = false,
      clusteringEnabled = true,
      clusterColor = '#00B386',
      clusterTextColor = '#FFFFFF',
      clusterFontFamily,
      spiderLineColor = '#FF0000',
      layoutAnimationConf = LayoutAnimation.Presets.spring,
      animationEnabled = true,
      renderCluster,
      tracksViewChanges = false,
      spiralEnabled = true,
      superClusterRef = { current: null },
      mapRef: mapRefProp = () => {},
      ...restProps
    },
    ref,
  ) => {
    const [markers, updateMarkers] = useState<ReturnType<SuperCluster['getClusters']>>([]);
    const [spiderMarkers, updateSpiderMarker] = useState<
      Array<{
        index: number;
        longitude: number;
        latitude: number;
        centerPoint: { latitude: number; longitude: number };
      }>
    >([]);
    const [otherChildren, updateChildren] = useState<React.ReactNode[]>([]);
    const [superCluster, setSuperCluster] = useState<SuperCluster | null>(null);
    const [currentRegion, updateRegion] = useState(
      restProps.region || restProps.initialRegion,
    );
    const [isSpiderfier, updateSpiderfier] = useState(false);
    const [clusterChildren, updateClusterChildren] = useState<unknown>(null);
    const mapRef = useRef<MapView | null>(null);

    const propsChildren = useMemo(() => React.Children.toArray(children), [children]);

    const queryClusters = (region: typeof currentRegion, cluster: SuperCluster) => {
      if (!region) return [];
      const bBox = calculateClusterQueryBBox(region);
      const zoom = returnMapZoom(region, calculateBBox(region), minZoom);
      return cluster.getClusters(bBox, zoom);
    };

    useEffect(() => {
      const rawData: ReturnType<typeof markerToGeoJSONFeature>[] = [];
      const nextOtherChildren: React.ReactNode[] = [];

      if (!clusteringEnabled) {
        updateSpiderMarker([]);
        updateMarkers([]);
        updateChildren(propsChildren);
        setSuperCluster(null);
        return;
      }

      propsChildren.forEach((child, index) => {
        if (isMarker(child)) {
          rawData.push(markerToGeoJSONFeature(child, index));
        } else {
          nextOtherChildren.push(child);
        }
      });

      const nextSuperCluster = new SuperCluster({
        radius,
        maxZoom,
        minZoom,
        minPoints,
        extent,
        nodeSize,
      });

      nextSuperCluster.load(rawData);
      const nextMarkers = queryClusters(currentRegion, nextSuperCluster);

      updateMarkers(nextMarkers);
      updateChildren(nextOtherChildren);
      setSuperCluster(nextSuperCluster);
      superClusterRef.current = nextSuperCluster;
    }, [propsChildren, clusteringEnabled]);

    useEffect(() => {
      if (!spiralEnabled) return;

      if (isSpiderfier && markers.length > 0 && superCluster) {
        const allSpiderMarkers: typeof spiderMarkers = [];
        markers.forEach((marker, i) => {
          let spiralChildren: ReturnType<SuperCluster['getLeaves']> = [];
          if (marker.properties.cluster) {
            spiralChildren = superCluster.getLeaves(marker.properties.cluster_id, Infinity);
          }
          const positions = generateSpiral(marker, spiralChildren, markers, i);
          allSpiderMarkers.push(...positions);
        });
        updateSpiderMarker(allSpiderMarkers);
      } else {
        updateSpiderMarker([]);
      }
    }, [isSpiderfier, markers, spiralEnabled, superCluster]);

    const _onRegionChangeComplete: NonNullable<ClusteredMapViewProps['onRegionChangeComplete']> = (
      region,
      details,
    ) => {
      if (superCluster && region) {
        const nextMarkers = queryClusters(region, superCluster);
        if (animationEnabled && Platform.OS === 'ios') {
          LayoutAnimation.configureNext(layoutAnimationConf);
        }
        if (regionZoomAtLeast18(region) && nextMarkers.length > 0 && clusterChildren) {
          if (spiralEnabled) updateSpiderfier(true);
        } else if (spiralEnabled) {
          updateSpiderfier(false);
        }
        updateMarkers(nextMarkers);
        onMarkersChange(nextMarkers);
        onRegionChangeComplete(region, details, nextMarkers);
        updateRegion(region);
      } else {
        onRegionChangeComplete(region, details);
      }
    };

    const _onClusterPress = (cluster: { id: number }) => () => {
      if (!superCluster) return;
      const leaves = superCluster.getLeaves(cluster.id, Infinity);
      updateClusterChildren(leaves);

      if (preserveClusterPressBehavior) {
        onClusterPress(cluster, leaves);
        return;
      }

      const coordinates = leaves.map(({ geometry }) => ({
        latitude: geometry.coordinates[1],
        longitude: geometry.coordinates[0],
      }));

      mapRef.current?.fitToCoordinates(coordinates, { edgePadding });
      onClusterPress(cluster, leaves);
    };

    return (
      <MapView
        {...restProps}
        ref={(map) => {
          mapRef.current = map;
          if (typeof ref === 'function') ref(map);
          else if (ref) ref.current = map;
          mapRefProp(map);
        }}
        onRegionChangeComplete={_onRegionChangeComplete}
      >
        {markers.map((marker) =>
          marker.properties.point_count === 0 ? (
            propsChildren[marker.properties.index]
          ) : !isSpiderfier ? (
            renderCluster ? (
              renderCluster({
                onPress: _onClusterPress(marker),
                clusterColor,
                clusterTextColor,
                clusterFontFamily,
                ...marker,
              })
            ) : (
              <ClusterMarker
                key={`cluster-${marker.id}`}
                {...marker}
                onPress={_onClusterPress(marker)}
                clusterColor={clusterColor}
                clusterTextColor={clusterTextColor}
                clusterFontFamily={clusterFontFamily}
                tracksViewChanges={tracksViewChanges}
              />
            )
          ) : null,
        )}
        {otherChildren}
        {spiderMarkers.map((marker) =>
          propsChildren[marker.index]
            ? React.cloneElement(propsChildren[marker.index] as React.ReactElement, {
                coordinate: { ...marker },
              })
            : null,
        )}
        {spiderMarkers.map((marker, index) => (
          <Polyline
            key={index}
            coordinates={[marker.centerPoint, marker, marker.centerPoint]}
            strokeColor={spiderLineColor}
            strokeWidth={1}
          />
        ))}
      </MapView>
    );
  },
);

function regionZoomAtLeast18(region: {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}) {
  const bBox = calculateBBox(region);
  const zoom = returnMapZoom(region, bBox, 1);
  return zoom >= 18;
}

export default memo(EstateClusteredMapView);
