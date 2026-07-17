"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import type { CarsDictionary } from "@/i18n/carsDictionary";
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
import {
  CarFormField,
  CarFormSection,
  carAlertErrorClass,
  carAlertInfoClass,
  carAlertSuccessClass,
  carAlertWarningClass,
  carFieldInputClass,
} from "@/components/cars/carFormStyles";
import type { CarAddEntryMethod } from "@/components/cars/CarAddEntryScreen";
import type { CarListingMissingFieldKey } from "@/lib/polishRegistrationDocument.shared";
import { listMissingListingFields } from "@/lib/polishRegistrationDocument.shared";
import {
  OTOMOTO_IMPORT_STORAGE_KEY,
  type OtomotoCarImportPrefill,
} from "@/lib/otomotoCarImport";
import { formatDateForForm } from "@/utils/polishDateInput";

const CAR_DRAFT_VERSION = 1;
const CAR_DRAFT_KEY = "estateos_car_listing_draft_v1";

function scanGateForEntryMethod(method?: CarAddEntryMethod) {
  return method === "scan" || method === "capture" || method === "upload";
}

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
  exteriorColor: string;
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
  exteriorColor: "",
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
  entryMethod?: CarAddEntryMethod;
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
    exteriorColor: form.exteriorColor.trim(),
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

function validateForm(form: CarFormState, imageCount: number, f: CarsDictionary["form"]): string | null {
  const payload = toPayload(form, form.images);
  if (!payload.title || !payload.make || !payload.model || !payload.city || payload.pricePln <= 0) {
    return f.errTitlePrice;
  }
  if (form.cityLat == null || form.cityLng == null) {
    return f.errMapCity;
  }
  if (!payload.fuelType) {
    return f.errFuel;
  }
  if (imageCount <= 0) {
    return f.errPhotos;
  }
  return null;
}

