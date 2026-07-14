import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useAuthStore } from '../store/useAuthStore';
import { fetchCarById, parseCarImages, withCarImage, type CarListing } from '../services/carsApi';
import {
  createCarListing,
  updateCarListing,
  uploadCarImages,
  type CarFormPayload,
} from '../services/carsMutations';
import CarCatalogPicker, { type CarCatalogFormState } from '../components/cars/CarCatalogPicker';
import CarPhotoGrid from '../components/cars/CarPhotoGrid';
import CarCityMapPicker from '../components/cars/CarCityMapPicker';
import CarRegistrationScanPrompt from '../components/cars/CarRegistrationScanPrompt';
import CarVehicleDocsSection, { type CarVehicleDocsState } from '../components/cars/CarVehicleDocsSection';
import { formatDateForForm } from '../utils/polishDateInput';
import {
  listMissingListingFields,
  missingFieldsMessage,
  type CarListingMissingFieldKey,
  type CarRegistrationPrefill,
} from '../utils/carRegistrationPrefill';
import { useCarScreenTheme, type CarScreenColors } from '../theme/carScreenTheme';

type FormState = CarCatalogFormState &
  CarVehicleDocsState & {
    title: string;
    description: string;
    mileageKm: string;
    pricePln: string;
    city: string;
    localityCountry: string;
    cityLat: number | null;
    cityLng: number | null;
    images: string[];
    imageByteSizes: Record<string, number>;
  };

const EMPTY_CATALOG: CarCatalogFormState = {
  make: '',
  model: '',
  makeSlug: '',
  modelSlug: '',
  year: '',
  fuelType: '',
  fuelSlug: '',
  transmission: 'Automatyczna',
  gearboxSlug: '',
  bodyType: 'SUV',
  exteriorColor: '',
  generation: '',
  generationSlug: '',
  enginePower: '',
  enginePowerSlug: '',
  engineCapacity: '',
  engineCapacitySlug: '',
  trimVersion: '',
  trimVersionSlug: '',
  doorCount: '',
  doorCountSlug: '',
};

const EMPTY_FORM: FormState = {
  ...EMPTY_CATALOG,
  title: '',
  description: '',
  mileageKm: '',
  pricePln: '',
  city: '',
  localityCountry: 'Polska',
  cityLat: null,
  cityLng: null,
  vin: '',
  registrationNumber: '',
  firstRegistrationDate: '',
  insuranceValidUntil: '',
  restrictVehicleDocs: false,
  images: [],
  imageByteSizes: {},
};

function normalizeVinInput(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
}

function carToForm(car: CarListing): FormState {
  const images = parseCarImages(car);
  return {
    ...EMPTY_CATALOG,
    title: car.title,
    description: car.description || '',
    make: car.make,
    model: car.model,
    year: String(car.year),
    mileageKm: String(car.mileageKm),
    fuelType: car.fuelType,
    transmission: car.transmission,
    bodyType: car.bodyType,
    exteriorColor: car.exteriorColor || '',
    generation: car.generation || '',
    enginePower: car.enginePower || '',
    engineCapacity: car.engineCapacity || '',
    trimVersion: car.trimVersion || '',
    doorCount: car.doorCount ? String(car.doorCount) : '',
    pricePln: String(car.pricePln),
    city: car.city,
    localityCountry: car.localityCountry || 'Polska',
    cityLat: car.cityLat ?? null,
    cityLng: car.cityLng ?? null,
    vin: car.vin || '',
    registrationNumber: car.registrationNumber || '',
    firstRegistrationDate: formatDateForForm(car.firstRegistrationDate || ''),
    insuranceValidUntil: formatDateForForm(car.insuranceValidUntil || ''),
    restrictVehicleDocs: Boolean(car.restrictVehicleDocs),
    images,
    imageByteSizes: Object.fromEntries(images.map((uri) => [uri, 900_000])),
  };
}

function toPayload(form: FormState, uploadedImages: string[]): CarFormPayload {
  const doorCount = Number(form.doorCountSlug || form.doorCount);
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    make: form.make.trim(),
    model: form.model.trim(),
    year: Number(form.year) || 2020,
    mileageKm: Number(form.mileageKm) || 0,
    fuelType: form.fuelType.trim() || 'Benzyna',
    transmission: form.transmission.trim() || 'Automatyczna',
    bodyType: form.bodyType.trim() || 'SUV',
    exteriorColor: form.exteriorColor.trim(),
    generation: form.generation.trim(),
    enginePower: form.enginePower.trim(),
    engineCapacity: form.engineCapacity.trim(),
    trimVersion: form.trimVersion.trim(),
    doorCount: Number.isFinite(doorCount) && doorCount > 0 ? doorCount : null,
    pricePln: Number(form.pricePln) || 0,
    city: form.city.trim(),
    localityCountry: form.localityCountry.trim() || 'Polska',
    cityLat: form.cityLat,
    cityLng: form.cityLng,
    vin: normalizeVinInput(form.vin),
    registrationNumber: form.registrationNumber.trim().toUpperCase(),
    firstRegistrationDate: formatDateForForm(form.firstRegistrationDate),
    insuranceValidUntil: formatDateForForm(form.insuranceValidUntil),
    restrictVehicleDocs: Boolean(form.restrictVehicleDocs),
    imageUrl: uploadedImages[0] || '',
    images: uploadedImages,
  };
}

