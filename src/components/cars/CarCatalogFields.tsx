"use client";

import { useEffect, type ReactNode } from "react";
import { BODY_TYPE_OPTIONS } from "@/lib/otomotoCatalog";
import { CAR_EXTERIOR_COLORS } from "@/lib/carColors";
import { pickDoorCountOption, pickGenerationForYear } from "@/lib/carCatalogInference";
import {
  DEFAULT_VEHICLE_TYPE,
  VEHICLE_TYPE_OPTIONS,
  bodyOptionsForVehicleType,
  defaultBodyTypeForVehicleType,
  normalizeVehicleType,
  vehicleTypeSupportsDoorCount,
  vehicleTypeSupportsGenerations,
  vehicleTypeSupportsModelCatalog,
  type VehicleType,
} from "@/lib/vehicleTypes";
import {
  findEngineCapacityOption,
  findEnginePowerOption,
  findOptionByLabel,
  mergeCatalogOptions,
  resolveFuelOption,
  resolveGearboxOption,
  STATIC_FUEL_OPTIONS,
  STATIC_GEARBOX_OPTIONS,
  syntheticOptionFromLabel,
  useCarCatalogOptions,
} from "@/hooks/useCarCatalogOptions";
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

function emptyCatalogCascade(autoTx: string, bodyType: string) {
  return {
    makeSlug: "",
    make: "",
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
    bodyType,
  };
}

