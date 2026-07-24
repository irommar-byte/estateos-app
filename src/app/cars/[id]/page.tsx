import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CarDetailClient from "@/components/cars/CarDetailClient";
import { carShareMetadata, loadCarShareMeta } from "@/lib/carShareLanding";
import { findCarById } from "@/lib/carsStorage";
import { resolveCarPublicContactPhone } from "@/lib/carContactPhone";
import { sanitizeCarListingForViewer } from "@/lib/carVehicleDocPrivacy";
import { getAuthedUserIdFromRequest } from "@/lib/sessionAuth";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const carId = Number(id);
  const meta = await loadCarShareMeta(carId);
  if (!meta) {
    return {
      title: "Ogłoszenie nie znalezione | EstateOS™Car",
      robots: { index: false, follow: false },
    };
  }
  return carShareMetadata(meta);
}

export default async function CarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const car = await findCarById(Number(id));
  if (!car) notFound();

  const currentUserId = await getAuthedUserIdFromRequest();
  const publicCar = sanitizeCarListingForViewer(car);
  const sellerPhone = await resolveCarPublicContactPhone(car);
  return <CarDetailClient car={publicCar} currentUserId={currentUserId} sellerPhone={sellerPhone} />;
}
