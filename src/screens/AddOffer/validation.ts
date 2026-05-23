import {
  defaultExactLocationForPropertyType,
  getDraftLocationPresentation,
  hasValidMapCoordinates,
  isLocationStepComplete,
  resolveIsExactLocation,
} from '../../constants/locationEcosystem';
import { t } from '../../i18n';
import { charsRemainingLabel, meterUnitLabel, type MeterUnitKey } from '../../i18n/units';

export const ADD_OFFER_TITLE_MIN = 10;
export const ADD_OFFER_TITLE_MAX = 70;
export const ADD_OFFER_DESC_MIN = 10;
export const ADD_OFFER_DESC_MAX = 8000;
export const ADD_OFFER_STREET_MIN = 3;
export const ADD_OFFER_MIN_IMAGES = 1;

const TRANSACTION_TYPES = new Set(['SELL', 'SALE', 'RENT']);
const PROPERTY_TYPES = new Set(['FLAT', 'APARTMENT', 'HOUSE', 'PREMISES', 'PLOT']);

export type AddOfferRequirement = {
  id: string;
  label: string;
  ok: boolean;
  /** Krótka instrukcja, gdy `ok === false`. */
  action: string;
  /** Licznik znaków / liczba — do czerwonego paska postępu. */
  meter?: {
    current: number;
    min?: number;
    max?: number;
    unit?: MeterUnitKey;
  };
};

const isTruthyNumber = (value: unknown) => {
  const num = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(num) && num > 0;
};

const trimLen = (value: unknown) => String(value ?? '').trim().length;

function requirementMeter(
  current: number,
  min: number,
  unit: MeterUnitKey,
  max?: number,
): NonNullable<AddOfferRequirement['meter']> {
  return max !== undefined ? { current, min, max, unit } : { current, min, unit };
}

export function getStepRequirements(step: number, draft: any): AddOfferRequirement[] {
  switch (step) {
    case 1:
      return getStep1Requirements(draft);
    case 2:
      return getStep2Requirements(draft);
    case 3:
      return getStep3Requirements(draft);
    case 4:
      return getStep4Requirements(draft);
    case 5:
      return getStep5Requirements(draft);
    default:
      return [];
  }
}

function getStep1Requirements(draft: any): AddOfferRequirement[] {
  const needsCondition = String(draft?.propertyType || '') !== 'PLOT';
  const items: AddOfferRequirement[] = [
    {
      id: 'transaction',
      label: t('addOffer.validation.step1.transaction.label'),
      ok: TRANSACTION_TYPES.has(String(draft?.transactionType || '')),
      action: t('addOffer.validation.step1.transaction.action'),
    },
    {
      id: 'propertyType',
      label: t('addOffer.validation.step1.propertyType.label'),
      ok: PROPERTY_TYPES.has(String(draft?.propertyType || '')),
      action: t('addOffer.validation.step1.propertyType.action'),
    },
  ];
  if (needsCondition) {
    items.push({
      id: 'condition',
      label: t('addOffer.validation.step1.condition.label'),
      ok: !!draft?.condition,
      action: t('addOffer.validation.step1.condition.action'),
    });
  }
  return items;
}

