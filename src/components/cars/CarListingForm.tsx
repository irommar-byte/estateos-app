"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import CarCatalogFields from "@/components/cars/CarCatalogFields";

export type CarFormState = {
  title: string;
  make: string;
  model: string;
  makeSlug: string;
  modelSlug: string;
  year: string;
  mileageKm: string;
  fuelType: string;
  fuelSlug: string;
  transmission: string;
  gearboxSlug: string;
  bodyType: string;
  generation: string;
  generationSlug: string;
  enginePower: string;
  enginePowerSlug: string;
  engineCapacity: string;
  engineCapacitySlug: string;
  trimVersion: string;
  trimVersionSlug: string;
  doorCount: string;
  doorCountSlug: string;
  pricePln: string;
  city: string;
  imageUrl: string;
};

export const initialCarForm: CarFormState = {
  title: "",
  make: "",
  model: "",
  makeSlug: "",
  modelSlug: "",
  year: "",
  mileageKm: "",
  fuelType: "",
  fuelSlug: "",
  transmission: "Automatyczna",
  gearboxSlug: "",
  bodyType: "SUV",
  generation: "",
  generationSlug: "",
  enginePower: "",
  enginePowerSlug: "",
  engineCapacity: "",
  engineCapacitySlug: "",
  trimVersion: "",
  trimVersionSlug: "",
  doorCount: "",
  doorCountSlug: "",
  pricePln: "",
  city: "",
  imageUrl: "",
};

type CarListingFormProps = {
  mode: "create" | "edit";
  initialValues?: CarFormState;
  carId?: number;
  onSuccess?: (id: number) => void;
};

function toPayload(form: CarFormState) {
  const doorCount = Number(form.doorCountSlug || form.doorCount);
  return {
    title: form.title.trim(),
    make: form.make.trim(),
    model: form.model.trim(),
    year: Number(form.year),
    mileageKm: Number(form.mileageKm),
    fuelType: form.fuelType.trim(),
    transmission: form.transmission.trim(),
    bodyType: form.bodyType.trim(),
    generation: form.generation.trim(),
    enginePower: form.enginePower.trim(),
    engineCapacity: form.engineCapacity.trim(),
    trimVersion: form.trimVersion.trim(),
    doorCount: Number.isFinite(doorCount) && doorCount > 0 ? doorCount : null,
    pricePln: Number(form.pricePln),
    city: form.city.trim(),
    imageUrl: form.imageUrl.trim(),
  };
}

export default function CarListingForm({ mode, initialValues, carId, onSuccess }: CarListingFormProps) {
  const [form, setForm] = useState<CarFormState>(initialValues || initialCarForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setField = (key: keyof CarFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload/cars", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Upload zdjęcia nie powiódł się.");
      }
      if (typeof data?.url === "string" && data.url) {
        setField("imageUrl", data.url);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload zdjęcia nie powiódł się.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessId(null);
    setSubmitting(true);

    const payload = toPayload(form);
    if (!payload.title || !payload.make || !payload.model || !payload.city || payload.pricePln <= 0) {
      setError("Uzupełnij tytuł, markę, model, miasto i poprawną cenę.");
      setSubmitting(false);
      return;
    }
    if (!payload.fuelType) {
      setError("Wybierz rodzaj paliwa z katalogu.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(mode === "create" ? "/api/cars" : `/api/cars/${carId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Nie udało się zapisać ogłoszenia.");
        setSubmitting(false);
        return;
      }

      const savedId = Number(data?.listing?.id || carId || 0) || null;
      setSuccessId(savedId);
      if (savedId) onSuccess?.(savedId);
      if (mode === "create") setForm(initialCarForm);
    } catch {
      setError("Błąd sieci podczas zapisu ogłoszenia.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
      <CarCatalogFields form={form} setForm={setForm} />

      <label className="grid gap-1.5 text-sm">
        <span className="text-[var(--eos-muted)]">Tytuł ogłoszenia</span>
        <input
          value={form.title}
          onChange={(e) => setField("title", e.target.value)}
          className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
          placeholder="np. BMW X5 xDrive30d M Sport"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="text-[var(--eos-muted)]">Przebieg (km)</span>
          <input
            type="number"
            value={form.mileageKm}
            onChange={(e) => setField("mileageKm", e.target.value)}
            className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
            placeholder="58000"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-[var(--eos-muted)]">Cena (PLN)</span>
          <input
            type="number"
            value={form.pricePln}
            onChange={(e) => setField("pricePln", e.target.value)}
            className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
            placeholder="319000"
            required
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="text-[var(--eos-muted)]">Miasto</span>
        <input
          value={form.city}
          onChange={(e) => setField("city", e.target.value)}
          className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
          placeholder="Warszawa"
          required
        />
      </label>

      <div className="grid gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-4">
        <p className="text-sm font-semibold">Zdjęcie główne</p>
        {form.imageUrl ? (
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-[var(--eos-border)]">
            <Image src={form.imageUrl} alt="Podgląd auta" fill className="object-cover" unoptimized />
          </div>
        ) : (
          <p className="text-sm text-[var(--eos-muted)]">Brak zdjęcia — możesz wgrać plik lub wkleić URL poniżej.</p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-sky-300 disabled:opacity-60"
          >
            {uploading ? "Wgrywanie..." : "Wgraj zdjęcie"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>
        <label className="grid gap-1.5 text-sm">
          <span className="text-[var(--eos-muted)]">URL zdjęcia (opcjonalnie)</span>
          <input
            value={form.imageUrl}
            onChange={(e) => setField("imageUrl", e.target.value)}
            className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2 outline-none focus:border-sky-400/50"
            placeholder="https://..."
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {successId ? (
        <p className="text-sm text-emerald-300">
          Ogłoszenie zapisane.{" "}
          <Link className="underline" href={`/cars/${successId}`}>
            Przejdź do szczegółów
          </Link>
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting || uploading}
          className="rounded-full border border-sky-400/40 bg-sky-500/10 px-5 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Zapisywanie..." : mode === "create" ? "Opublikuj ogłoszenie Cars" : "Zapisz zmiany"}
        </button>
        <Link
          href={mode === "edit" && carId ? `/cars/${carId}` : "/cars"}
          className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-5 py-2 text-xs font-black uppercase tracking-[0.14em]"
        >
          Anuluj
        </Link>
      </div>
    </form>
  );
}
