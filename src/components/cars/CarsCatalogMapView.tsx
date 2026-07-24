import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { formatMarkerPriceCompact, resolveOfferDisplayAmount } from '../../money/format';
import { resolveOfferListingPrice } from '../../money/offerPrice';
import { useMoneyContext } from '../../money/useMoneyContext';
import type { CarListing } from '../../services/carsApi';
import {
  fitMapCoordinatesAboveOverlay,
  focusMapCoordinateAboveOverlay,
  MAP_OVERLAY_EDGE_PADDING,
} from '../../utils/mapCameraFocus';
import { OfferMapMarkerPin } from '../radar/OfferMapMarkerPin';

const DEFAULT_REGION: Region = {
  latitude: 52.2297,
  longitude: 21.0122,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

const CAR_MAP_ACCENT = '#0EA5E9';
const CAR_PIN_COLORS: [string, string, string] = ['#38BDF8', '#0EA5E9', '#0284C7'];

type Props = {
  cars: CarListing[];
  selectedCarId: number | null;
  /** Tap pinezki — wybór + fokus (bez natychmiastowego detail). */
  onSelectCar: (car: CarListing) => void;
  isDark: boolean;
  mapType?: 'standard' | 'hybrid';
};

export type CarsCatalogMapViewHandle = {
  fitToCars: () => void;
  focusCar: (car: CarListing) => void;
};

function isValidCoord(lat?: number | null, lng?: number | null): lat is number {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function regionForCars(cars: CarListing[]): Region {
  const coords = cars
    .filter((car) => isValidCoord(car.cityLat, car.cityLng))
    .map((car) => ({ lat: car.cityLat as number, lng: car.cityLng as number }));
  if (!coords.length) return DEFAULT_REGION;

  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latDelta = Math.max((maxLat - minLat) * 1.45, 0.06);
  const lngDelta = Math.max((maxLng - minLng) * 1.45, 0.06);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

const CarsCatalogMapView = forwardRef<CarsCatalogMapViewHandle, Props>(function CarsCatalogMapView(
  { cars, selectedCarId, onSelectCar, isDark, mapType = 'standard' },
  ref,
) {
  const mapRef = useRef<MapView | null>(null);
  const { preference, rate } = useMoneyContext();
  const mappableCars = useMemo(
    () => cars.filter((car) => isValidCoord(car.cityLat, car.cityLng)),
    [cars],
  );
  const initialRegion = useMemo(() => regionForCars(mappableCars), [mappableCars]);

  const fitToCars = useCallback(() => {
    if (!mapRef.current || mappableCars.length === 0) return;
    fitMapCoordinatesAboveOverlay(
      mapRef.current,
      mappableCars.map((car) => ({
        latitude: car.cityLat as number,
        longitude: car.cityLng as number,
      })),
      { edgePadding: MAP_OVERLAY_EDGE_PADDING },
    );
  }, [mappableCars]);

  const focusCar = useCallback((car: CarListing) => {
    if (!isValidCoord(car.cityLat, car.cityLng)) return;
    focusMapCoordinateAboveOverlay(mapRef.current, {
      latitude: Number(car.cityLat),
      longitude: Number(car.cityLng),
    });
  }, []);

  useImperativeHandle(ref, () => ({ fitToCars, focusCar }), [fitToCars, focusCar]);

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        mapType={mapType}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
      >
        {mappableCars.map((car) => {
          const selected = selectedCarId === car.id;
          const listing = resolveOfferListingPrice(car, rate);
          const disp = resolveOfferDisplayAmount({
            amount: listing.amount,
            listingCurrency: listing.currency,
            pricePln: listing.plnAmount,
            displayPreference: preference,
            rate,
          });
          const label = formatMarkerPriceCompact(disp.displayAmount, disp.displayCurrency);
          return (
            <Marker
              key={car.id}
              coordinate={{ latitude: car.cityLat as number, longitude: car.cityLng as number }}
              onPress={() => onSelectCar(car)}
              tracksViewChanges={Platform.OS === 'android'}
              zIndex={selected ? 12 : 1}
            >
              <OfferMapMarkerPin
                label={label}
                luxColors={CAR_PIN_COLORS}
                selected={selected}
                accent={CAR_MAP_ACCENT}
              />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
});

export default CarsCatalogMapView;

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
  },
});
