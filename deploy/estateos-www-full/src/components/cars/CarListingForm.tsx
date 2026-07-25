"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import SiriMagicButton from "@/components/ui/SiriMagicButton";
import { typewriterReveal } from "@/lib/typewriterReveal";
import { useLocale } from "@/contexts/LocaleContext";
import { useFxRate } from "@/contexts/FxRateContext";
import { convertBetweenCurrencies } from "@/lib/money/convert";
import { formatApproxLine } from "@/lib/money/format";
import type { ListingCurrency } from "@/lib/money/types";
import type { CarsDictionary } from "@/i18n/carsDictionary";
import CarCatalogFields from "@/components/cars/CarCatalogFields";
import CarCityMapPicker from "@/components/cars/CarCityMapPicker";
import CarFormattedNumberInput from "@/components/cars/CarFormattedNumberInput";
import CarPhotoGalleryField, { type CarPhotoGalleryFieldHandle } from "@/components/cars/CarPhotoGalleryField";
import CarPublishAuthGate from "@/components/cars/CarPublishAuthGate";
import CarPublishSuccessModal from "@/components/cars/CarPublishSuccessModal";
import CarRegistrationScanGate, {
  highlightClass,
  missingFieldsBanner,
} from "@/components/cars/CarRegistrationScanGate";
import CarVehicleDocsFields, { type CarVehicleDocsFormState } from "@/components/cars/CarVehicleDocsFields";
import AppleStyleSwitch from "@/components/ui/AppleStyleSwitch";
import EosButton from "@/components/ui/EosButton";
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
import {
  clearCarListingDraft,
  readCarListingDraft,
  writeCarListingDraft,
} from "@/lib/carListingDraft";
import { formatDateForForm } from "@/utils/polishDateInput";
import {
  DEFAULT_VEHICLE_TYPE,
  normalizeVehicleType,
  type VehicleType,
} from "@/lib/vehicleTypes";
import type { AuthGateContext } from "@/components/auth/PublishAuthGate";

function scanGateForEntryMethod(method?: CarAddEntryMethod) {
  return method === "scan" || method === "capture" || method === "upload";
}

function formFromOtomotoPrefill(prefill: OtomotoCarImportPrefill): CarFormState {
  return {
    ...initialCarForm,
    vehicleType: normalizeVehicleType((prefill as { vehicleType?: VehicleType }).vehicleType),
    title: prefill.title || "",
    description: prefill.description || "",
    make: prefill.make || "",
    model: prefill.model || "",
    year: prefill.year || "",
    mileageKm: prefill.mileageKm || "",
    fuelType: prefill.fuelType || initialCarForm.fuelType,
    transmission: prefill.transmission || initialCarForm.transmission,
    bodyType: prefill.bodyType || initialCarForm.bodyType,
    exteriorColor: prefill.exteriorColor || "",
    generation: prefill.generation || "",
    enginePower: prefill.enginePower || "",
    engineCapacity: prefill.engineCapacity || "",
    trimVersion: prefill.trimVersion || "",
    doorCount: prefill.doorCount || "",
    pricePln: prefill.pricePln || "",
    city: prefill.city || "",
    cityLat: prefill.cityLat ?? null,
    cityLng: prefill.cityLng ?? null,
    localityCountry: prefill.localityCountry || "Polska",
    imageUrl: prefill.imageUrl || "",
    images: prefill.images?.length ? [...prefill.images] : [],
    vin: prefill.vin || "",
    registrationNumber: prefill.registrationNumber || "",
    firstRegistrationDate: prefill.firstRegistrationDate || "",
    insuranceValidUntil: "",
    restrictVehicleDocs: true,
    showContactPhone: false,
    makeSlug: "",
    modelSlug: "",
    fuelSlug: "",
    gearboxSlug: "",
    generationSlug: "",
    enginePowerSlug: "",
    engineCapacitySlug: "",
    trimVersionSlug: "",
    doorCountSlug: "",
  };
}

export type CarFormState = CarVehicleDocsFormState & {
  vehicleType: VehicleType;
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
  priceCurrency: ListingCurrency;
  city: string;
  cityLat: number | null;
  cityLng: number | null;
  localityCountry: string;
  imageUrl: string;
  images: string[];
  showContactPhone: boolean;
};

