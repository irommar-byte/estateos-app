"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, Fuel, Gauge, MapPin, Settings2, Car as CarIcon, Cog } from "lucide-react";
import CarFavoriteButton from "@/components/cars/CarFavoriteButton";
import CarInquiryPanel from "@/components/cars/CarInquiryPanel";
import CarOwnerActions from "@/components/cars/CarOwnerActions";
import CarVehicleChecksClient from "@/components/cars/CarVehicleChecksClient";
import { carImageSrc, formatCarPrice, formatMileage } from "@/lib/carsPresentation";
import type { CarListingRecord } from "@/lib/carsStorage";
import { useLocale } from "@/contexts/LocaleContext";
import { getCarsDictionary } from "@/i18n/carsDictionary";

type CarDetailClientProps = {
  car: CarListingRecord;
  currentUserId: number | null;
};

function SpecItem({ icon: Icon, label, value }: { icon: typeof Fuel; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/40 p-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-sky-300/90">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-[var(--eos-text)]">{value}</p>
    </div>
  );
}

export default function CarDetailClient({ car, currentUserId }: CarDetailClientProps) {
  const { locale } = useLocale();
  const d = getCarsDictionary(locale);
  const imageSrc = carImageSrc(car.imageUrl);

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-32 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/cars" className="text-xs font-black uppercase tracking-[0.14em] text-sky-300 hover:text-sky-200">
          {d.backToCatalog}
        </Link>

        <section className="overflow-hidden rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)]">
          <div className="relative aspect-[16/8]">
            <Image src={imageSrc} alt={car.title} fill className="object-cover" priority unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
              <CarFavoriteButton carId={car.id} />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">
                {car.make} · {car.model} · {car.year}
              </p>
              <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {car.title}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/80">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden />
                  {car.city}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Gauge className="size-4" aria-hidden />
                  {formatMileage(car.mileageKm)}
                </span>
              </p>
            </div>
          </div>

          <div className="grid gap-8 p-6 lg:grid-cols-[1.35fr_1fr] lg:p-8">
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--eos-border)] pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--eos-muted)]">{d.priceLabel}</p>
                  <p className="mt-1 text-3xl font-bold text-sky-300 sm:text-4xl">{formatCarPrice(car.pricePln)}</p>
                </div>
                {car.userId ? (
                  <Link
                    href={`/profil/${car.userId}`}
                    className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--eos-text)] hover:border-sky-400/40"
                  >
                    {d.sellerProfile}
                  </Link>
                ) : null}
              </div>

              <CarOwnerActions carId={car.id} ownerUserId={car.userId} currentUserId={currentUserId} />

              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">{d.specSection}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <SpecItem icon={Calendar} label={d.specYear} value={String(car.year)} />
                  <SpecItem icon={Gauge} label={d.specMileage} value={formatMileage(car.mileageKm)} />
                  <SpecItem icon={Fuel} label={d.specFuel} value={car.fuelType} />
                  <SpecItem icon={Settings2} label={d.specTransmission} value={car.transmission} />
                  <SpecItem icon={CarIcon} label={d.specBody} value={car.bodyType} />
                  {car.generation ? <SpecItem icon={Calendar} label={d.specGeneration} value={car.generation} /> : null}
                  {car.enginePower ? <SpecItem icon={Cog} label={d.specPower} value={car.enginePower} /> : null}
                  {car.engineCapacity ? <SpecItem icon={Cog} label={d.specCapacity} value={`${car.engineCapacity} cm³`} /> : null}
                  {car.trimVersion ? <SpecItem icon={CarIcon} label={d.specTrim} value={car.trimVersion} /> : null}
                  {car.doorCount ? <SpecItem icon={CarIcon} label={d.specDoors} value={String(car.doorCount)} /> : null}
                  <SpecItem icon={MapPin} label={d.specCity} value={car.city} />
                </div>
              </div>

              {car.description?.trim() ? (
              <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-5">
                <p className="text-sm font-semibold">{d.descriptionTitle}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--eos-muted)]">{car.description.trim()}</p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-5">
                <p className="text-sm font-semibold">{d.aboutListingTitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
                  {d.aboutListingBody}
                </p>
              </div>

              <CarVehicleChecksClient
                vin={car.vin}
                registrationNumber={car.registrationNumber}
                firstRegistrationDate={car.firstRegistrationDate}
                insuranceValidUntil={car.insuranceValidUntil}
                loggedIn={currentUserId !== null}
              />
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <CarInquiryPanel
                carId={car.id}
                carTitle={car.title}
                make={car.make}
                model={car.model}
                year={car.year}
                pricePln={car.pricePln}
                city={car.city}
                sellerUserId={car.userId}
                currentUserId={currentUserId}
              />
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
