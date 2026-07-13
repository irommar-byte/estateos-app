"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import CarCatalogFields from "@/components/cars/CarCatalogFields";
import CarCityMapPicker from "@/components/cars/CarCityMapPicker";
import CarFormattedNumberInput from "@/components/cars/CarFormattedNumberInput";
import CarPhotoGalleryField, { type CarPhotoGalleryFieldHandle } from "@/components/cars/CarPhotoGalleryField";
import CarPublishAuthGate from "@/components/cars/CarPublishAuthGate";
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
  cityLat: number | null;
  cityLng: number | null;
  localityCountry: string;
  imageUrl: string;
  images: string[];
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
  cityLat: null,
  cityLng: null,
  localityCountry: "Polska",
  imageUrl: "",
  images: [],
  vin: "",
  registrationNumber: "",
  firstRegistrationDate: "",
  insuranceValidUntil: "",
  restrictVehicleDocs: false,
};

type CarListingFormProps = {
  mode: "create" | "edit";
  initialValues?: CarFormState;
  carId?: number;
  onSuccess?: (id: number) => void;
};

function toPayload(form: CarFormState, images: string[]) {
  const doorCount = Number(form.doorCountSlug || form.doorCount);
  const normalizedImages = images.map((item) => item.trim()).filter(Boolean);
  const coverImage = normalizedImages[0] || form.imageUrl.trim();
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
    cityLat: form.cityLat,
    cityLng: form.cityLng,
    localityCountry: form.localityCountry.trim() || "Polska",
    imageUrl: coverImage,
    images: normalizedImages,
    vin: form.vin.trim().toUpperCase(),
    registrationNumber: form.registrationNumber.trim().toUpperCase(),
    firstRegistrationDate: form.firstRegistrationDate.trim(),
    insuranceValidUntil: form.insuranceValidUntil.trim(),
    restrictVehicleDocs: Boolean(form.restrictVehicleDocs),
  };
}

function validateForm(form: CarFormState, imageCount: number): string | null {
  const payload = toPayload(form, form.images);
  if (!payload.title || !payload.make || !payload.model || !payload.city || payload.pricePln <= 0) {
    return "Uzupełnij tytuł, markę, model, miejscowość i poprawną cenę.";
  }
  if (form.cityLat == null || form.cityLng == null) {
    return "Ustaw miejscowość na mapie — przeciągnij mapę lub wybierz z wyszukiwarki.";
  }
  if (!payload.fuelType) {
    return "Wybierz rodzaj paliwa z katalogu.";
  }
  if (imageCount <= 0) {
    return "Dodaj co najmniej jedno zdjęcie auta.";
  }
  return null;
}

