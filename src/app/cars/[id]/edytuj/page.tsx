import { normalizeVehicleType } from "@/lib/vehicleTypes";
import { notFound, redirect } from "next/navigation";
import { findCarById } from "@/lib/carsStorage";
import { prisma } from "@/lib/prisma";
import { getAuthedUserIdFromRequest } from "@/lib/sessionAuth";
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

  const currentUserId = await getAuthedUserIdFromRequest();
  if (!currentUserId) redirect(`/cars/${car.id}`);
  const actor = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: true },
  });
  const isAdmin = String(actor?.role || "").toUpperCase() === "ADMIN";
  if (car.userId !== currentUserId && !isAdmin) {
    redirect(`/cars/${car.id}`);
  }

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
        vehicleType: normalizeVehicleType((car as { vehicleType?: string }).vehicleType),
        exteriorColor: car.exteriorColor || "",
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
        priceCurrency: (String(car.priceCurrency || "PLN").toUpperCase() === "EUR" ? "EUR" : "PLN") as "PLN" | "EUR",
        pricePln: String(
          Number(car.price || 0) > 0 ? Math.round(Number(car.price)) : Math.round(Number(car.pricePln || 0)),
        ),
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
        showContactPhone: Boolean(car.showContactPhone),
      }}
    />
  );
}
