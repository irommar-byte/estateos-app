import React from 'react';
import { Marker } from 'react-native-maps';

const PIN_IMAGES = {
  sell: require('../../../assets/map-pins/sell.png'),
  rent: require('../../../assets/map-pins/rent.png'),
  selected: require('../../../assets/map-pins/selected.png'),
} as const;

const RENT_MARKER_COLOR = '#0A84FF';

type Props = {
  coordinate: { latitude: number; longitude: number };
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
};

function resolvePinImage(color: string, selected: boolean) {
  if (selected) return PIN_IMAGES.selected;
  return color === RENT_MARKER_COLOR ? PIN_IMAGES.rent : PIN_IMAGES.sell;
}

/** Android: natywne bitmapy — jedyna metoda gwarantująca widoczne pinezki w Google Maps. */
export function AndroidMapPriceMarker({ coordinate, label, color, selected, onPress }: Props) {
  return (
    <Marker
      coordinate={coordinate}
      image={resolvePinImage(color, selected)}
      anchor={{ x: 0.5, y: 1 }}
      title={label}
      tracksViewChanges={false}
      zIndex={selected ? 3 : 2}
      onPress={onPress}
    />
  );
}