function getStep2Requirements(draft: any): AddOfferRequirement[] {
  const pres = getDraftLocationPresentation({
    city: String(draft?.city ?? ''),
    district: String(draft?.district ?? ''),
    localityCountry: String(draft?.localityCountry ?? ''),
    localityCountryCode: String(draft?.localityCountryCode ?? ''),
  });
  const isPoland = pres.countryIso === 'PL';
  const locality = String(pres.district || '').trim();
  const hasLocality = locality.length > 0 && locality !== 'Ogólna';
  const street = String(draft?.street || '').trim();
  const hasCoords = hasValidMapCoordinates(draft?.lat, draft?.lng);
  const hasIntlLocation =
    hasLocality || (hasCoords && street.length >= ADD_OFFER_STREET_MIN);

  const items: AddOfferRequirement[] = [
    {
      id: 'map',
      label: t('addOffer.validation.step2.map.label'),
      ok: hasCoords,
      action: t('addOffer.validation.step2.map.action'),
    },
    {
      id: 'locality',
      label: t('addOffer.validation.step2.locality.label'),
      ok: isPoland ? hasLocality : hasIntlLocation,
      action: isPoland
        ? t('addOffer.validation.step2.locality.actionPl')
        : t('addOffer.validation.step2.locality.actionIntl'),
    },
  ];

  if (isPoland) {
    const needsStreetNumber = resolveIsExactLocation(
      draft?.isExactLocation ?? defaultExactLocationForPropertyType(draft?.propertyType),
    );
    items.push({
      id: 'street',
      label: needsStreetNumber
        ? t('addOffer.validation.step2.street.label')
        : t('addOffer.validation.step2.streetApprox.label'),
      ok: street.length >= ADD_OFFER_STREET_MIN && (needsStreetNumber ? /\d/.test(street) : true),
      action: needsStreetNumber
        ? t('addOffer.validation.step2.street.action', { min: ADD_OFFER_STREET_MIN })
        : t('addOffer.validation.step2.streetApprox.action', { min: ADD_OFFER_STREET_MIN }),
      meter: requirementMeter(street.length, ADD_OFFER_STREET_MIN, 'chars'),
    });
  } else {
    items.push({
      id: 'street',
      label: t('addOffer.validation.step2.streetIntl.label'),
      ok: hasIntlLocation,
      action: t('addOffer.validation.step2.streetIntl.action'),
      meter: street.length > 0 ? requirementMeter(street.length, ADD_OFFER_STREET_MIN, 'chars') : undefined,
    });
  }

  return items;
}

function getStep3Requirements(draft: any): AddOfferRequirement[] {
  const isPlot = String(draft?.propertyType || '') === 'PLOT';
  const areaNum = parseFloat(String(draft?.area || '').replace(',', '.'));
  const hasArea = Number.isFinite(areaNum) && areaNum > 0;

  if (isPlot) {
    return [
      {
        id: 'area',
        label: t('addOffer.validation.step3.plotArea.label'),
        ok: hasArea,
        action: t('addOffer.validation.step3.plotArea.action'),
        meter: requirementMeter(hasArea ? Math.round(areaNum) : 0, 1, 'sqm'),
      },
    ];
  }

  const yearRaw = draft?.yearBuilt ?? draft?.buildYear;
  const hasYear = !!String(yearRaw ?? '').trim();
  const needsFloor = String(draft?.propertyType || '') !== 'HOUSE';
  const isHouse = String(draft?.propertyType || '') === 'HOUSE';
  const plotAreaNum = parseFloat(String(draft?.plotArea || '').replace(',', '.'));
  const hasPlotArea =
    !String(draft?.plotArea || '').trim() ||
    (Number.isFinite(plotAreaNum) && plotAreaNum > 0);

  const items = [
    {
      id: 'area',
      label: t('addOffer.validation.step3.area.label'),
      ok: hasArea,
      action: t('addOffer.validation.step3.area.action'),
      meter: requirementMeter(hasArea ? Math.round(areaNum) : 0, 1, 'sqm'),
    },
    {
      id: 'rooms',
      label: t('addOffer.validation.step3.rooms.label'),
      ok: hasArea && !!draft?.rooms,
      action: hasArea
        ? t('addOffer.validation.step3.rooms.action')
        : t('addOffer.validation.step3.rooms.actionNeedArea'),
    },
    {
      id: 'floor',
      label: t('addOffer.validation.step3.floor.label'),
      ok: !needsFloor || (hasArea && !!draft?.rooms && !!String(draft?.floor ?? '').trim()),
      action: !hasArea
        ? t('addOffer.validation.step3.floor.actionNeedArea')
        : !draft?.rooms
          ? t('addOffer.validation.step3.floor.actionNeedRooms')
          : t('addOffer.validation.step3.floor.action'),
    },
    {
      id: 'year',
      label: t('addOffer.validation.step3.year.label'),
      ok:
        hasArea &&
        !!draft?.rooms &&
        (!needsFloor || !!String(draft?.floor ?? '').trim()) &&
        hasYear,
      action: t('addOffer.validation.step3.year.action'),
    },
  ];

  if (isHouse) {
    items.push({
      id: 'plotArea',
      label: t('addOffer.validation.step3.housePlotArea.label'),
      ok: hasPlotArea,
      action: t('addOffer.validation.step3.housePlotArea.action'),
    });
  }

  return items;
}