export default function CarCatalogFields({ form, setForm }: CarCatalogFieldsProps) {
  const { dict, locale } = useLocale();
  const cf = dict.cars.catalogFields;
  const autoTx = dict.cars.common.automaticTransmission;
  const chooseFieldTemplate = dict.cars.common.chooseField;
  const vehicleType = normalizeVehicleType(form.vehicleType || DEFAULT_VEHICLE_TYPE);
  const hasModelCatalog = vehicleTypeSupportsModelCatalog(vehicleType);
  const showGenerations = vehicleTypeSupportsGenerations(vehicleType);
  const showDoors = vehicleTypeSupportsDoorCount(vehicleType);
  const bodyOptions =
    vehicleType === "car" ? BODY_TYPE_OPTIONS : bodyOptionsForVehicleType(vehicleType);
  const vehicleTypeLabels =
    locale === "en"
      ? { car: "Passenger car", motorcycle: "Motorcycle", van: "Van / LCV", truck: "Truck" }
      : locale === "uk"
        ? { car: "Легковий", motorcycle: "Мотоцикл", van: "Фургон", truck: "Вантажівка" }
        : { car: "Samochód osobowy", motorcycle: "Motocykl", van: "Dostawczy", truck: "Ciężarowy" };

  const hasMake = Boolean(form.makeSlug);
  const hasModel = hasModelCatalog ? Boolean(form.modelSlug) : Boolean(form.model.trim());
  const hasYear = Boolean(form.year);
  const modelParam = form.modelSlug || (hasModelCatalog ? undefined : "other");
  const catalogVehicle = { vehicleType };
  const catalogBase = {
    ...catalogVehicle,
    make: form.makeSlug,
    model: modelParam,
    year: form.year || undefined,
    generation: form.generationSlug || undefined,
    fuel_type: form.fuelSlug || undefined,
    engine_power: form.enginePowerSlug || undefined,
    engine_capacity: form.engineCapacitySlug || undefined,
    door_count: form.doorCountSlug || undefined,
    gearbox: form.gearboxSlug || undefined,
  };

  const { options: makes, loading: makesLoading } = useCarCatalogOptions("makes", catalogVehicle, true);
  const { options: models, loading: modelsLoading } = useCarCatalogOptions(
    "models",
    { ...catalogVehicle, make: form.makeSlug },
    hasMake && hasModelCatalog,
  );
  const { options: generations, loading: generationsLoading } = useCarCatalogOptions(
    "generations",
    { ...catalogVehicle, make: form.makeSlug, model: form.modelSlug },
    showGenerations && hasMake && hasModel,
  );
  const { options: fuelTypes, loading: fuelLoading } = useCarCatalogOptions(
    "fuel_types",
    { ...catalogVehicle, make: form.makeSlug, model: modelParam, year: form.year || undefined },
    hasMake && hasModel && hasModelCatalog,
  );
  const { options: enginePowers, loading: powerLoading } = useCarCatalogOptions(
    "engine_powers",
    catalogBase,
    hasMake && hasModel && Boolean(form.fuelSlug) && hasModelCatalog,
  );
  const { options: engineCapacities, loading: capacityLoading } = useCarCatalogOptions(
    "engine_capacities",
    catalogBase,
    hasMake && hasModel && Boolean(form.fuelSlug) && Boolean(form.enginePowerSlug) && hasModelCatalog,
  );
  const { options: doorCounts, loading: doorsLoading } = useCarCatalogOptions(
    "door_counts",
    catalogBase,
    showDoors &&
      hasMake &&
      hasModel &&
      Boolean(form.fuelSlug) &&
      Boolean(form.enginePowerSlug) &&
      Boolean(form.engineCapacitySlug),
  );
  const { options: gearboxes, loading: gearboxLoading } = useCarCatalogOptions(
    "gearboxes",
    catalogBase,
    hasMake &&
      hasModel &&
      Boolean(form.fuelSlug) &&
      Boolean(form.enginePowerSlug) &&
      Boolean(form.engineCapacitySlug) &&
      hasModelCatalog,
  );
  const { options: versions, loading: versionsLoading } = useCarCatalogOptions(
    "versions",
    catalogBase,
    hasMake &&
      hasModel &&
      Boolean(form.fuelSlug) &&
      Boolean(form.enginePowerSlug) &&
      Boolean(form.engineCapacitySlug) &&
      Boolean(form.gearboxSlug) &&
      hasModelCatalog,
  );

  // Otomoto open catalog often returns [] for rare makes (e.g. Ferrari).
  // Keep imported labels usable by injecting static / synthetic options.
  const importedFuel = resolveFuelOption(form.fuelType, form.fuelSlug);
  const importedGearbox = resolveGearboxOption(form.transmission, form.gearboxSlug);
  const importedPower = syntheticOptionFromLabel(form.enginePower || form.enginePowerSlug, form.enginePowerSlug || undefined);
  const importedCapacity = syntheticOptionFromLabel(
    form.engineCapacity || form.engineCapacitySlug,
    form.engineCapacitySlug || undefined,
  );
  const importedDoors = syntheticOptionFromLabel(form.doorCount || form.doorCountSlug, form.doorCountSlug || undefined);
  const importedVersion = syntheticOptionFromLabel(form.trimVersion || form.trimVersionSlug, form.trimVersionSlug || undefined);

  const fuelOptions = mergeCatalogOptions(
    fuelTypes,
    (!fuelLoading && fuelTypes.length === 0 && hasMake && hasModel) || (!hasModelCatalog && hasMake && hasModel)
      ? STATIC_FUEL_OPTIONS
      : [],
    importedFuel ? [importedFuel] : [],
  );
  const powerDigits = String(form.enginePower || "").replace(/[^\d]/g, "");
  const powerOptions = mergeCatalogOptions(
    enginePowers,
    ((!powerLoading && enginePowers.length === 0) || !hasModelCatalog) && form.fuelSlug && powerDigits
      ? [{ value: powerDigits, label: `${powerDigits} KM` }]
      : [],
    importedPower ? [importedPower] : [],
  );
  const capacityDigits = String(form.engineCapacity || "").replace(/[^\d]/g, "");
  const capacityOptions = mergeCatalogOptions(
    engineCapacities,
    ((!capacityLoading && engineCapacities.length === 0) || !hasModelCatalog) &&
      form.enginePowerSlug &&
      capacityDigits
      ? [{ value: capacityDigits, label: capacityDigits }]
      : [],
    importedCapacity ? [importedCapacity] : [],
  );
  const doorDigits = String(form.doorCount || form.doorCountSlug || "").replace(/[^\d]/g, "");
  const doorOptions = mergeCatalogOptions(
    doorCounts,
    !doorsLoading && doorCounts.length === 0 && form.engineCapacitySlug && doorDigits
      ? [{ value: doorDigits, label: doorDigits }]
      : [],
    importedDoors ? [importedDoors] : [],
  );
  const gearboxOptions = mergeCatalogOptions(
    gearboxes,
    ((!gearboxLoading && gearboxes.length === 0) || !hasModelCatalog) && form.engineCapacitySlug
      ? STATIC_GEARBOX_OPTIONS
      : [],
    importedGearbox ? [importedGearbox] : [],
  );
  const versionOptions = mergeCatalogOptions(versions, importedVersion ? [importedVersion] : []);

  useEffect(() => {
    if (!form.make || form.makeSlug || !makes.length) return;
    const match = findOptionByLabel(makes, form.make);
    if (match) {
      setForm((prev) => {
        if (prev.makeSlug === match.value) return prev;
        return { ...prev, makeSlug: match.value, make: match.label };
      });
    }
  }, [form.make, form.makeSlug, makes, setForm]);

  useEffect(() => {
    if (!form.model || form.modelSlug || !models.length) return;
    const match = findOptionByLabel(models, form.model);
    if (match) {
      setForm((prev) => {
        if (prev.modelSlug === match.value) return prev;
        return { ...prev, modelSlug: match.value, model: match.label };
      });
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
    if (form.doorCountSlug || form.doorCount || !doorCounts.length || !form.engineCapacitySlug) return;
    const match = pickDoorCountOption(doorCounts, form.bodyType);
    if (match) {
      setForm((prev) => {
        if (prev.doorCountSlug === match.value) return prev;
        return { ...prev, doorCountSlug: match.value, doorCount: match.label };
      });
    }
  }, [form.doorCountSlug, form.doorCount, form.bodyType, form.engineCapacitySlug, doorCounts, setForm]);

  useEffect(() => {
    if (!form.generation || form.generationSlug || !generations.length) return;
    const match = findOptionByLabel(generations, form.generation);
    if (match) {
      setForm((prev) => ({ ...prev, generationSlug: match.value, generation: match.label }));
    }
  }, [form.generation, form.generationSlug, generations, setForm]);

  useEffect(() => {
    if (!form.fuelType || form.fuelSlug) return;
    if (fuelLoading) return;
    const match = findOptionByLabel(fuelTypes.length ? fuelTypes : STATIC_FUEL_OPTIONS, form.fuelType) || resolveFuelOption(form.fuelType);
    if (match) {
      setForm((prev) => {
        if (prev.fuelSlug === match.value) return prev;
        return { ...prev, fuelSlug: match.value, fuelType: match.label };
      });
    }
  }, [form.fuelType, form.fuelSlug, fuelLoading, fuelTypes, setForm]);

  useEffect(() => {
    if (!form.enginePower || form.enginePowerSlug) return;
    if (powerLoading) return;
    const match = findEnginePowerOption(enginePowers, form.enginePower);
    if (match) {
      setForm((prev) => {
        if (prev.enginePowerSlug === match.value) return prev;
        return { ...prev, enginePowerSlug: match.value, enginePower: match.label };
      });
      return;
    }
    const digits = String(form.enginePower).replace(/[^\d]/g, "");
    if (digits && form.fuelSlug) {
      setForm((prev) => {
        if (prev.enginePowerSlug === digits) return prev;
        return {
          ...prev,
          enginePowerSlug: digits,
          enginePower: prev.enginePower.includes("KM") ? prev.enginePower : `${digits} KM`,
        };
      });
    }
  }, [form.enginePower, form.enginePowerSlug, form.fuelSlug, powerLoading, enginePowers, setForm]);

  useEffect(() => {
    if (!form.engineCapacity || form.engineCapacitySlug) return;
    if (capacityLoading) return;
    const match = findEngineCapacityOption(engineCapacities, form.engineCapacity);
    if (match) {
      setForm((prev) => {
        if (prev.engineCapacitySlug === match.value) return prev;
        return { ...prev, engineCapacitySlug: match.value, engineCapacity: match.label };
      });
      return;
    }
    const digits = String(form.engineCapacity).replace(/[^\d]/g, "");
    if (digits && form.enginePowerSlug) {
      setForm((prev) => {
        if (prev.engineCapacitySlug === digits) return prev;
        return { ...prev, engineCapacitySlug: digits, engineCapacity: digits };
      });
    }
  }, [form.engineCapacity, form.engineCapacitySlug, form.enginePowerSlug, capacityLoading, engineCapacities, setForm]);

  useEffect(() => {
    if (!form.doorCount || form.doorCountSlug) return;
    if (doorsLoading) return;
    const match =
      findOptionByLabel(doorCounts, form.doorCount) ||
      doorCounts.find((item) => item.label.trim().startsWith(form.doorCount.trim())) ||
      null;
    if (match) {
      setForm((prev) => {
        if (prev.doorCountSlug === match.value) return prev;
        return { ...prev, doorCountSlug: match.value, doorCount: match.label };
      });
      return;
    }
    const digits = String(form.doorCount).replace(/[^\d]/g, "");
    if (digits && form.engineCapacitySlug) {
      setForm((prev) => {
        if (prev.doorCountSlug === digits) return prev;
        return { ...prev, doorCountSlug: digits, doorCount: digits };
      });
    }
  }, [form.doorCount, form.doorCountSlug, form.engineCapacitySlug, doorsLoading, doorCounts, setForm]);

  useEffect(() => {
    if (!form.transmission || form.gearboxSlug) return;
    if (gearboxLoading) return;
    const match =
      findOptionByLabel(gearboxes.length ? gearboxes : STATIC_GEARBOX_OPTIONS, form.transmission) ||
      resolveGearboxOption(form.transmission);
    if (match) {
      setForm((prev) => {
        if (prev.gearboxSlug === match.value) return prev;
        return { ...prev, gearboxSlug: match.value, transmission: match.label };
      });
    }
  }, [form.transmission, form.gearboxSlug, gearboxLoading, gearboxes, setForm]);

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
        <CatalogField label={cf.vehicleTypeLabel}>
          <select
            value={vehicleType}
            onChange={(event) => {
              const nextType = normalizeVehicleType(event.target.value) as VehicleType;
              patch({
                vehicleType: nextType,
                ...emptyCatalogCascade(autoTx, defaultBodyTypeForVehicleType(nextType)),
              });
            }}
            className={carFieldInputClass}
            required
          >
            {VEHICLE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {vehicleTypeLabels[option.value]}
              </option>
            ))}
          </select>
        </CatalogField>

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

          {hasModelCatalog ? (
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
          ) : (
            <CatalogField label={cf.modelLabel}>
              <input
                value={form.model}
                disabled={!hasMake}
                required
                placeholder={cf.modelFreePlaceholder}
                onChange={(event) =>
                  patch({
                    model: event.target.value,
                    modelSlug: "",
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
                className={carFieldInputClass}
              />
            </CatalogField>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CatalogSelect
            label={cf.generationLabel}
            value={form.generationSlug}
            options={generations}
            loading={generationsLoading}
            disabled={!showGenerations || !hasMake || !hasModel}
            placeholder={showGenerations ? dict.cars.common.optional : cf.notApplicable}
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
            options={fuelOptions}
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
            options={powerOptions}
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
            options={capacityOptions}
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
            options={doorOptions}
            loading={doorsLoading}
            disabled={!showDoors || !form.engineCapacitySlug}
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
            options={gearboxOptions}
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
              {bodyOptions.map((option) => (
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
          options={versionOptions}
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
