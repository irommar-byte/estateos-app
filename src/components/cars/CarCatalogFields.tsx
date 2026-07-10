"use client";

import { useEffect } from "react";
import { BODY_TYPE_OPTIONS } from "@/lib/otomotoCatalog";
import { pickDoorCountOption, pickGenerationForYear } from "@/lib/carCatalogInference";
import { findEngineCapacityOption, findEnginePowerOption, findOptionByLabel, useCarCatalogOptions } from "@/hooks/useCarCatalogOptions";
import type { CarFormState } from "@/components/cars/CarListingForm";

const selectClassName =
  "rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50";

type CarCatalogFieldsProps = {
  form: CarFormState;
  setForm: React.Dispatch<React.SetStateAction<CarFormState>>;
};

function CatalogSelect({
  label,
  value,
  onChange,
  options,
  loading,
  disabled,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (slug: string, label: string) => void;
  options: { value: string; label: string }[];
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-[var(--eos-muted)]">
        {label}
        {loading ? " (ładowanie...)" : ""}
      </span>
      <select
        value={value}
        onChange={(event) => {
          const slug = event.target.value;
          const option = options.find((item) => item.value === slug);
          onChange(slug, option?.label || "");
        }}
        className={selectClassName}
        disabled={disabled || loading}
        required={required}
      >
        <option value="">{placeholder || `Wybierz ${label.toLowerCase()}`}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CarCatalogFields({ form, setForm }: CarCatalogFieldsProps) {
  const hasMake = Boolean(form.makeSlug);
  const hasModel = Boolean(form.modelSlug);
  const hasYear = Boolean(form.year);
  const catalogBase = {
    make: form.makeSlug,
    model: form.modelSlug,
    year: form.year || undefined,
    generation: form.generationSlug || undefined,
    fuel_type: form.fuelSlug || undefined,
    engine_power: form.enginePowerSlug || undefined,
    engine_capacity: form.engineCapacitySlug || undefined,
    door_count: form.doorCountSlug || undefined,
    gearbox: form.gearboxSlug || undefined,
  };

  const { options: makes, loading: makesLoading } = useCarCatalogOptions("makes", {}, true);
  const { options: models, loading: modelsLoading } = useCarCatalogOptions("models", { make: form.makeSlug }, hasMake);
  const { options: generations, loading: generationsLoading } = useCarCatalogOptions(
    "generations",
    { make: form.makeSlug, model: form.modelSlug },
    hasMake && hasModel,
  );
  const { options: fuelTypes, loading: fuelLoading } = useCarCatalogOptions(
    "fuel_types",
    { make: form.makeSlug, model: form.modelSlug, year: form.year || undefined },
    hasMake && hasModel,
  );
  const { options: enginePowers, loading: powerLoading } = useCarCatalogOptions(
    "engine_powers",
    catalogBase,
    hasMake && hasModel && Boolean(form.fuelSlug),
  );
  const { options: engineCapacities, loading: capacityLoading } = useCarCatalogOptions(
    "engine_capacities",
    catalogBase,
    hasMake && hasModel && Boolean(form.fuelSlug) && Boolean(form.enginePowerSlug),
  );
  const { options: doorCounts, loading: doorsLoading } = useCarCatalogOptions(
    "door_counts",
    catalogBase,
    hasMake && hasModel && Boolean(form.fuelSlug) && Boolean(form.enginePowerSlug) && Boolean(form.engineCapacitySlug),
  );
  const { options: gearboxes, loading: gearboxLoading } = useCarCatalogOptions(
    "gearboxes",
    catalogBase,
    hasMake &&
      hasModel &&
      Boolean(form.fuelSlug) &&
      Boolean(form.enginePowerSlug) &&
      Boolean(form.engineCapacitySlug),
  );
  const { options: versions, loading: versionsLoading } = useCarCatalogOptions(
    "versions",
    catalogBase,
    hasMake &&
      hasModel &&
      Boolean(form.fuelSlug) &&
      Boolean(form.enginePowerSlug) &&
      Boolean(form.engineCapacitySlug) &&
      Boolean(form.gearboxSlug),
  );

  useEffect(() => {
    if (!form.make || form.makeSlug || !makes.length) return;
    const match = findOptionByLabel(makes, form.make);
    if (match) {
      setForm((prev) => ({ ...prev, makeSlug: match.value, make: match.label }));
    }
  }, [form.make, form.makeSlug, makes, setForm]);

  useEffect(() => {
    if (!form.model || form.modelSlug || !models.length) return;
    const match = findOptionByLabel(models, form.model);
    if (match) {
      setForm((prev) => ({ ...prev, modelSlug: match.value, model: match.label }));
    }
  }, [form.model, form.modelSlug, models, setForm]);

  useEffect(() => {
    if (form.generationSlug || !generations.length || !form.year || !hasModel) return;
    const match = pickGenerationForYear(generations, form.year, form.generation);
    if (match) {
      setForm((prev) => ({ ...prev, generationSlug: match.value, generation: match.label }));
    }
  }, [form.generationSlug, form.generation, form.year, hasModel, generations, setForm]);

  useEffect(() => {
    if (form.doorCountSlug || !doorCounts.length || !form.engineCapacitySlug) return;
    const match = pickDoorCountOption(doorCounts, form.bodyType);
    if (match) {
      setForm((prev) => ({ ...prev, doorCountSlug: match.value, doorCount: match.label }));
    }
  }, [form.doorCountSlug, form.bodyType, form.engineCapacitySlug, doorCounts, setForm]);

  useEffect(() => {
    if (!form.generation || form.generationSlug || !generations.length) return;
    const match = findOptionByLabel(generations, form.generation);
    if (match) {
      setForm((prev) => ({ ...prev, generationSlug: match.value, generation: match.label }));
    }
  }, [form.generation, form.generationSlug, generations, setForm]);

  useEffect(() => {
    if (!form.fuelType || form.fuelSlug || !fuelTypes.length) return;
    const match = findOptionByLabel(fuelTypes, form.fuelType);
    if (match) {
      setForm((prev) => ({ ...prev, fuelSlug: match.value, fuelType: match.label }));
    }
  }, [form.fuelType, form.fuelSlug, fuelTypes, setForm]);

  useEffect(() => {
    if (!form.enginePower || form.enginePowerSlug || !enginePowers.length) return;
    const match = findEnginePowerOption(enginePowers, form.enginePower);
    if (match) {
      setForm((prev) => ({ ...prev, enginePowerSlug: match.value, enginePower: match.label }));
    }
  }, [form.enginePower, form.enginePowerSlug, enginePowers, setForm]);

  useEffect(() => {
    if (!form.engineCapacity || form.engineCapacitySlug || !engineCapacities.length) return;
    const match = findEngineCapacityOption(engineCapacities, form.engineCapacity);
    if (match) {
      setForm((prev) => ({ ...prev, engineCapacitySlug: match.value, engineCapacity: match.label }));
    }
  }, [form.engineCapacity, form.engineCapacitySlug, engineCapacities, setForm]);

  useEffect(() => {
    if (!form.doorCount || form.doorCountSlug || !doorCounts.length) return;
    const match =
      findOptionByLabel(doorCounts, form.doorCount) ||
      doorCounts.find((item) => item.label.trim().startsWith(form.doorCount.trim())) ||
      null;
    if (match) {
      setForm((prev) => ({ ...prev, doorCountSlug: match.value, doorCount: match.label }));
    }
  }, [form.doorCount, form.doorCountSlug, doorCounts, setForm]);

  useEffect(() => {
    if (!form.transmission || form.gearboxSlug || !gearboxes.length) return;
    const match = findOptionByLabel(gearboxes, form.transmission);
    if (match) {
      setForm((prev) => ({ ...prev, gearboxSlug: match.value, transmission: match.label }));
    }
  }, [form.transmission, form.gearboxSlug, gearboxes, setForm]);

  useEffect(() => {
    if (!form.trimVersion || form.trimVersionSlug || !versions.length) return;
    const match = findOptionByLabel(versions, form.trimVersion);
    if (match) {
      setForm((prev) => ({ ...prev, trimVersionSlug: match.value, trimVersion: match.label }));
    }
  }, [form.trimVersion, form.trimVersionSlug, versions, setForm]);

  const patch = (partial: Partial<CarFormState>) => setForm((prev) => ({ ...prev, ...partial }));

  return (
    <div className="grid gap-4 rounded-2xl border border-sky-400/20 bg-sky-500/5 p-4">
      <div>
        <p className="text-sm font-semibold text-sky-200">Katalog pojazdu</p>
        <p className="mt-1 text-xs text-[var(--eos-muted)]">
          Dane jak na Otomoto — wybierz markę, model, paliwo, silnik i wersję po kolei.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm">
          <span className="text-[var(--eos-muted)]">Rocznik produkcji</span>
          <select
            value={form.year}
            onChange={(event) =>
              patch({
                year: event.target.value,
                fuelSlug: "",
                fuelType: "",
                enginePowerSlug: "",
                enginePower: "",
                engineCapacitySlug: "",
                engineCapacity: "",
                doorCountSlug: "",
                doorCount: "",
                gearboxSlug: "",
                transmission: "Automatyczna",
                trimVersionSlug: "",
                trimVersion: "",
              })
            }
            className={selectClassName}
            required
          >
            <option value="">Wybierz rocznik</option>
            {Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, index) => {
              const year = String(new Date().getFullYear() - index);
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
        </label>

        <CatalogSelect
          label="Marka"
          value={form.makeSlug}
          options={makes}
          loading={makesLoading}
          required
          onChange={(slug, label) =>
            patch({
              makeSlug: slug,
              make: label,
              modelSlug: "",
              model: "",
              generationSlug: "",
              generation: "",
              fuelSlug: "",
              fuelType: "",
              enginePowerSlug: "",
              enginePower: "",
              engineCapacitySlug: "",
              engineCapacity: "",
              doorCountSlug: "",
              doorCount: "",
              gearboxSlug: "",
              transmission: "Automatyczna",
              trimVersionSlug: "",
              trimVersion: "",
            })
          }
        />

        <CatalogSelect
          label="Model"
          value={form.modelSlug}
          options={models}
          loading={modelsLoading}
          disabled={!hasMake}
          required
          onChange={(slug, label) =>
            patch({
              modelSlug: slug,
              model: label,
              generationSlug: "",
              generation: "",
              fuelSlug: "",
              fuelType: "",
              enginePowerSlug: "",
              enginePower: "",
              engineCapacitySlug: "",
              engineCapacity: "",
              doorCountSlug: "",
              doorCount: "",
              gearboxSlug: "",
              transmission: "Automatyczna",
              trimVersionSlug: "",
              trimVersion: "",
            })
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CatalogSelect
          label="Generacja"
          value={form.generationSlug}
          options={generations}
          loading={generationsLoading}
          disabled={!hasMake || !hasModel}
          placeholder="Opcjonalnie"
          onChange={(slug, label) =>
            patch({
              generationSlug: slug,
              generation: label,
              fuelSlug: "",
              fuelType: "",
              enginePowerSlug: "",
              enginePower: "",
              engineCapacitySlug: "",
              engineCapacity: "",
              doorCountSlug: "",
              doorCount: "",
              gearboxSlug: "",
              transmission: "Automatyczna",
              trimVersionSlug: "",
              trimVersion: "",
            })
          }
        />

        <CatalogSelect
          label="Rodzaj paliwa"
          value={form.fuelSlug}
          options={fuelTypes}
          loading={fuelLoading}
          disabled={!hasMake || !hasModel}
          required
          onChange={(slug, label) =>
            patch({
              fuelSlug: slug,
              fuelType: label,
              enginePowerSlug: "",
              enginePower: "",
              engineCapacitySlug: "",
              engineCapacity: "",
              doorCountSlug: "",
              doorCount: "",
              gearboxSlug: "",
              transmission: "Automatyczna",
              trimVersionSlug: "",
              trimVersion: "",
            })
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CatalogSelect
          label="Moc silnika"
          value={form.enginePowerSlug}
          options={enginePowers}
          loading={powerLoading}
          disabled={!form.fuelSlug}
          onChange={(slug, label) =>
            patch({
              enginePowerSlug: slug,
              enginePower: label,
              engineCapacitySlug: "",
              engineCapacity: "",
              doorCountSlug: "",
              doorCount: "",
              gearboxSlug: "",
              transmission: "Automatyczna",
              trimVersionSlug: "",
              trimVersion: "",
            })
          }
        />

        <CatalogSelect
          label="Pojemność silnika (cm³)"
          value={form.engineCapacitySlug}
          options={engineCapacities}
          loading={capacityLoading}
          disabled={!form.enginePowerSlug}
          onChange={(slug, label) =>
            patch({
              engineCapacitySlug: slug,
              engineCapacity: label,
              doorCountSlug: "",
              doorCount: "",
              gearboxSlug: "",
              transmission: "Automatyczna",
              trimVersionSlug: "",
              trimVersion: "",
            })
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CatalogSelect
          label="Liczba drzwi"
          value={form.doorCountSlug}
          options={doorCounts}
          loading={doorsLoading}
          disabled={!form.engineCapacitySlug}
          onChange={(slug, label) =>
            patch({
              doorCountSlug: slug,
              doorCount: label,
              gearboxSlug: "",
              transmission: "Automatyczna",
              trimVersionSlug: "",
              trimVersion: "",
            })
          }
        />

        <CatalogSelect
          label="Skrzynia biegów"
          value={form.gearboxSlug}
          options={gearboxes}
          loading={gearboxLoading}
          disabled={!form.engineCapacitySlug}
          onChange={(slug, label) =>
            patch({
              gearboxSlug: slug,
              transmission: label || "Automatyczna",
              trimVersionSlug: "",
              trimVersion: "",
            })
          }
        />

        <label className="grid gap-1.5 text-sm">
          <span className="text-[var(--eos-muted)]">Nadwozie</span>
          <select
            value={form.bodyType}
            onChange={(event) => patch({ bodyType: event.target.value })}
            className={selectClassName}
          >
            {BODY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <CatalogSelect
        label="Wersja / wyposażenie"
        value={form.trimVersionSlug}
        options={versions}
        loading={versionsLoading}
        disabled={!form.gearboxSlug}
        placeholder="Opcjonalnie — wybierz po skrzyni biegów"
        onChange={(slug, label) => {
          const nextTitle =
            !form.title.trim() && form.make && form.model && label
              ? `${form.make} ${form.model} ${label}`.trim()
              : form.title;
          patch({
            trimVersionSlug: slug,
            trimVersion: label,
            title: nextTitle,
          });
        }}
      />

      {!hasYear ? (
        <p className="text-xs text-amber-300/90">Uzupełnij rocznik, aby zawęzić dostępne silniki i wersje.</p>
      ) : null}
    </div>
  );
}
