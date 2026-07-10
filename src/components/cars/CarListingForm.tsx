"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import CarCatalogFields from "@/components/cars/CarCatalogFields";
import CarRegistrationScanGate, {
  highlightClass,
  missingFieldsBanner,
} from "@/components/cars/CarRegistrationScanGate";
import CarVehicleDocsFields, { type CarVehicleDocsFormState } from "@/components/cars/CarVehicleDocsFields";
import type { CarListingMissingFieldKey } from "@/lib/polishRegistrationDocument.shared";
import { listMissingListingFields } from "@/lib/polishRegistrationDocument.shared";
import { formatDateForForm } from "@/utils/polishDateInput";

export type CarFormState = CarVehicleDocsFormState & {
  title: string;
  description: string;
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
  description: "",
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
  vin: "",
  registrationNumber: "",
  firstRegistrationDate: "",
  insuranceValidUntil: "",
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
    description: form.description.trim(),
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
    vin: form.vin.trim().toUpperCase(),
    registrationNumber: form.registrationNumber.trim().toUpperCase(),
    firstRegistrationDate: form.firstRegistrationDate.trim(),
    insuranceValidUntil: form.insuranceValidUntil.trim(),
  };
}

export default function CarListingForm({ mode, initialValues, carId, onSuccess }: CarListingFormProps) {
  const [form, setForm] = useState<CarFormState>(initialValues || initialCarForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);
  const [scanGateOpen, setScanGateOpen] = useState(mode === "create");
  const [highlightKeys, setHighlightKeys] = useState<CarListingMissingFieldKey[]>([]);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshHighlights = (nextForm: CarFormState, hasImages = Boolean(nextForm.imageUrl.trim())) => {
    setHighlightKeys(listMissingListingFields(nextForm, hasImages));
  };

  const applyRegistrationPrefill = (
    prefill: Partial<CarFormState>,
    missingFields: CarListingMissingFieldKey[],
  ) => {
    setScanGateOpen(false);
    setForm((prev) => {
      const next = {
        ...prev,
        ...prefill,
        title: prefill.title || prev.title,
        make: prefill.make || prev.make,
        model: prefill.model || prev.model,
        year: prefill.year || prev.year,
        fuelType: prefill.fuelType || prev.fuelType,
        bodyType: prefill.bodyType || prev.bodyType,
        enginePower: prefill.enginePower || prev.enginePower,
        engineCapacity: prefill.engineCapacity || prev.engineCapacity,
        trimVersion: prefill.trimVersion || prev.trimVersion,
        generation: prefill.generation || prev.generation,
        vin: prefill.vin || prev.vin,
        registrationNumber: prefill.registrationNumber || prev.registrationNumber,
        firstRegistrationDate: prefill.firstRegistrationDate || prev.firstRegistrationDate,
      };
      const keys = missingFields.length ? missingFields : listMissingListingFields(next, Boolean(next.imageUrl.trim()));
      setHighlightKeys(keys);
      setScanNotice(
        `Dane z dowodu wczytane. ${missingFieldsBanner(keys) || "Sprawdź katalog i uzupełnij ogłoszenie."}`,
      );
      return next;
    });
  };

  const setField = (key: keyof CarFormState, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      refreshHighlights(next);
      return next;
    });
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
        setForm((prev) => {
          const next = { ...prev, imageUrl: data.url };
          refreshHighlights(next, true);
          return next;
        });
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
      setError("Uzupełnij tytuł, markę, model, miejscowość i poprawną cenę.");
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
      if (data?.listing) {
        const listing = data.listing as Record<string, string>;
        setForm((prev) => ({
          ...prev,
          vin: listing.vin || prev.vin,
          registrationNumber: listing.registrationNumber || prev.registrationNumber,
          firstRegistrationDate: formatDateForForm(listing.firstRegistrationDate || prev.firstRegistrationDate),
          insuranceValidUntil: formatDateForForm(listing.insuranceValidUntil || prev.insuranceValidUntil),
        }));
      }
      setSuccessId(savedId);
      if (savedId) onSuccess?.(savedId);
      if (mode === "create") setForm(initialCarForm);
    } catch {
      setError("Błąd sieci podczas zapisu ogłoszenia.");
    } finally {
      setSubmitting(false);
    }
  };

  const isHighlighted = (key: CarListingMissingFieldKey) => highlightKeys.includes(key);

  return (
    <>
      {mode === "create" ? (
        <CarRegistrationScanGate
          open={scanGateOpen}
          onSkip={() => setScanGateOpen(false)}
          onPrefill={applyRegistrationPrefill}
        />
      ) : null}

      <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
        {scanNotice ? (
          <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {scanNotice}
          </p>
        ) : null}

        <CarCatalogFields form={form} setForm={setForm} />

        <label className="grid gap-1.5 text-sm">
          <span className="text-[var(--eos-muted)]">Tytuł ogłoszenia</span>
          <input
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            className={`rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50 ${highlightClass(isHighlighted("title"))}`}
            placeholder="np. BMW X5 xDrive30d M Sport"
            required
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="text-[var(--eos-muted)]">Opis</span>
          <textarea
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            className={`min-h-[120px] rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50 ${highlightClass(isHighlighted("description"))}`}
            placeholder="Opisz stan auta, historię serwisową, wyposażenie..."
          />
        </label>

      <CarVehicleDocsFields
        value={{
          vin: form.vin,
          registrationNumber: form.registrationNumber,
          firstRegistrationDate: form.firstRegistrationDate,
          insuranceValidUntil: form.insuranceValidUntil,
        }}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="text-[var(--eos-muted)]">Przebieg (km)</span>
          <input
            type="number"
            value={form.mileageKm}
            onChange={(e) => setField("mileageKm", e.target.value)}
            className={`rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50 ${highlightClass(isHighlighted("mileageKm"))}`}
            placeholder="58000"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-[var(--eos-muted)]">Cena (PLN)</span>
          <input
            type="number"
            value={form.pricePln}
            onChange={(e) => setField("pricePln", e.target.value)}
            className={`rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50 ${highlightClass(isHighlighted("pricePln"))}`}
            placeholder="319000"
            required
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="text-[var(--eos-muted)]">Miejscowość</span>
        <input
          value={form.city}
          onChange={(e) => setField("city", e.target.value)}
          className={`rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50 ${highlightClass(isHighlighted("city"))}`}
          placeholder="np. Warszawa Mokotów"
          required
        />
      </label>

      <div
        className={`grid gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-4 ${highlightClass(isHighlighted("images"))}`}
      >
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
    </>
  );
}
