import type { CarListing } from '../services/carsApi';
import type { GalleryOffer } from '../components/radar/RadarOfferGallery';

export function carToSpotlightOffer(car: CarListing): GalleryOffer {
  return {
    id: car.id,
    lat: Number(car.cityLat) || 0,
    lng: Number(car.cityLng) || 0,
    type: `${car.make} · ${car.model}`,
    area: `${car.year}`,
    rooms: `${new Intl.NumberFormat('pl-PL').format(car.mileageKm)} km`,
    image: car.imageUrl || null,
    raw: car as unknown as Record<string, unknown>,
  };
}
