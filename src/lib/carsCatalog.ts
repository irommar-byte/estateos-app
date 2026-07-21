export type EstateOsCarListing = {
  id: number;
  title: string;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  fuelType: string;
  transmission: string;
  bodyType: string;
  vehicleType?: string;
  pricePln: number;
  city: string;
  cityLat?: number | null;
  cityLng?: number | null;
  imageUrl: string;
  createdAt: string;
  promotedUntil?: string | null;
  featured?: boolean;
};

export const carsCatalogMock: EstateOsCarListing[] = [
  {
    id: 9001,
    title: "BMW X5 xDrive30d M Sport",
    make: "BMW",
    model: "X5",
    year: 2022,
    mileageKm: 42800,
    fuelType: "Diesel",
    transmission: "Automatyczna",
    bodyType: "SUV",
    pricePln: 319000,
    city: "Warszawa",
    imageUrl: "https://images.unsplash.com/photo-1556189250-72ba954cfc2b?auto=format&fit=crop&w=1400&q=80",
    createdAt: new Date().toISOString(),
  },
  {
    id: 9002,
    title: "Porsche Taycan 4S Performance Plus",
    make: "Porsche",
    model: "Taycan",
    year: 2023,
    mileageKm: 16800,
    fuelType: "Elektryczny",
    transmission: "Automatyczna",
    bodyType: "Sedan",
    pricePln: 499000,
    city: "Kraków",
    imageUrl: "https://images.unsplash.com/photo-1614200187524-dc4b892acf16?auto=format&fit=crop&w=1400&q=80",
    createdAt: new Date(Date.now() - 10_000_000).toISOString(),
  },
  {
    id: 9003,
    title: "Audi A6 Avant 45 TFSI Quattro",
    make: "Audi",
    model: "A6",
    year: 2021,
    mileageKm: 61200,
    fuelType: "Benzyna",
    transmission: "Automatyczna",
    bodyType: "Kombi",
    pricePln: 224900,
    city: "Wrocław",
    imageUrl: "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1400&q=80",
    createdAt: new Date(Date.now() - 20_000_000).toISOString(),
  },
];

export function findCarListingById(id: number) {
  return carsCatalogMock.find((car) => car.id === id) ?? null;
}
