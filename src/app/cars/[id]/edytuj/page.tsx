import { notFound } from "next/navigation";
import { findCarById } from "@/lib/carsStorage";
import EditCarPageClient from "./EditCarPageClient";

function parseCarImages(car: { images: string; imageUrl: string }): string[] {
  try {
    const parsed = JSON.parse(car.images || "[]");
    if (Array.isArray(parsed)) {
      const urls = parsed.map((item) => String(item || "").trim()).filter(Boolean);
      if (urls.length) return urls;
    }
  } catch {
    // ignore malformed JSON
  }
  return car.imageUrl ? [car.imageUrl] : [];
}

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
        doorCountSlug: "",
        pricePln: String(car.pricePln),
        city: car.city,
        cityLat: car.cityLat,
        cityLng: car.cityLng,
        localityCountry: car.localityCountry || "Polska",
        imageUrl: car.imageUrl,
        images: parseCarImages(car),
        vin: car.vin || "",
        registrationNumber: car.registrationNumber || "",
        firstRegistrationDate: car.firstRegistrationDate || "",
        insuranceValidUntil: car.insuranceValidUntil || "",
        restrictVehicleDocs: car.restrictVehicleDocs,
      }}
    />
  );
}