type AddCarListingScreenProps = {
  navigation: any;
  route: {
    params?: {
      mode?: 'create' | 'edit';
      car?: CarListing;
      carId?: number;
    };
  };
};

export default function AddCarListingScreen({ navigation, route }: AddCarListingScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useCarScreenTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const mode = route.params?.mode || (route.params?.car ? 'edit' : 'create');
  const editingCar = route.params?.car;
  const carId = Number(route.params?.carId || editingCar?.id || 0);

  const [form, setForm] = useState<FormState>(
    mode === 'edit' && carId > 0 ? EMPTY_FORM : editingCar ? carToForm(editingCar) : EMPTY_FORM,
  );
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(mode === 'edit' && carId > 0);
  const [scanPromptOpen, setScanPromptOpen] = useState(mode === 'create');
  const [highlightKeys, setHighlightKeys] = useState<CarListingMissingFieldKey[]>([]);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'edit' || !carId) return;
    let cancelled = false;
    (async () => {
      setLoadingEdit(true);
      try {
        const fresh = await fetchCarById(carId, token);
        if (!cancelled && fresh) {
          setForm((prev) => {
            const next = carToForm(fresh);
            return {
              ...next,
              vin: next.vin || prev.vin,
              registrationNumber: next.registrationNumber || prev.registrationNumber,
              firstRegistrationDate: next.firstRegistrationDate || prev.firstRegistrationDate,
              insuranceValidUntil: next.insuranceValidUntil || prev.insuranceValidUntil,
            };
          });
        }
      } catch {
        // keep route params fallback
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, carId, token]);

  useEffect(() => {
    if (!user || !token) {
      Alert.alert('Zaloguj się', 'Aby dodać ogłoszenie auta, musisz być zalogowany.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [user, token, navigation]);

  const patchForm = (partial: Partial<FormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...partial };
      setHighlightKeys(listMissingListingFields(next, next.images.length > 0));
      return next;
    });
  };

  const applyRegistrationPrefill = (prefill: CarRegistrationPrefill, missingFields: string[]) => {
    setScanPromptOpen(false);
    setForm((prev) => {
      const next = {
        ...prev,
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
      const keys = (
        missingFields.length ? missingFields : listMissingListingFields(next, next.images.length > 0)
      ) as CarListingMissingFieldKey[];
      setHighlightKeys(keys);
      setScanNotice(`Dane z dowodu wczytane. ${missingFieldsMessage(keys) || 'Sprawdź katalog i uzupełnij ogłoszenie.'}`);
      return next;
    });
  };

  const isHighlighted = (key: CarListingMissingFieldKey) => highlightKeys.includes(key);

  const handleSubmit = async () => {
    if (!token) return;
    if (!form.title.trim() || !form.make.trim() || !form.model.trim() || !form.city.trim()) {
      Alert.alert('Uzupełnij formularz', 'Podaj tytuł, markę, model i miejscowość.');
      return;
    }
    if (!form.fuelType.trim()) {
      Alert.alert('Katalog aut', 'Wybierz rodzaj paliwa z katalogu.');
      return;
    }
    if (Number(form.pricePln) <= 0) {
      Alert.alert('Cena', 'Podaj poprawną cenę ogłoszenia.');
      return;
    }

    setSubmitting(true);
    try {
      const uploadedImages = form.images.length ? await uploadCarImages(token, form.images) : [];
      const payload = toPayload(form, uploadedImages);

      if (mode === 'edit' && carId > 0) {
        const updated = await updateCarListing(token, carId, payload);
        const saved = withCarImage(updated);
        setForm(carToForm(saved));
        Alert.alert('Zapisano', 'Ogłoszenie auta zostało zaktualizowane.', [
          { text: 'OK', onPress: () => navigation.replace('CarDetail', { carId, car: saved }) },
        ]);
      } else {
        const created = await createCarListing(token, payload);
        const saved = withCarImage(created);
        Alert.alert('Opublikowano', 'Ogłoszenie auta jest już w katalogu.', [
          { text: 'OK', onPress: () => navigation.replace('CarDetail', { carId: saved.id, car: saved }) },
        ]);
      }
    } catch (error) {
      Alert.alert('Błąd', error instanceof Error ? error.message : 'Nie udało się zapisać ogłoszenia.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CarRegistrationScanPrompt
        visible={scanPromptOpen}
        token={token}
        onSkip={() => setScanPromptOpen(false)}
        onPrefill={applyRegistrationPrefill}
      />

      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={colors.accent} size={22} />
          <Text style={styles.backLabel}>Anuluj</Text>
        </Pressable>
        <Text style={styles.topTitle}>{mode === 'edit' ? 'Edytuj auto' : 'Dodaj auto'}</Text>
      </View>

      {loadingEdit ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.accentSoft} />
          <Text style={styles.loadingText}>Ładowanie ogłoszenia...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>EstateOS™Car</Text>
          {scanNotice ? <Text style={styles.scanNotice}>{scanNotice}</Text> : null}

          <View style={isHighlighted('images') ? styles.highlightWrap : undefined}>
            <CarPhotoGrid
              images={form.images}
              imageByteSizes={form.imageByteSizes}
              onChange={(images, imageByteSizes) => patchForm({ images, imageByteSizes })}
            />
          </View>

          <CarCatalogPicker
            value={form}
            onChange={(partial) => {
              setForm((prev) => {
                const next = { ...prev, ...partial };
                if (partial.trimVersion && !prev.title.trim() && next.make && next.model) {
                  next.title = `${next.make} ${next.model} ${partial.trimVersion}`.trim();
                }
                return next;
              });
            }}
          />

          <Field
            label="Tytuł ogłoszenia"
            value={form.title}
            onChangeText={(title) => patchForm({ title })}
            highlighted={isHighlighted('title')}
            colors={colors}
            styles={styles}
          />
          <Field
            label="Opis"
            value={form.description}
            onChangeText={(description) => patchForm({ description })}
            multiline
            placeholder="Opisz stan auta, historię serwisową, wyposażenie..."
            highlighted={isHighlighted('description')}
            colors={colors}
            styles={styles}
          />

          <CarVehicleDocsSection
            value={{
              vin: form.vin,
              registrationNumber: form.registrationNumber,
              firstRegistrationDate: form.firstRegistrationDate,
              insuranceValidUntil: form.insuranceValidUntil,
              restrictVehicleDocs: form.restrictVehicleDocs,
            }}
            onChange={(patch) => patchForm(patch)}
          />

          <View style={styles.row}>
            <View style={styles.half}>
              <Field
                label="Przebieg km"
                value={form.mileageKm}
                onChangeText={(mileageKm) => patchForm({ mileageKm })}
                keyboardType="number-pad"
                highlighted={isHighlighted('mileageKm')}
                colors={colors}
                styles={styles}
              />
            </View>
            <View style={styles.half}>
              <Field
                label="Cena PLN"
                value={form.pricePln}
                onChangeText={(pricePln) => patchForm({ pricePln })}
                keyboardType="number-pad"
                highlighted={isHighlighted('pricePln')}
                colors={colors}
                styles={styles}
              />
            </View>
          </View>

          <View style={isHighlighted('city') ? styles.highlightWrap : undefined}>
            <CarCityMapPicker
              value={form.city}
              country={form.localityCountry}
              lat={form.cityLat}
              lng={form.cityLng}
              onChange={({ city, lat, lng, country }) =>
                patchForm({ city, cityLat: lat, cityLng: lng, localityCountry: country || form.localityCountry })
              }
            />
          </View>

          <Pressable onPress={handleSubmit} disabled={submitting} style={styles.submitBtn}>
            {submitting ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.submitLabel}>{mode === 'edit' ? 'Zapisz zmiany' : 'Opublikuj ogłoszenie'}</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
  placeholder,
  highlighted,
  colors,
  styles,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'number-pad';
  multiline?: boolean;
  placeholder?: string;
  highlighted?: boolean;
  colors: CarScreenColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 5 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, multiline && styles.textarea, highlighted && styles.inputHighlight]}
      />
    </View>
  );
}

function createStyles(colors: CarScreenColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    topBar: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
    backLabel: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    topTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    loadingText: { color: colors.muted, fontSize: 14 },
    content: { padding: 20, paddingBottom: 48, gap: 16 },
    eyebrow: {
      color: colors.accentSoft,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    scanNotice: {
      color: colors.warningText,
      fontSize: 13,
      lineHeight: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.warningBorder,
      backgroundColor: colors.warningBg,
      padding: 12,
    },
    highlightWrap: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(251,191,36,0.55)',
      padding: 4,
    },
    field: { gap: 6 },
    fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
    },
    inputHighlight: {
      borderColor: 'rgba(251,191,36,0.65)',
    },
    textarea: { minHeight: 120 },
    row: { flexDirection: 'row', gap: 10 },
    half: { flex: 1 },
    submitBtn: {
      marginTop: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primaryButtonBorder,
      backgroundColor: colors.primaryButtonBg,
      paddingVertical: 14,
      alignItems: 'center',
    },
    submitLabel: {
      color: colors.primaryButtonText,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
  });
}
