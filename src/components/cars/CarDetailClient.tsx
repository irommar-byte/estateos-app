"use client";

import Link from "next/link";
import { Calendar, Fuel, Gauge, MapPin, Settings2, Car as CarIcon, Cog, Palette } from "lucide-react";
import CarFavoriteButton from "@/components/cars/CarFavoriteButton";
import CarDetailGallery from "@/components/cars/CarDetailGallery";
import CarInquiryPanel from "@/components/cars/CarInquiryPanel";
import CarOwnerActions from "@/components/cars/CarOwnerActions";
import CarVehicleChecksClient from "@/components/cars/CarVehicleChecksClient";
import EosButton from "@/components/ui/EosButton";
import { useLocale } from "@/contexts/LocaleContext";
import { useFormatOfferPrice } from "@/hooks/useFormatOfferPrice";
import { formatMileage } from "@/lib/carsPresentation";
import type { CarListingRecord } from "@/lib/carsStorage";

type CarDetailClientProps = {
  car: CarListingRecord;
  currentUserId: number | null;
  isAdmin?: boolean;
  sellerPhone?: string | null;
};

function SpecItem({ icon: Icon, label, value }: { icon: typeof Fuel; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/40 p-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-sky-600 dark:text-sky-300/90">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-[var(--eos-text)]">{value}</p>
    </div>
  );
}

export default function CarDetailClient({ car, currentUserId, isAdmin = false, sellerPhone = null }: CarDetailClientProps) {
  const { dict, locale } = useLocale();
  const { formatOffer } = useFormatOfferPrice();
  const d = dict.cars.detail;
  const priceDisplay = formatOffer(car);

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-32 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/cars" className="text-xs font-black uppercase tracking-[0.14em] text-sky-600 hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200">
          {d.backToCatalog}
        </Link>

        <section className="overflow-hidden rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-3 sm:p-4">
          <CarDetailGallery
            title={car.title}
            imageUrl={car.imageUrl}
            imagesJson={car.images}
            overlay={<CarFavoriteButton carId={car.id} />}
            caption={
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-6 sm:p-8">
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
                    {formatMileage(car.mileageKm, locale)}
                  </span>
                </p>
              </div>
            }
          />

          <div className="grid gap-8 p-3 pt-6 lg:grid-cols-[1.35fr_1fr] lg:p-5 lg:pt-8">
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--eos-border)] pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--eos-muted)]">{d.price}</p>
                  <p className="mt-1 text-3xl font-bold text-sky-600 dark:text-sky-300 sm:text-4xl">
                    {priceDisplay.primary}
                  </p>
                  {priceDisplay.secondary ? (
                    <p className="mt-1 text-sm text-[var(--eos-muted)]">{priceDisplay.secondary}</p>
                  ) : null}
                </div>
                {car.userId ? (
                  <EosButton href={`/profil/${car.userId}`} variant="secondary" size="sm">
                    {d.sellerProfile}
                  </EosButton>
                ) : null}
              </div>

              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">{d.specs}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <SpecItem icon={Calendar} label={d.year} value={String(car.year)} />
                  <SpecItem icon={Gauge} label={d.mileage} value={formatMileage(car.mileageKm, locale)} />
                  <SpecItem icon={Fuel} label={d.fuel} value={car.fuelType} />
                  <SpecItem icon={Settings2} label={d.transmission} value={car.transmission} />
                  <SpecItem icon={CarIcon} label={d.body} value={car.bodyType} />
                  {car.exteriorColor ? <SpecItem icon={Palette} label={d.color} value={car.exteriorColor} /> : null}
                  {car.generation ? <SpecItem icon={Calendar} label={d.generation} value={car.generation} /> : null}
                  {car.enginePower ? <SpecItem icon={Cog} label={d.power} value={car.enginePower} /> : null}
                  {car.engineCapacity ? (
                    <SpecItem icon={Cog} label={d.capacity} value={`${car.engineCapacity} cm³`} />
                  ) : null}
                  {car.trimVersion ? <SpecItem icon={CarIcon} label={d.trim} value={car.trimVersion} /> : null}
                  {car.doorCount ? <SpecItem icon={CarIcon} label={d.doors} value={String(car.doorCount)} /> : null}
                  <SpecItem icon={MapPin} label={d.city} value={car.city} />
                </div>
              </div>

              {car.description?.trim() ? (
                <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-5">
                  <p className="text-sm font-semibold text-[var(--eos-text)]">{d.description}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--eos-muted)]">
                    {car.description.trim()}
                  </p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-5">
                <p className="text-sm font-semibold text-[var(--eos-text)]">{d.aboutListing}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{d.aboutBody}</p>
              </div>

              <CarVehicleChecksClient
                carId={car.id}
                vin={car.vin}
                registrationNumber={car.registrationNumber}
                firstRegistrationDate={car.firstRegistrationDate}
                insuranceValidUntil={car.insuranceValidUntil}
                restrictVehicleDocs={car.restrictVehicleDocs}
                loggedIn={currentUserId !== null}
              />

              <CarOwnerActions carId={car.id} ownerUserId={car.userId} currentUserId={currentUserId} isAdmin={isAdmin} />
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <CarInquiryPanel
                carId={car.id}
                carTitle={car.title}
                make={car.make}
                model={car.model}
                year={car.year}
                pricePln={car.pricePln}
                price={Number(car.price || car.pricePln || 0)}
                priceCurrency={(String(car.priceCurrency || "PLN").toUpperCase() === "EUR" ? "EUR" : "PLN") as "PLN" | "EUR"}
                city={car.city}
                sellerUserId={car.userId}
                currentUserId={currentUserId}
                sellerPhone={sellerPhone}
              />
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