export const initialCarForm: CarFormState = {
  vehicleType: DEFAULT_VEHICLE_TYPE,
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
  priceCurrency: "PLN",
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
  showContactPhone: false,
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
    vehicleType: normalizeVehicleType(form.vehicleType),
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
    price: Number(form.pricePln),
    priceAmount: Number(form.pricePln),
    priceCurrency: form.priceCurrency === "EUR" ? "EUR" : "PLN",
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
    showContactPhone: Boolean(form.showContactPhone),
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

type AiMissingField = { key: string; label: string };

function listMissingFieldsForAiDescription(
  form: CarFormState,
  imageCount: number,
  dict: CarsDictionary,
): AiMissingField[] {
  const cf = dict.catalogFields;
  const f = dict.form;
  const map = dict.map;
  const photos = dict.photos;
  const missing: AiMissingField[] = [];

  if (!form.make.trim()) missing.push({ key: "make", label: cf.makeLabel });
  if (!form.model.trim()) missing.push({ key: "model", label: cf.modelLabel });
  if (!form.year.trim() || !Number(form.year)) missing.push({ key: "year", label: cf.yearLabel });
  if (!form.fuelType.trim()) missing.push({ key: "fuelType", label: cf.fuelLabel });
  if (!form.mileageKm.trim() || !Number.isFinite(Number(form.mileageKm)) || Number(form.mileageKm) < 0) {
    missing.push({ key: "mileageKm", label: f.mileageLabel });
  }
  if (!form.pricePln.trim() || Number(form.pricePln) <= 0) missing.push({ key: "pricePln", label: f.priceLabel });
  if (!form.city.trim() || form.cityLat == null || form.cityLng == null) {
    missing.push({ key: "city", label: map.cityLabel });
  }
  if (imageCount <= 0) missing.push({ key: "images", label: photos.title });

  return missing;
}

export default function CarListingForm({
  mode,
  initialValues,
  carId,
  onSuccess,
  entryMethod,
}: CarListingFormProps) {
  const { dict, locale } = useLocale();
  const { rate: fxRate, rateDate: fxDate } = useFxRate();
  const c = dict.cars;
  const f = c.form;
  const [form, setForm] = useState<CarFormState>(initialValues || initialCarForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);
  const [scanGateOpen, setScanGateOpen] = useState(mode === "create" && scanGateForEntryMethod(entryMethod));
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authGateContext, setAuthGateContext] = useState<AuthGateContext>("publish");
  const [highlightKeys, setHighlightKeys] = useState<CarListingMissingFieldKey[]>([]);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [draftReady, setDraftReady] = useState(mode !== "create");
  const [fillingFromDocs, setFillingFromDocs] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiDetailsNotes, setAiDetailsNotes] = useState("");
  const typewriterCancelRef = useRef<null | (() => void)>(null);
  const [aiMissingNotice, setAiMissingNotice] = useState<string | null>(null);
  const photoGalleryRef = useRef<CarPhotoGalleryFieldHandle>(null);
  const draftTimerRef = useRef<number | null>(null);
  const pendingAiAfterAuthRef = useRef(false);

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
    // Pending Otomoto import always wins — never restore an older draft over it.
    const pendingOtomoto = sessionStorage.getItem(OTOMOTO_IMPORT_STORAGE_KEY);
    if (pendingOtomoto) {
      setDraftReady(true);
      return;
    }
    const parsed = readCarListingDraft();
    if (parsed?.form) {
      setForm((prev) => ({ ...prev, ...parsed.form }));
    }
    setDraftReady(true);
  }, [mode, entryMethod]);

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
      const next = formFromOtomotoPrefill(parsed.prefill);
      clearCarListingDraft();
      sessionStorage.removeItem(OTOMOTO_IMPORT_STORAGE_KEY);
      setForm(next);
      const keys =
        parsed.missingFields?.length
          ? parsed.missingFields
          : listMissingListingFields(next, next.images.length > 0);
      setHighlightKeys(keys);
      setScanNotice(
        `${f.otomotoLoaded} ${missingFieldsBanner(keys, c.scan) || f.otomotoCheckForm}`,
      );
      writeCarListingDraft(next);
    } catch {
      // ignore corrupt import payload
    }
  }, [mode, draftReady, entryMethod, f.otomotoLoaded, f.otomotoCheckForm, c.scan]);

  useEffect(() => {
    if (mode !== "create" || !draftReady || typeof window === "undefined") return;
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(() => {
      writeCarListingDraft(form);
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
        vehicleType: normalizeVehicleType(prefill.vehicleType || prev.vehicleType),
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
        insuranceValidUntil: prefill.insuranceValidUntil || prev.insuranceValidUntil,
        // Force catalog cascade to rematch imported labels.
        makeSlug: "",
        modelSlug: "",
        fuelSlug: "",
        gearboxSlug: "",
        generationSlug: "",
        enginePowerSlug: "",
        engineCapacitySlug: "",
        trimVersionSlug: "",
        doorCountSlug: "",
      };
      const keys = missingFields.length ? missingFields : listMissingListingFields(next, next.images.length > 0);
      setHighlightKeys(keys);
      setScanNotice(
        `${f.scanLoaded} ${missingFieldsBanner(keys, c.scan) || f.scanCheckCatalog}`,
      );
      return next;
    });
  };

  const fillFormFromDocs = async () => {
    setError(null);
    setFillingFromDocs(true);
    try {
      const response = await fetch("/api/cars/docs-prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vin: form.vin,
          registrationNumber: form.registrationNumber,
          firstRegistrationDate: form.firstRegistrationDate,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.prefill) {
        throw new Error(typeof data?.error === "string" ? data.error : dict.cars.docs.errFillFromVin);
      }
      applyRegistrationPrefill(data.prefill, data.missingFields || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.cars.docs.errFillFromVin);
    } finally {
      setFillingFromDocs(false);
    }
  };

  const setField = (key: keyof CarFormState, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      refreshHighlights(next);
      return next;
    });
  };

  const publishListing = async (report?: (step: string) => void) => {
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
        report?.("Wgrywam lokalne zdjęcia…");
        uploadedImages = await photoGalleryRef.current.uploadPending();
        setForm((prev) => ({
          ...prev,
          images: uploadedImages,
          imageUrl: uploadedImages[0] || "",
        }));
      } else if (uploadedImages.some((url) => /^https?:\/\//i.test(url) && !url.includes("/uploads/cars/"))) {
        report?.(`Przygotowuję ${uploadedImages.length} zdjęć z Otomoto…`);
      }

      report?.("Zapisuję ogłoszenie w katalogu Cars…");
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

      report?.("Ogłoszenie opublikowane.");
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
        clearCarListingDraft();
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
      pendingAiAfterAuthRef.current = false;
      setAuthGateContext("publish");
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

  const runGenerateAiDescription = async () => {
    setIsGeneratingAI(true);
    setError(null);
    try {
      const response = await fetch("/api/cars/description/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          locale,
          vehicleType: form.vehicleType,
          make: form.make,
          model: form.model,
          year: form.year,
          mileageKm: form.mileageKm,
          fuelType: form.fuelType,
          transmission: form.transmission,
          bodyType: form.bodyType,
          exteriorColor: form.exteriorColor,
          generation: form.generation,
          enginePower: form.enginePower,
          engineCapacity: form.engineCapacity,
          trimVersion: form.trimVersion,
          doorCount: form.doorCount || form.doorCountSlug,
          city: form.city,
          localityCountry: form.localityCountry,
          title: form.title,
          existingDescription: form.description,
          userNotes: aiDetailsNotes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        pendingAiAfterAuthRef.current = true;
        setAuthGateContext("ai_description");
        setAuthGateOpen(true);
        return;
      }
      if (!response.ok || !payload?.success || !String(payload?.description || "").trim()) {
        throw new Error(String(payload?.error || f.aiGenFailed));
      }
      const plain = String(payload.description).trim();
      typewriterCancelRef.current?.();
      const controller = typewriterReveal(
        plain,
        (partial) => setField("description", partial),
        {
          chunk: 4,
          intervalMs: 14,
          onDone: () => {
            typewriterCancelRef.current = null;
          },
        },
      );
      typewriterCancelRef.current = controller.cancel;
      setAiMissingNotice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : f.aiGenFailed);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGenerateAI = async () => {
    setAiMissingNotice(null);
    const imageCount = photoGalleryRef.current?.totalCount() ?? form.images.length;
    const missing = listMissingFieldsForAiDescription(form, imageCount, c);
    if (missing.length) {
      setAiMissingNotice(`${f.aiMissingPrefix} ${missing.map((item) => item.label).join(", ")}.`);
      return;
    }

    if (!loggedIn) {
      pendingAiAfterAuthRef.current = true;
      setAuthGateContext("ai_description");
      setAuthGateOpen(true);
      return;
    }

    await runGenerateAiDescription();
  };

  const isHighlighted = (key: CarListingMissingFieldKey) => highlightKeys.includes(key);

  return (
    <>
      {mode === "create" ? (
        <CarRegistrationScanGate
          open={scanGateOpen}
          preferUpload={entryMethod === "upload" || entryMethod === "capture"}
          onSkip={() => setScanGateOpen(false)}
          onPrefill={applyRegistrationPrefill}
        />
      ) : null}

      <CarPublishAuthGate
        open={authGateOpen}
        context={authGateContext}
        onClose={() => {
          pendingAiAfterAuthRef.current = false;
          setAuthGateOpen(false);
          setAuthGateContext("publish");
        }}
        onAuthenticated={async (report) => {
          setLoggedIn(true);
          if (pendingAiAfterAuthRef.current || authGateContext === "ai_description") {
            pendingAiAfterAuthRef.current = false;
            setAuthGateOpen(false);
            setAuthGateContext("publish");
            report("Generuję opis AI…");
            await runGenerateAiDescription();
            return;
          }
          await publishListing(report);
        }}
      />

      <form onSubmit={handleSubmit} className="grid gap-6 pb-28">
        {!loggedIn && mode === "create" ? (
          <p className={carAlertInfoClass}>{f.guestBanner}</p>
        ) : null}

        {scanNotice ? (
          <p className={carAlertWarningClass}>{scanNotice}</p>
        ) : null}

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
          onRequestScan={() => setScanGateOpen(true)}
          onFillFromDocs={fillFormFromDocs}
          fillingFromDocs={fillingFromDocs}
        />

        <CarCatalogFields form={form} setForm={setForm} />

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
            <CarFormField label={f.priceLabel.replace("(PLN)", "").trim() || "Cena"}>
              <div className="mb-3 flex gap-2">
                {(["PLN", "EUR"] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      const from = form.priceCurrency === "EUR" ? "EUR" : "PLN";
                      if (from === code) return;
                      const amount = Number(String(form.pricePln).replace(/\s/g, "").replace(",", "."));
                      const next =
                        Number.isFinite(amount) && amount > 0
                          ? convertBetweenCurrencies(amount, from, code, fxRate)
                          : amount;
                      setForm((prev) => ({
                        ...prev,
                        priceCurrency: code,
                        pricePln:
                          Number.isFinite(next) && next > 0 ? String(Math.round(next)) : prev.pricePln,
                      }));
                    }}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                      form.priceCurrency === code
                        ? "bg-sky-500 text-white"
                        : "bg-black/5 text-slate-600 dark:bg-white/10 dark:text-slate-200"
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
              <div className="relative">
                <CarFormattedNumberInput
                  value={form.pricePln}
                  onChange={(digits) => setField("pricePln", digits)}
                  className={`${carFieldInputClass} ${highlightClass(isHighlighted("pricePln"))}`}
                  placeholder="319 000"
                  required
                />
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {form.priceCurrency}
                </div>
              </div>
              {Number(form.pricePln) > 0 && formatApproxLine(Number(form.pricePln), form.priceCurrency, fxRate) ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {formatApproxLine(Number(form.pricePln), form.priceCurrency, fxRate)}
                  {fxDate ? ` · NBP ${fxDate}` : ""}
                </p>
              ) : null}
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

        <CarFormSection
          eyebrow={f.contactEyebrow}
          title={f.contactTitle}
          description={f.contactDescription}
        >
          <AppleStyleSwitch
            id="show-contact-phone"
            accent="sky"
            checked={form.showContactPhone}
            onChange={(showContactPhone) => setForm((prev) => ({ ...prev, showContactPhone }))}
            label={f.showContactPhoneLabel}
            description={f.showContactPhoneDescription}
          />
        </CarFormSection>

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

          <div className="grid gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
                {f.detailsNotesLabel}
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                <textarea
                  value={aiDetailsNotes}
                  onChange={(e) => setAiDetailsNotes(e.target.value)}
                  rows={4}
                  placeholder={f.detailsNotesPlaceholder}
                  className={`min-h-[7rem] flex-1 resize-y ${carFieldInputClass}`}
                />
                <div className="flex shrink-0 items-center sm:items-end">
                  <SiriMagicButton
                    label={f.magicDescribeBtn}
                    busyLabel={f.magicDescribing}
                    busy={isGeneratingAI}
                    disabled={uploading || submitting}
                    onClick={() => void handleGenerateAI()}
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--eos-muted)]">{f.detailsNotesHint}</p>
            </div>
            <div className="grid gap-2">
              <label className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
                {f.descriptionLabel}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                className={`min-h-[160px] resize-y ${carFieldInputClass} ${highlightClass(isHighlighted("description"))}`}
                placeholder={f.descriptionPlaceholder}
              />
              {aiMissingNotice ? <p className={carAlertWarningClass}>{aiMissingNotice}</p> : null}
            </div>
          </div>
        </CarFormSection>

        {error ? <p className={carAlertErrorClass}>{error}</p> : null}
        <CarPublishSuccessModal
          carId={successId}
          open={Boolean(successId) && mode === "create"}
          onClose={() => setSuccessId(null)}
        />
        {successId && mode === "edit" ? (
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

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-sky-400/30 bg-[var(--eos-card)]/95 px-5 py-4 shadow-[0_22px_60px_rgba(14,165,233,0.18),0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-md">
          <p className="max-w-xs text-xs font-medium leading-relaxed text-[var(--eos-muted)] sm:max-w-sm">
            {mode === "create" ? f.footerCreate : f.footerEdit}
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <EosButton type="submit" variant="car" size="md" disabled={submitting || uploading}>
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  {f.publishing}
                </>
              ) : mode === "create" ? (
                f.publish
              ) : (
                f.saveChanges
              )}
            </EosButton>
            <EosButton
              href={mode === "edit" && carId ? `/cars/${carId}` : "/cars"}
              variant="secondary"
              size="md"
            >
              {c.common.cancel}
            </EosButton>
          </div>
        </div>
      </form>
    </>
  );
}
