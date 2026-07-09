import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import CarContactButton from "@/components/cars/CarContactButton";
import CarOwnerActions from "@/components/cars/CarOwnerActions";
import { findCarById } from "@/lib/carsStorage";
import { getAuthedUserIdFromRequest } from "@/lib/sessionAuth";

export default async function CarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const car = await findCarById(Number(id));
  if (!car) notFound();

  const currentUserId = await getAuthedUserIdFromRequest();
  const imageSrc = car.imageUrl || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80";

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-32 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/cars" className="text-xs font-black uppercase tracking-[0.14em] text-sky-300 hover:text-sky-200">
          Wróć do EstateOS™Car
        </Link>

        <section className="overflow-hidden rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)]">
          <div className="relative aspect-[16/8]">
            <Image src={imageSrc} alt={car.title} fill className="object-cover" unoptimized />
          </div>
          <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">
                {car.make} · {car.model} · {car.year}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{car.title}</h1>
              <p className="text-sm text-[var(--eos-muted)]">
                {car.city} · {new Intl.NumberFormat("pl-PL").format(car.mileageKm)} km
              </p>
              <p className="text-3xl font-bold text-sky-300">{new Intl.NumberFormat("pl-PL").format(car.pricePln)} PLN</p>
              <CarOwnerActions carId={car.id} ownerUserId={car.userId} currentUserId={currentUserId} />
            </div>
            <div className="space-y-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-4 text-sm">
              <p className="font-semibold">Specyfikacja</p>
              <p>Paliwo: {car.fuelType}</p>
              <p>Skrzynia: {car.transmission}</p>
              <p>Nadwozie: {car.bodyType}</p>
              <p>Rocznik: {car.year}</p>
              {car.userId ? (
                <CarContactButton
                  sellerUserId={car.userId}
                  currentUserId={currentUserId}
                  carTitle={car.title}
                />
              ) : (
                <p className="mt-4 text-xs text-[var(--eos-muted)]">
                  Kontakt będzie dostępny po przypisaniu sprzedającego do ogłoszenia.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