export default function CarListingForm({ mode, initialValues, carId, onSuccess }: CarListingFormProps) {
  const [form, setForm] = useState<CarFormState>(initialValues || initialCarForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);
  const [scanGateOpen, setScanGateOpen] = useState(mode === "create");
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [highlightKeys, setHighlightKeys] = useState<CarListingMissingFieldKey[]>([]);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const photoGalleryRef = useRef<CarPhotoGalleryFieldHandle>(null);

  useEffect(() => {
    fetch("/api/auth/check", { cache: "no-store", credentials: "include" })
      .then((res) => res.json())
      .then((data) => setLoggedIn(Boolean(data?.loggedIn && data?.user?.id)))
      .catch(() => setLoggedIn(false));
  }, []);

  const refreshHighlights = (nextForm: CarFormState, hasImages = nextForm.images.length > 0) => {
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
      const keys = missingFields.length ? missingFields : listMissingListingFields(next, next.images.length > 0);
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

  const publishListing = async () => {
    setError(null);
    setSuccessId(null);
    setSubmitting(true);

    const imageCount = photoGalleryRef.current?.totalCount() ?? form.images.length;
    const validationError = validateForm(form, imageCount);
    if (validationError) {
      throw new Error(validationError);
    }

    try {
      let uploadedImages = form.images;
      if (photoGalleryRef.current?.hasPending()) {
        uploadedImages = await photoGalleryRef.current.uploadPending();
        setForm((prev) => ({
          ...prev,
          images: uploadedImages,
          imageUrl: uploadedImages[0] || "",
        }));
      }

      const payload = toPayload(form, uploadedImages);
      const response = await fetch(mode === "create" ? "/api/cars" : `/api/cars/${carId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Nie udało się zapisać ogłoszenia.");
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
      setAuthGateOpen(false);
      setLoggedIn(true);
      setSuccessId(savedId);
      if (savedId) onSuccess?.(savedId);
      if (mode === "create") setForm(initialCarForm);
    } catch (publishError) {
      throw publishError instanceof Error ? publishError : new Error("Błąd sieci podczas zapisu ogłoszenia.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const imageCount = photoGalleryRef.current?.totalCount() ?? form.images.length;
    const validationError = validateForm(form, imageCount);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!loggedIn && mode === "create") {
      setAuthGateOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      await publishListing();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Błąd sieci podczas zapisu ogłoszenia.");
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

      <CarPublishAuthGate
        open={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        onAuthenticated={publishListing}
      />

      <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
        {!loggedIn && mode === "create" ? (
          <p className="rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            Możesz wypełnić formularz bez logowania. Po kliknięciu „Opublikuj” założysz konto — ogłoszenie trafi od
            razu do katalogu, a Ty dostaniesz powiadomienia o zapytaniach.
          </p>
        ) : null}

        {scanNotice ? (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-50">
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
            restrictVehicleDocs: form.restrictVehicleDocs,
          }}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          loggedIn={loggedIn}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="text-[var(--eos-muted)]">Przebieg (km)</span>
            <CarFormattedNumberInput
              value={form.mileageKm}
              onChange={(digits) => setField("mileageKm", digits)}
              className={`rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50 ${highlightClass(isHighlighted("mileageKm"))}`}
              placeholder="58 000"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-[var(--eos-muted)]">Cena (PLN)</span>
            <CarFormattedNumberInput
              value={form.pricePln}
              onChange={(digits) => setField("pricePln", digits)}
              className={`rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50 ${highlightClass(isHighlighted("pricePln"))}`}
              placeholder="319 000"
              required
            />
          </label>
        </div>

        <CarCityMapPicker
          city={form.city}
          cityLat={form.cityLat}
          cityLng={form.cityLng}
          localityCountry={form.localityCountry}
          highlighted={isHighlighted("city")}
          onChange={(selection) => {
            setForm((prev) => {
              const next = {
                ...prev,
                city: selection.city,
                cityLat: selection.cityLat,
                cityLng: selection.cityLng,
                localityCountry: selection.localityCountry || prev.localityCountry,
              };
              refreshHighlights(next);
              return next;
            });
          }}
        />

        <CarPhotoGalleryField
          ref={photoGalleryRef}
          images={form.images}
          loggedIn={loggedIn}
          highlighted={isHighlighted("images")}
          onUploadingChange={setUploading}
          onChange={(images) => {
            setForm((prev) => {
              const next = {
                ...prev,
                images,
                imageUrl: images[0] || "",
              };
              refreshHighlights(next, images.length > 0);
              return next;
            });
          }}
        />

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {successId ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <p className="font-semibold">Ogłoszenie opublikowane i widoczne w katalogu Cars.</p>
            <p className="mt-1 text-emerald-100/80">
              Możesz edytować zdjęcia i dane w każdej chwili — powiadomienia o zapytaniach trafią na Twoje konto.
            </p>
            <Link className="mt-2 inline-block font-bold underline" href={`/cars/${successId}`}>
              Zobacz ogłoszenie
            </Link>
            {" · "}
            <Link className="font-bold underline" href={`/cars/${successId}/edytuj`}>
              Edytuj
            </Link>
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting || uploading}
            className="rounded-full border border-sky-400/40 bg-sky-500/10 px-5 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Publikowanie..." : mode === "create" ? "Opublikuj ogłoszenie Cars" : "Zapisz zmiany"}
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
