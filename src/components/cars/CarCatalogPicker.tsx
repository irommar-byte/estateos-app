import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, FlatList, ActivityIndicator, TextInput } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { BODY_TYPE_OPTIONS, fetchCarCatalogOptions, type CatalogOption } from '../../services/carCatalogApi';
import { useCarScreenTheme, type CarScreenColors } from '../../theme/carScreenTheme';
import { pickDoorCountOption, pickGenerationForYear } from '../../utils/carCatalogInference';

export type CarCatalogFormState = {
  make: string;
  model: string;
  makeSlug: string;
  modelSlug: string;
  year: string;
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
};

type CarCatalogPickerProps = {
  value: CarCatalogFormState;
  onChange: (patch: Partial<CarCatalogFormState>) => void;
};

function findByLabel(options: CatalogOption[], label: string) {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return null;
  return (
    options.find((o) => o.label.toLowerCase() === normalized) ||
    options.find((o) => o.value.toLowerCase() === normalized) ||
    options.find((o) => o.label.toLowerCase().includes(normalized)) ||
    options.find((o) => normalized.includes(o.label.toLowerCase())) ||
    null
  );
}

function findEnginePowerOption(options: CatalogOption[], label: string) {
  const direct = findByLabel(options, label);
  if (direct) return direct;
  const kw = Number(label.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(kw) || kw <= 0) return null;
  return (
    options.find((o) => o.label.replace(/[^\d.]/g, '') === String(kw)) ||
    options.find((o) => o.label.toLowerCase().includes(`${kw} kw`)) ||
    options.find((o) => o.label.toLowerCase().startsWith(`${kw}`)) ||
    null
  );
}

function findEngineCapacityOption(options: CatalogOption[], label: string) {
  const direct = findByLabel(options, label);
  if (direct) return direct;
  const cm3 = Number(label.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(cm3) || cm3 <= 0) return null;
  const rounded = String(Math.round(cm3));
  return (
    options.find((o) => o.label.replace(/[^\d.]/g, '') === rounded) ||
    options.find((o) => o.label.toLowerCase().includes(`${rounded} cm`)) ||
    options.find((o) => o.label.toLowerCase().startsWith(rounded)) ||
    null
  );
}

function SelectField({
  label,
  value,
  display,
  options,
  loading,
  disabled,
  onSelect,
  colors,
}: {
  label: string;
  value: string;
  display: string;
  options: CatalogOption[];
  loading?: boolean;
  disabled?: boolean;
  onSelect: (option: CatalogOption) => void;
  colors: CarScreenColors;
}) {
  const [open, setOpen] = useState(false);
  const styles = useMemo(() => createSelectStyles(colors), [colors]);
  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[styles.select, disabled && styles.selectDisabled]}
      >
        <Text style={styles.selectLabel}>{label}</Text>
        <View style={styles.selectRow}>
          <Text style={[styles.selectValue, !display && styles.selectPlaceholder]} numberOfLines={1}>
            {loading ? 'Ładowanie...' : display || `Wybierz ${label.toLowerCase()}`}
          </Text>
          <ChevronDown color={colors.muted} size={16} />
        </View>
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.modalClose}>Zamknij</Text>
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.accentSoft} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  style={[styles.optionRow, item.value === value && styles.optionRowActive]}
                >
                  <Text style={[styles.optionLabel, item.value === value && styles.optionLabelActive]}>{item.label}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.empty}>Brak opcji — uzupełnij poprzednie pola.</Text>}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

