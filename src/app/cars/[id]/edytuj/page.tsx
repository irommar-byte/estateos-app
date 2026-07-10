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
        description: car.description || "",
        make: car.make,
        model: car.model,
        makeSlug: "",
        modelSlug: "",
        year: String(car.year),
        mileageKm: String(car.mileageKm),
        fuelType: car.fuelType,
        fuelSlug: "",
        transmission: car.transmission,
        gearboxSlug: "",
        bodyType: car.bodyType,
        generation: car.generation || "",
        generationSlug: "",
        enginePower: car.enginePower || "",
        enginePowerSlug: "",
        engineCapacity: car.engineCapacity || "",
        engineCapacitySlug: "",
        trimVersion: car.trimVersion || "",
        trimVersionSlug: "",
        doorCount: car.doorCount ? String(car.doorCount) : "",
        doorCountSlug: car.doorCount ? String(car.doorCount) : "",
        pricePln: String(car.pricePln),
        city: car.city,
        imageUrl: car.imageUrl,
        vin: car.vin || "",
        registrationNumber: car.registrationNumber || "",
        firstRegistrationDate: car.firstRegistrationDate || "",
        insuranceValidUntil: car.insuranceValidUntil || "",
      }}
    />
  );
}
