import { notFound } from "next/navigation";
import { findCarById } from "@/lib/carsStorage";
import EditCarPageClient from "./EditCarPageClient";

export default async function EditCarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const car = await findCarById(Number(id));
  if (!car) notFound();

  return (
    <EditCarPageClient
      carId={car.id}
      initialValues={{
        title: car.title,
        make: car.make,
        model: car.model,
        year: String(car.year),
        mileageKm: String(car.mileageKm),
        fuelType: car.fuelType,
        transmission: car.transmission,
        bodyType: car.bodyType,
        pricePln: String(car.pricePln),
        city: car.city,
        imageUrl: car.imageUrl,
      }}
    />
  );
}
