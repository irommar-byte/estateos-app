"use client";

import Link from "next/link";
import CarListingForm, { type CarFormState } from "@/components/cars/CarListingForm";
import { useLocale } from "@/contexts/LocaleContext";

type EditCarPageProps = {
  carId: number;
  initialValues: CarFormState;
};

export default function EditCarPageClient({ carId, initialValues }: EditCarPageProps) {
  const { dict } = useLocale();
  const e = dict.cars.edit;

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-500">EstateOS™Car</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{e.pageTitle}</h1>
        <p className="mt-4 text-sm text-[var(--eos-muted)] sm:text-base">{e.pageDescription}</p>
        <CarListingForm mode="edit" carId={carId} initialValues={initialValues} />
        <div className="mt-4">
          <Link href={`/cars/${carId}`} className="text-xs font-black uppercase tracking-[0.12em] text-sky-600 hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200">
            {e.backToDetails}
          </Link>
        </div>
      </div>
    </main>
  );
}
