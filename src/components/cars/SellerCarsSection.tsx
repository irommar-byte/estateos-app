"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { formatCarPrice } from "@/lib/carsPresentation";

type CarPreview = {
  id: number;
  title: string;
  make: string;
  model: string;
  year: number;
  city: string;
  pricePln: number;
  imageUrl?: string;
};

function carImageSrc(imageUrl?: string) {
  const trimmed = String(imageUrl || "").trim();
  if (!trimmed) {
    return "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80";
  }
  return trimmed;
}

export default function SellerCarsSection({ userId }: { userId: number }) {
  const { dict, locale } = useLocale();
  const s = dict.cars.seller;
  const [cars, setCars] = useState<CarPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cars?userId=${userId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        if (!cancelled) setCars(Array.isArray(payload) ? payload : []);
      })
      .catch(() => {
        if (!cancelled) setCars([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading || cars.length === 0) return null;

  return (
    <section className="mx-auto mt-10 max-w-6xl px-4 pb-16 sm:px-6">
      <div className="mb-5 flex items-end justify-between gap-4 border-b border-[var(--eos-border)] pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-500">{s.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--eos-text)]">{s.title}</h2>
        </div>
        <Link href="/cars" className="text-xs font-black uppercase tracking-[0.12em] text-sky-600 hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200">
          {dict.cars.common.carsCatalog}
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cars.map((car) => (
          <Link
            key={car.id}
            href={`/cars/${car.id}`}
            className="overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] transition hover:border-sky-400/40"
          >
            <div className="relative aspect-[16/10]">
              <Image src={carImageSrc(car.imageUrl)} alt={car.title} fill className="object-cover" unoptimized />
            </div>
            <div className="space-y-1 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-300">
                {car.make} · {car.model} · {car.year}
              </p>
              <h3 className="line-clamp-2 font-semibold">{car.title}</h3>
              <p className="text-sm text-[var(--eos-muted)]">{car.city}</p>
              <p className="font-bold text-sky-600 dark:text-sky-300">{formatCarPrice(car.pricePln, locale)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
