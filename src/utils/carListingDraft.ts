import AsyncStorage from '@react-native-async-storage/async-storage';

export const CAR_DRAFT_KEY = 'estateos_car_listing_draft_v1';
export const CAR_PENDING_PUBLISH_KEY = 'estateos_car_pending_publish_v1';

export type CarDraftForm = Record<string, unknown>;

type DraftPayload = {
  form: CarDraftForm;
  savedAt: number;
};

export async function readCarListingDraft(): Promise<DraftPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CAR_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    if (!parsed?.form || typeof parsed.form !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCarListingDraft(form: CarDraftForm): Promise<void> {
  try {
    const payload: DraftPayload = { form, savedAt: Date.now() };
    await AsyncStorage.setItem(CAR_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export async function clearCarListingDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CAR_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export async function setCarPendingPublish(pending: boolean): Promise<void> {
  try {
    if (pending) await AsyncStorage.setItem(CAR_PENDING_PUBLISH_KEY, '1');
    else await AsyncStorage.removeItem(CAR_PENDING_PUBLISH_KEY);
  } catch {
    /* ignore */
  }
}

export async function consumeCarPendingPublish(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CAR_PENDING_PUBLISH_KEY);
    if (!raw) return false;
    await AsyncStorage.removeItem(CAR_PENDING_PUBLISH_KEY);
    return true;
  } catch {
    return false;
  }
}

export function draftHasContent(form?: Partial<CarDraftForm> | null): boolean {
  if (!form) return false;
  const textKeys = [
    'title',
    'make',
    'model',
    'year',
    'vin',
    'registrationNumber',
    'mileageKm',
    'pricePln',
    'city',
    'description',
  ];
  if (textKeys.some((key) => String(form[key] || '').trim())) return true;
  if (Array.isArray(form.images) && form.images.length > 0) return true;
  return false;
}