function useCatalog(resource: Parameters<typeof fetchCarCatalogOptions>[0]['resource'], params: Omit<Parameters<typeof fetchCarCatalogOptions>[0], 'resource'>, enabled: boolean) {
  const [options, setOptions] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify({ resource, params, enabled });

  useEffect(() => {
    if (!enabled) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCarCatalogOptions({ resource, ...params })
      .then((items) => {
        if (!cancelled) setOptions(items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { options, loading };
}

export default function CarCatalogPicker({ value, onChange }: CarCatalogPickerProps) {
  const { colors, elevation } = useCarScreenTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () =>
      Array.from({ length: currentYear - 1900 + 1 }, (_, index) => {
        const year = String(currentYear - index);
        return { value: year, label: year };
      }),
    [currentYear],
  );

  const hasMake = Boolean(value.makeSlug);
  const hasModel = Boolean(value.modelSlug);
  const base = useMemo(
    () => ({
      make: value.makeSlug,
      model: value.modelSlug,
      year: value.year || undefined,
      generation: value.generationSlug || undefined,
      fuel_type: value.fuelSlug || undefined,
      engine_power: value.enginePowerSlug || undefined,
      engine_capacity: value.engineCapacitySlug || undefined,
      door_count: value.doorCountSlug || undefined,
      gearbox: value.gearboxSlug || undefined,
    }),
    [value],
  );

  const makes = useCatalog('makes', {}, true);
  const models = useCatalog('models', { make: value.makeSlug }, hasMake);
  const generations = useCatalog('generations', { make: value.makeSlug, model: value.modelSlug }, hasMake && hasModel);
  const fuels = useCatalog('fuel_types', { make: value.makeSlug, model: value.modelSlug, year: value.year || undefined }, hasMake && hasModel);
  const powers = useCatalog('engine_powers', base, hasMake && hasModel && Boolean(value.fuelSlug));
  const capacities = useCatalog('engine_capacities', base, Boolean(value.enginePowerSlug));
  const doors = useCatalog('door_counts', base, Boolean(value.engineCapacitySlug));
  const gearboxes = useCatalog('gearboxes', base, Boolean(value.engineCapacitySlug));
  const versions = useCatalog('versions', base, Boolean(value.gearboxSlug));

  useEffect(() => {
    if (!value.make || value.makeSlug || !makes.options.length) return;
    const match = findByLabel(makes.options, value.make);
    if (match) onChange({ makeSlug: match.value, make: match.label });
  }, [value.make, value.makeSlug, makes.options, onChange]);

  useEffect(() => {
    if (!value.model || value.modelSlug || !models.options.length) return;
    const match = findByLabel(models.options, value.model);
    if (match) onChange({ modelSlug: match.value, model: match.label });
  }, [value.model, value.modelSlug, models.options, onChange]);

  useEffect(() => {
    if (value.generationSlug || !generations.options.length || !value.year || !hasModel) return;
    const match = pickGenerationForYear(generations.options, value.year, value.generation);
    if (match) onChange({ generationSlug: match.value, generation: match.label });
  }, [value.generationSlug, value.generation, value.year, hasModel, generations.options, onChange]);

  useEffect(() => {
    if (value.doorCountSlug || !doors.options.length || !value.engineCapacitySlug) return;
    const match = pickDoorCountOption(doors.options, value.bodyType);
    if (match) onChange({ doorCountSlug: match.value, doorCount: match.label });
  }, [value.doorCountSlug, value.bodyType, value.engineCapacitySlug, doors.options, onChange]);

  useEffect(() => {
    if (!value.fuelType || value.fuelSlug || !fuels.options.length) return;
    const match = findByLabel(fuels.options, value.fuelType);
    if (match) onChange({ fuelSlug: match.value, fuelType: match.label });
  }, [value.fuelType, value.fuelSlug, fuels.options, onChange]);

  useEffect(() => {
    if (!value.enginePower || value.enginePowerSlug || !powers.options.length) return;
    const match = findEnginePowerOption(powers.options, value.enginePower);
    if (match) onChange({ enginePowerSlug: match.value, enginePower: match.label });
  }, [value.enginePower, value.enginePowerSlug, powers.options, onChange]);

  useEffect(() => {
    if (!value.engineCapacity || value.engineCapacitySlug || !capacities.options.length) return;
    const match = findEngineCapacityOption(capacities.options, value.engineCapacity);
    if (match) onChange({ engineCapacitySlug: match.value, engineCapacity: match.label });
  }, [value.engineCapacity, value.engineCapacitySlug, capacities.options, onChange]);

  useEffect(() => {
    if (!value.doorCount || value.doorCountSlug || !doors.options.length) return;
    const match = findByLabel(doors.options, value.doorCount);
    if (match) onChange({ doorCountSlug: match.value, doorCount: match.label });
  }, [value.doorCount, value.doorCountSlug, doors.options, onChange]);

  useEffect(() => {
    if (!value.transmission || value.gearboxSlug || !gearboxes.options.length) return;
    const match = findByLabel(gearboxes.options, value.transmission);
    if (match) onChange({ gearboxSlug: match.value, transmission: match.label });
  }, [value.transmission, value.gearboxSlug, gearboxes.options, onChange]);

  useEffect(() => {
    if (!value.trimVersion || value.trimVersionSlug || !versions.options.length) return;
    const match = findByLabel(versions.options, value.trimVersion);
    if (match) onChange({ trimVersionSlug: match.value, trimVersion: match.label });
  }, [value.trimVersion, value.trimVersionSlug, versions.options, onChange]);

  const resetFrom = (level: 'model' | 'generation' | 'fuel' | 'power' | 'capacity' | 'doors' | 'gearbox') => {
    const patch: Partial<CarCatalogFormState> = {};
    if (level === 'model') {
      Object.assign(patch, {
        modelSlug: '',
        model: '',
        generationSlug: '',
        generation: '',
        fuelSlug: '',
        fuelType: '',
        enginePowerSlug: '',
        enginePower: '',
        engineCapacitySlug: '',
        engineCapacity: '',
        doorCountSlug: '',
        doorCount: '',
        gearboxSlug: '',
        transmission: 'Automatyczna',
        trimVersionSlug: '',
        trimVersion: '',
      });
    } else if (level === 'generation') {
      Object.assign(patch, {
        fuelSlug: '',
        fuelType: '',
        enginePowerSlug: '',
        enginePower: '',
        engineCapacitySlug: '',
        engineCapacity: '',
        doorCountSlug: '',
        doorCount: '',
        gearboxSlug: '',
        transmission: 'Automatyczna',
        trimVersionSlug: '',
        trimVersion: '',
      });
    } else if (level === 'fuel') {
      Object.assign(patch, {
        enginePowerSlug: '',
        enginePower: '',
        engineCapacitySlug: '',
        engineCapacity: '',
        doorCountSlug: '',
        doorCount: '',
        gearboxSlug: '',
        transmission: 'Automatyczna',
        trimVersionSlug: '',
        trimVersion: '',
      });
    } else if (level === 'power') {
      Object.assign(patch, {
        engineCapacitySlug: '',
        engineCapacity: '',
        doorCountSlug: '',
        doorCount: '',
        gearboxSlug: '',
        transmission: 'Automatyczna',
        trimVersionSlug: '',
        trimVersion: '',
      });
    } else if (level === 'capacity') {
      Object.assign(patch, {
        doorCountSlug: '',
        doorCount: '',
        gearboxSlug: '',
        transmission: 'Automatyczna',
        trimVersionSlug: '',
        trimVersion: '',
      });
    } else if (level === 'doors') {
      Object.assign(patch, {
        gearboxSlug: '',
        transmission: 'Automatyczna',
        trimVersionSlug: '',
        trimVersion: '',
      });
    } else if (level === 'gearbox') {
      Object.assign(patch, { trimVersionSlug: '', trimVersion: '' });
    }
    onChange(patch);
  };

  return (
    <View style={[styles.root, elevation.cardSm]}>
      <Text style={styles.heading}>Katalog pojazdu</Text>
      <Text style={styles.lead}>Wybierz markę, model, paliwo i silnik — jak na Otomoto.</Text>

      <SelectField
        label="Rocznik produkcji"
        value={value.year}
        display={value.year}
        options={yearOptions}
        colors={colors}
        onSelect={(option) => onChange({ year: option.label })}
      />

      <SelectField
        label="Marka"
        value={value.makeSlug}
        display={value.make}
        options={makes.options}
        loading={makes.loading}
        colors={colors}
        onSelect={(option) => {
          onChange({ makeSlug: option.value, make: option.label });
          resetFrom('model');
        }}
      />
      <SelectField
        label="Model"
        value={value.modelSlug}
        display={value.model}
        options={models.options}
        loading={models.loading}
        disabled={!hasMake}
        colors={colors}
        onSelect={(option) => {
          onChange({ modelSlug: option.value, model: option.label });
          resetFrom('generation');
        }}
      />
      <SelectField
        label="Generacja"
        value={value.generationSlug}
        display={value.generation}
        options={generations.options}
        loading={generations.loading}
        disabled={!hasModel}
        colors={colors}
        onSelect={(option) => {
          onChange({ generationSlug: option.value, generation: option.label });
          resetFrom('generation');
        }}
      />
      <SelectField
        label="Rodzaj paliwa"
        value={value.fuelSlug}
        display={value.fuelType}
        options={fuels.options}
        loading={fuels.loading}
        disabled={!hasModel}
        colors={colors}
        onSelect={(option) => {
          onChange({ fuelSlug: option.value, fuelType: option.label });
          resetFrom('fuel');
        }}
      />
      <SelectField
        label="Moc silnika"
        value={value.enginePowerSlug}
        display={value.enginePower}
        options={powers.options}
        loading={powers.loading}
        disabled={!value.fuelSlug}
        colors={colors}
        onSelect={(option) => {
          onChange({ enginePowerSlug: option.value, enginePower: option.label });
          resetFrom('power');
        }}
      />
      <SelectField
        label="Pojemność silnika"
        value={value.engineCapacitySlug}
        display={value.engineCapacity}
        options={capacities.options}
        loading={capacities.loading}
        disabled={!value.enginePowerSlug}
        colors={colors}
        onSelect={(option) => {
          onChange({ engineCapacitySlug: option.value, engineCapacity: option.label });
          resetFrom('capacity');
        }}
      />
      <SelectField
        label="Liczba drzwi"
        value={value.doorCountSlug}
        display={value.doorCount}
        options={doors.options}
        loading={doors.loading}
        disabled={!value.engineCapacitySlug}
        colors={colors}
        onSelect={(option) => {
          onChange({ doorCountSlug: option.value, doorCount: option.label });
          resetFrom('doors');
        }}
      />
      <SelectField
        label="Skrzynia biegów"
        value={value.gearboxSlug}
        display={value.transmission}
        options={gearboxes.options}
        loading={gearboxes.loading}
        disabled={!value.engineCapacitySlug}
        colors={colors}
        onSelect={(option) => {
          onChange({ gearboxSlug: option.value, transmission: option.label });
          resetFrom('gearbox');
        }}
      />
      <SelectField
        label="Wersja"
        value={value.trimVersionSlug}
        display={value.trimVersion}
        options={versions.options}
        loading={versions.loading}
        disabled={!value.gearboxSlug}
        colors={colors}
        onSelect={(option) => onChange({ trimVersionSlug: option.value, trimVersion: option.label })}
      />

      <SelectField
        label="Nadwozie"
        value={value.bodyType}
        display={value.bodyType}
        options={BODY_TYPE_OPTIONS.map((label) => ({ value: label, label }))}
        colors={colors}
        onSelect={(option) => onChange({ bodyType: option.label })}
      />
    </View>
  );
}

function createStyles(colors: CarScreenColors) {
  return StyleSheet.create({
    root: {
      gap: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      padding: 14,
    },
    heading: { color: colors.accent, fontSize: 14, fontWeight: '700' },
    lead: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  });
}

function createSelectStyles(colors: CarScreenColors) {
  return StyleSheet.create({
    select: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    selectDisabled: { opacity: 0.45 },
    selectLabel: { color: colors.placeholder, fontSize: 11, fontWeight: '600' },
    selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    selectValue: { color: colors.text, fontSize: 15, flex: 1 },
    selectPlaceholder: { color: colors.placeholder },
    modalRoot: { flex: 1, backgroundColor: colors.modalBg },
    modalHeader: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
    modalClose: { color: colors.accentSoft, fontSize: 14, fontWeight: '700' },
    optionRow: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.inputBorder,
    },
    optionRowActive: { backgroundColor: colors.buttonBg },
    optionLabel: { color: colors.text, fontSize: 16 },
    optionLabelActive: { color: colors.accent, fontWeight: '700' },
    empty: { color: colors.muted, textAlign: 'center', marginTop: 24, paddingHorizontal: 20 },
  });
}
