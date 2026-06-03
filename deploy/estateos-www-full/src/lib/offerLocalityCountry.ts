import { fetchMapboxReverseFeature } from '@/lib/location/resolveOfferLocationFromCoordinates';
import {
  isInternationalCountryCode,
  isOutsidePolandBounds,
} from '@/lib/location/locationNameMatch';

const COUNTRY_LABELS_PL: Record<string, string> = {
  PL: 'Polska',
  JP: 'Japonia',
  DE: 'Niemcy',
  CZ: 'Czechy',
  SK: 'Słowacja',
  UA: 'Ukraina',
  GB: 'Wielka Brytania',
  US: 'Stany Zjednoczone',
  FR: 'Francja',
  ES: 'Hiszpania',
  IT: 'Włochy',
  NL: 'Holandia',
  AT: 'Austria',
  BE: 'Belgia',
  CH: 'Szwajcaria',
  SE: 'Szwecja',
  NO: 'Norwegia',
  LT: 'Litwa',
  LV: 'Łotwa',
  EE: 'Estonia',
  HR: 'Chorwacja',
  RO: 'Rumunia',
  BG: 'Bułgaria',
  GR: 'Grecja',
  PT: 'Portugalia',
  IE: 'Irlandia',
  HU: 'Węgry',
};

function countryLabelFromCode(code: string, mapboxName?: string): string {
  const norm = String(code || '').trim().toUpperCase();
  const fromMapbox = String(mapboxName || '').trim();
  if (fromMapbox) return fromMapbox;
  return COUNTRY_LABELS_PL[norm] || norm;
}

export async function inferCountryFromCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<{ localityCountry: string; localityCountryCode: string }> {
  const latN = Number(lat);
  const lngN = Number(lng);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
    return { localityCountry: 'Polska', localityCountryCode: 'PL' };
  }

  if (!isOutsidePolandBounds(latN, lngN)) {
    return { localityCountry: 'Polska', localityCountryCode: 'PL' };
  }

  const feature = await fetchMapboxReverseFeature(latN, lngN);
  const context = Array.isArray(feature?.context) ? feature.context : [];
  const countryItem = context.find((item: { id?: string }) =>
    String(item?.id || '').startsWith('country'),
  ) as { text?: string; text_pl?: string; short_code?: string } | undefined;

  const code = String(countryItem?.short_code || '')
    .trim()
    .toUpperCase()
    .replace(/^COUNTRY:/, '');
  const name = String(countryItem?.text_pl || countryItem?.text || '').trim();

  if (code) {
    return {
      localityCountry: countryLabelFromCode(code, name),
      localityCountryCode: code,
    };
  }

  return { localityCountry: name || 'Inny kraj', localityCountryCode: 'XX' };
}

/**
 * Ujednolica zapis kraju — gdy pinezka jest poza Polską, nie wymuszaj PL.
 */
export function resolvePersistedLocalityFields(params: {
  localityCountry?: string | null;
  localityCountryCode?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}): { localityCountry: string; localityCountryCode: string } {
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const storedCode = String(params.localityCountryCode || '')
    .trim()
    .toUpperCase()
    .replace(/^COUNTRY:/, '');
  const storedCountry = String(params.localityCountry || '').trim();

  const pinOutsidePl =
    Number.isFinite(lat) && Number.isFinite(lng) && isOutsidePolandBounds(lat, lng);

  if (pinOutsidePl) {
    if (isInternationalCountryCode(storedCode) && storedCountry) {
      return { localityCountry: storedCountry, localityCountryCode: storedCode };
    }
    if (isInternationalCountryCode(storedCode)) {
      return {
        localityCountry: countryLabelFromCode(storedCode),
        localityCountryCode: storedCode,
      };
    }
    return { localityCountry: '', localityCountryCode: '' };
  }

  if (storedCountry && storedCode) {
    return { localityCountry: storedCountry, localityCountryCode: storedCode };
  }

  return { localityCountry: 'Polska', localityCountryCode: 'PL' };
}

export async function resolvePersistedLocalityFieldsAsync(params: {
  localityCountry?: string | null;
  localityCountryCode?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}): Promise<{ localityCountry: string; localityCountryCode: string }> {
  const sync = resolvePersistedLocalityFields(params);
  if (sync.localityCountryCode && sync.localityCountry) {
    return sync;
  }

  const lat = Number(params.lat);
  const lng = Number(params.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { localityCountry: 'Polska', localityCountryCode: 'PL' };
  }

  return inferCountryFromCoordinates(lat, lng);
}
