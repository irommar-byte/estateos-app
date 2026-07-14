"use client";

import { useEffect, type ReactNode } from "react";
import { BODY_TYPE_OPTIONS } from "@/lib/otomotoCatalog";
import { CAR_EXTERIOR_COLORS } from "@/lib/carColors";
import { pickDoorCountOption, pickGenerationForYear } from "@/lib/carCatalogInference";
import { findEngineCapacityOption, findEnginePowerOption, findOptionByLabel, useCarCatalogOptions } from "@/hooks/useCarCatalogOptions";
import type { CarFormState } from "@/components/cars/CarListingForm";
import {
  CarFormSection,
  carAlertWarningClass,
  carFieldInputClass,
  carFieldLabelClass,
} from "@/components/cars/carFormStyles";
import { useLocale } from "@/contexts/LocaleContext";
import { fmtCars } from "@/i18n/carsDictionary";

function CatalogField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className={carFieldLabelClass}>{label}</span>
      {children}
    </label>
  );
}

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
  chooseFieldTemplate,
}: {
  label: string;
  value: string;
  onChange: (slug: string, label: string) => void;
  options: { value: string; label: string }[];
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  chooseFieldTemplate?: string;
}) {
  const defaultPlaceholder = placeholder || (chooseFieldTemplate ? fmtCars(chooseFieldTemplate, { field: label }) : label);
  return (
    <label className="grid gap-2">
      <span className={carFieldLabelClass}>
        {label}
        {loading ? "…" : ""}
      </span>
      <select
        value={value}
        onChange={(event) => {
          const slug = event.target.value;
          const option = options.find((item) => item.value === slug);
          onChange(slug, option?.label || "");
        }}
        className={carFieldInputClass}
        disabled={disabled || loading}
        required={required}
      >
        <option value="">{defaultPlaceholder}</option>
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
  const { dict } = useLocale();
  const cf = dict.cars.catalogFields;
  const autoTx = dict.cars.common.automaticTransmission;
  const chooseFieldTemplate = dict.cars.common.chooseField;
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
    <CarFormSection eyebrow={cf.eyebrow} title={cf.title} description={cf.description}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CatalogField label={cf.yearLabel}>
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
                  transmission: autoTx,
                  trimVersionSlug: "",
                  trimVersion: "",
                })
              }
              className={carFieldInputClass}
              required
            >
              <option value="">{cf.yearPlaceholder}</option>
              {Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, index) => {
                const year = String(new Date().getFullYear() - index);
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </CatalogField>

          <CatalogSelect
            label={cf.makeLabel}
            value={form.makeSlug}
            options={makes}
            loading={makesLoading}
            required
            chooseFieldTemplate={chooseFieldTemplate}
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
                transmission: autoTx,
                trimVersionSlug: "",
                trimVersion: "",
              })
            }
          />

          <CatalogSelect
            label={cf.modelLabel}
            value={form.modelSlug}
            options={models}
            loading={modelsLoading}
            disabled={!hasMake}
            required
            chooseFieldTemplate={chooseFieldTemplate}
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
                transmission: autoTx,
                trimVersionSlug: "",
                trimVersion: "",
              })
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CatalogSelect
            label={cf.generationLabel}
            value={form.generationSlug}
            options={generations}
            loading={generationsLoading}
            disabled={!hasMake || !hasModel}
            placeholder={dict.cars.common.optional}
            chooseFieldTemplate={chooseFieldTemplate}
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
                transmission: autoTx,
                trimVersionSlug: "",
                trimVersion: "",
              })
            }
          />

          <CatalogSelect
            label={cf.fuelLabel}
            value={form.fuelSlug}
            options={fuelTypes}
            loading={fuelLoading}
            disabled={!hasMake || !hasModel}
            required
            chooseFieldTemplate={chooseFieldTemplate}
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
                transmission: autoTx,
                trimVersionSlug: "",
                trimVersion: "",
              })
            }
          />

          <div className="hidden xl:block" aria-hidden />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CatalogSelect
            label={cf.powerLabel}
            value={form.enginePowerSlug}
            options={enginePowers}
            loading={powerLoading}
            disabled={!form.fuelSlug}
            chooseFieldTemplate={chooseFieldTemplate}
            onChange={(slug, label) =>
              patch({
                enginePowerSlug: slug,
                enginePower: label,
                engineCapacitySlug: "",
                engineCapacity: "",
                doorCountSlug: "",
                doorCount: "",
                gearboxSlug: "",
                transmission: autoTx,
                trimVersionSlug: "",
                trimVersion: "",
              })
            }
          />

          <CatalogSelect
            label={cf.capacityLabel}
            value={form.engineCapacitySlug}
            options={engineCapacities}
            loading={capacityLoading}
            disabled={!form.enginePowerSlug}
            chooseFieldTemplate={chooseFieldTemplate}
            onChange={(slug, label) =>
              patch({
                engineCapacitySlug: slug,
                engineCapacity: label,
                doorCountSlug: "",
                doorCount: "",
                gearboxSlug: "",
                transmission: autoTx,
                trimVersionSlug: "",
                trimVersion: "",
              })
            }
          />

          <div className="hidden xl:block" aria-hidden />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CatalogSelect
            label={cf.doorsLabel}
            value={form.doorCountSlug}
            options={doorCounts}
            loading={doorsLoading}
            disabled={!form.engineCapacitySlug}
            chooseFieldTemplate={chooseFieldTemplate}
            onChange={(slug, label) =>
              patch({
                doorCountSlug: slug,
                doorCount: label,
                gearboxSlug: "",
                transmission: autoTx,
                trimVersionSlug: "",
                trimVersion: "",
              })
            }
          />

          <CatalogSelect
            label={cf.gearboxLabel}
            value={form.gearboxSlug}
            options={gearboxes}
            loading={gearboxLoading}
            disabled={!form.engineCapacitySlug}
            chooseFieldTemplate={chooseFieldTemplate}
            onChange={(slug, label) =>
              patch({
                gearboxSlug: slug,
                transmission: label || autoTx,
                trimVersionSlug: "",
                trimVersion: "",
              })
            }
          />

          <CatalogField label={cf.bodyLabel}>
            <select
              value={form.bodyType}
              onChange={(event) => patch({ bodyType: event.target.value })}
              className={carFieldInputClass}
            >
              {BODY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.label}>
                  {option.label}
                </option>
              ))}
            </select>
          </CatalogField>

          <CatalogField label={cf.colorLabel}>
            <select
              value={form.exteriorColor}
              onChange={(event) => patch({ exteriorColor: event.target.value })}
              className={carFieldInputClass}
            >
              <option value="">{cf.colorPlaceholder}</option>
              {CAR_EXTERIOR_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </CatalogField>
        </div>

        <CatalogSelect
          label={cf.trimLabel}
          value={form.trimVersionSlug}
          options={versions}
          loading={versionsLoading}
          disabled={!form.gearboxSlug}
          placeholder={cf.trimPlaceholder}
          chooseFieldTemplate={chooseFieldTemplate}
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
          <p className={carAlertWarningClass}>{cf.yearRequiredHint}</p>
        ) : null}
    </CarFormSection>
  );
}