function getStep4Requirements(draft: any): AddOfferRequirement[] {
  const isRent = String(draft?.transactionType || '') === 'RENT';
  const priceOk = isTruthyNumber(draft?.price);
  const priceNum = Number(String(draft?.price || '').replace(/\s/g, '')) || 0;

  return [
    {
      id: 'price',
      label: isRent
        ? t('addOffer.validation.step4.priceRent.label')
        : t('addOffer.validation.step4.priceSell.label'),
      ok: priceOk,
      action: isRent
        ? t('addOffer.validation.step4.priceRent.action')
        : t('addOffer.validation.step4.priceSell.action'),
      meter: requirementMeter(priceOk ? priceNum : 0, 1, 'pln'),
    },
  ];
}

function getStep5Requirements(draft: any): AddOfferRequirement[] {
  const imageCount = Array.isArray(draft?.images) ? draft.images.length : 0;
  const titleLen = trimLen(draft?.title);
  const descLen = trimLen(draft?.description);

  const titleRemaining = ADD_OFFER_TITLE_MIN - titleLen;
  return [
    {
      id: 'photos',
      label: t('addOffer.validation.step5.photos.label'),
      ok: imageCount >= ADD_OFFER_MIN_IMAGES,
      action: t('addOffer.validation.step5.photos.action', { min: ADD_OFFER_MIN_IMAGES }),
      meter: requirementMeter(imageCount, ADD_OFFER_MIN_IMAGES, 'photos', 20),
    },
    {
      id: 'title',
      label: t('addOffer.validation.step5.title.label'),
      ok: titleLen >= ADD_OFFER_TITLE_MIN && titleLen <= ADD_OFFER_TITLE_MAX,
      action:
        titleLen < ADD_OFFER_TITLE_MIN
          ? t('addOffer.validation.step5.title.actionShort', {
              count: titleRemaining,
              unit: charsRemainingLabel(titleRemaining),
            })
          : t('addOffer.validation.step5.title.actionLong', { max: ADD_OFFER_TITLE_MAX }),
      meter: requirementMeter(titleLen, ADD_OFFER_TITLE_MIN, 'chars', ADD_OFFER_TITLE_MAX),
    },
    {
      id: 'description',
      label: t('addOffer.validation.step5.description.label'),
      ok: descLen >= ADD_OFFER_DESC_MIN,
      action: t('addOffer.validation.step5.description.action', { min: ADD_OFFER_DESC_MIN }),
      meter: requirementMeter(descLen, ADD_OFFER_DESC_MIN, 'chars', ADD_OFFER_DESC_MAX),
    },
  ];
}

export const isStepValid = (step: number, draft: any) => {
  const reqs = getStepRequirements(step, draft);
  if (step >= 1 && step <= 5) {
    return reqs.filter((r) => r.id !== 'description').every((r) => r.ok);
  }
  return true;
};

export const getStepBlockMessage = (step: number, draft?: unknown) => {
  const reqs = getStepRequirements(step, (draft as any) || {});
  const pending = reqs.filter((r) => !r.ok && r.id !== 'description');
  if (pending.length === 0) {
    return t('addOffer.stepBlockDefault');
  }
  if (pending.length === 1) {
    return pending[0].action;
  }
  const labels = pending.map((r) => r.label.toLowerCase()).join(', ');
  return t('addOffer.stepBlockPrefix', { fields: labels });
};

/** Tekst licznika pod polem (np. „7 / 10 min.”). */
export function formatCharMeter(
  current: number,
  min?: number,
  max?: number,
  unit: MeterUnitKey = 'chars',
) {
  const unitLabel = meterUnitLabel(unit);
  if (max != null) {
    return t('addOffer.meter.ofMax', { current, max, unit: unitLabel });
  }
  if (min != null) {
    return t('addOffer.meter.ofMin', { current, min, unit: unitLabel });
  }
  return t('addOffer.meter.count', { current, unit: unitLabel });
}

export function meterTone(
  current: number,
  min?: number,
  max?: number,
): 'neutral' | 'warn' | 'ok' | 'danger' {
  if (max != null && current > max) return 'danger';
  if (min != null && current > 0 && current < min) return 'warn';
  if (min != null && current >= min && (max == null || current <= max)) return 'ok';
  if (min == null && max != null && current <= max) return current > 0 ? 'ok' : 'neutral';
  return current > 0 ? 'ok' : 'neutral';
}
