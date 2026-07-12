import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CarDetailClient from "@/components/cars/CarDetailClient";
import { formatCarPrice } from "@/lib/carsPresentation";
import { findCarById } from "@/lib/carsStorage";
import { sanitizeCarListingForViewer } from "@/lib/carVehicleDocPrivacy";
import { getAuthedUserIdFromRequest } from "@/lib/sessionAuth";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const car = await findCarById(Number(id));
  if (!car) return { title: "Ogłoszenie nie znalezione" };
  return {
    title: `${car.make} ${car.model} ${car.year} | EstateOS™Car`,
    description: `${car.title} — ${formatCarPrice(car.pricePln)}, ${car.city}. Ogłoszenie samochodowe EstateOS™Car.`,
  };
}

export default async function CarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const car = await findCarById(Number(id));
  if (!car) notFound();

  const currentUserId = await getAuthedUserIdFromRequest();
  const publicCar = sanitizeCarListingForViewer(car);
  return <CarDetailClient car={publicCar} currentUserId={currentUserId} />;
}