export default function CarListingForm({
  mode,
  initialValues,
  carId,
  onSuccess,
  entryMethod,
}: CarListingFormProps) {
  const { dict } = useLocale();
  const c = dict.cars;
  const f = c.form;
  const [form, setForm] = useState<CarFormState>(initialValues || initialCarForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);
  const [scanGateOpen, setScanGateOpen] = useState(mode === "create" && scanGateForEntryMethod(entryMethod));
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [highlightKeys, setHighlightKeys] = useState<CarListingMissingFieldKey[]>([]);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [draftReady, setDraftReady] = useState(mode !== "create");
  const photoGalleryRef = useRef<CarPhotoGalleryFieldHandle>(null);
  const draftTimerRef = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/check", { cache: "no-store", credentials: "include" })
      .then((res) => res.json())
      .then((data) => setLoggedIn(Boolean(data?.loggedIn && data?.user?.id)))
      .catch(() => setLoggedIn(false));
  }, []);

  useEffect(() => {
    if (mode !== "create" || typeof window === "undefined") {
      setDraftReady(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(CAR_DRAFT_KEY);
      if (!raw) {
        setDraftReady(true);
        return;
      }
      const parsed = JSON.parse(raw) as { version?: number; form?: CarFormState };
      if (parsed?.version === CAR_DRAFT_VERSION && parsed.form) {
        setForm((prev) => ({ ...prev, ...parsed.form }));
      }
    } catch {
      // ignore corrupt draft
    } finally {
      setDraftReady(true);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "create" || !draftReady || typeof window === "undefined") return;
    const fromParam = new URLSearchParams(window.location.search).get("from");
    if (entryMethod !== "otomoto" && fromParam !== "otomoto") {
      return;
    }
    try {
      const raw = sessionStorage.getItem(OTOMOTO_IMPORT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        prefill?: OtomotoCarImportPrefill;
        missingFields?: CarListingMissingFieldKey[];
      };
      if (!parsed?.prefill) return;
      const prefill = parsed.prefill;
      setForm((prev) => {
        const next: CarFormState = {
          ...prev,
          title: prefill.title || prev.title,
          description: prefill.description || prev.description,
          make: prefill.make || prev.make,
          model: prefill.model || prev.model,
          year: prefill.year || prev.year,
          mileageKm: prefill.mileageKm || prev.mileageKm,
          fuelType: prefill.fuelType || prev.fuelType,
          transmission: prefill.transmission || prev.transmission,
          bodyType: prefill.bodyType || prev.bodyType,
          exteriorColor: prefill.exteriorColor || prev.exteriorColor,
          generation: prefill.generation || prev.generation,
          enginePower: prefill.enginePower || prev.enginePower,
          engineCapacity: prefill.engineCapacity || prev.engineCapacity,
          trimVersion: prefill.trimVersion || prev.trimVersion,
          doorCount: prefill.doorCount || prev.doorCount,
          pricePln: prefill.pricePln || prev.pricePln,
          city: prefill.city || prev.city,
          cityLat: prefill.cityLat ?? prev.cityLat,
          cityLng: prefill.cityLng ?? prev.cityLng,
          localityCountry: prefill.localityCountry || prev.localityCountry,
          imageUrl: prefill.imageUrl || prev.imageUrl,
          images: prefill.images?.length ? prefill.images : prev.images,
        };
        const keys =
          parsed.missingFields?.length
            ? parsed.missingFields
            : listMissingListingFields(next, next.images.length > 0);
        setHighlightKeys(keys);
        setScanNotice(
          `${f.otomotoLoaded} ${missingFieldsBanner(keys, c.scan) || f.otomotoCheckForm}`,
        );
        try {
          window.localStorage.setItem(
            CAR_DRAFT_KEY,
            JSON.stringify({
              version: CAR_DRAFT_VERSION,
              savedAt: Date.now(),
              form: { ...next, images: next.images.filter((url) => !url.startsWith("blob:")) },
            }),
          );
        } catch {
          // ignore quota
        }
        return next;
      });
      sessionStorage.removeItem(OTOMOTO_IMPORT_STORAGE_KEY);
    } catch {
      // ignore corrupt import payload
    }
  }, [mode, draftReady, entryMethod, f.otomotoLoaded, f.otomotoCheckForm, c.scan]);

  useEffect(() => {
    if (mode !== "create" || !draftReady || typeof window === "undefined") return;
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(() => {
      try {
        const serializable = {
          ...form,
          images: form.images.filter((url) => !url.startsWith("blob:")),
        };
        window.localStorage.setItem(
          CAR_DRAFT_KEY,
          JSON.stringify({ version: CAR_DRAFT_VERSION, savedAt: Date.now(), form: serializable }),
        );
      } catch {
        // ignore quota errors
      }
    }, 450);
    return () => {
      if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    };
  }, [form, mode, draftReady]);

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
        `${f.scanLoaded} ${missingFieldsBanner(keys, c.scan) || f.scanCheckCatalog}`,
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
    const validationError = validateForm(form, imageCount, f);
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
        throw new Error(typeof data?.error === "string" ? data.error : c.common.saveFailed);
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
      if (mode === "create") {
        if (typeof window !== "undefined") window.localStorage.removeItem(CAR_DRAFT_KEY);
        setForm(initialCarForm);
      }
    } catch (publishError) {
      throw publishError instanceof Error ? publishError : new Error(c.common.networkError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const imageCount = photoGalleryRef.current?.totalCount() ?? form.images.length;
    const validationError = validateForm(form, imageCount, f);
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
      setError(publishError instanceof Error ? publishError.message : c.common.networkError);
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
          preferUpload={entryMethod === "upload"}
          onSkip={() => setScanGateOpen(false)}
          onPrefill={applyRegistrationPrefill}
        />
      ) : null}

      <CarPublishAuthGate
        open={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        onAuthenticated={publishListing}
      />

      <form onSubmit={handleSubmit} className="grid gap-6">
        {!loggedIn && mode === "create" ? (
          <p className={carAlertInfoClass}>{f.guestBanner}</p>
        ) : null}

        {scanNotice ? (
          <p className={carAlertWarningClass}>{scanNotice}</p>
        ) : null}

        <CarCatalogFields form={form} setForm={setForm} />

        <CarFormSection eyebrow={f.contentEyebrow} title={f.contentTitle} description={f.contentDescription}>
          <CarFormField label={f.titleLabel}>
            <input
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              className={`${carFieldInputClass} ${highlightClass(isHighlighted("title"))}`}
              placeholder={f.titlePlaceholder}
              required
            />
          </CarFormField>

          <CarFormField label={f.descriptionLabel}>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              className={`min-h-[140px] resize-y ${carFieldInputClass} ${highlightClass(isHighlighted("description"))}`}
              placeholder={f.descriptionPlaceholder}
            />
          </CarFormField>
        </CarFormSection>

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

        <CarFormSection eyebrow={f.offerEyebrow} title={f.offerTitle} description={f.offerDescription}>
          <div className="grid gap-4 sm:grid-cols-2">
            <CarFormField label={f.mileageLabel}>
              <CarFormattedNumberInput
                value={form.mileageKm}
                onChange={(digits) => setField("mileageKm", digits)}
                className={`${carFieldInputClass} ${highlightClass(isHighlighted("mileageKm"))}`}
                placeholder="58 000"
              />
            </CarFormField>
            <CarFormField label={f.priceLabel}>
              <CarFormattedNumberInput
                value={form.pricePln}
                onChange={(digits) => setField("pricePln", digits)}
                className={`${carFieldInputClass} ${highlightClass(isHighlighted("pricePln"))}`}
                placeholder="319 000"
                required
              />
            </CarFormField>
          </div>
        </CarFormSection>

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

        {error ? <p className={carAlertErrorClass}>{error}</p> : null}
        {successId ? (
          <div className={carAlertSuccessClass}>
            <p className="font-semibold">{f.successTitle}</p>
            <p className="mt-1 opacity-90">{f.successBody}</p>
            <Link className="mt-2 inline-block font-bold underline" href={`/cars/${successId}`}>
              {c.common.viewListing}
            </Link>
            {" · "}
            <Link className="font-bold underline" href={`/cars/${successId}/edytuj`}>
              {c.common.edit}
            </Link>
          </div>
        ) : null}

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-sky-400/25 bg-[var(--eos-card)]/95 px-5 py-4 shadow-[0_18px_50px_rgba(14,165,233,0.12)] backdrop-blur-md">
          <p className="text-xs text-[var(--eos-muted)]">
            {mode === "create" ? f.footerCreate : f.footerEdit}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting || uploading}
              className="rounded-full border border-sky-400/45 bg-sky-500/15 px-6 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-sky-800 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-200"
            >
              {submitting ? f.publishing : mode === "create" ? f.publish : f.saveChanges}
            </button>
            <Link
              href={mode === "edit" && carId ? `/cars/${carId}` : "/cars"}
              className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-6 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[var(--eos-text)]"
            >
              {c.common.cancel}
            </Link>
          </div>
        </div>
      </form>
    </>
  );
}
