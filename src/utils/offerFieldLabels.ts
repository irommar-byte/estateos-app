/**
 * Mapowanie surowych wartości z API / bazy na klucze i18n — bez wycieku ENUMów w UI.
 */

export type OfferConditionSegment = 'READY' | 'DEVELOPER' | 'TO_RENOVATION';

export type OfferConditionKey =
  | OfferConditionSegment
  | 'NEW'
  | 'VERY_GOOD'
  | 'GOOD'
  | 'RENOVATION';

const CONDITION_ALIASES: Record<string, OfferConditionKey> = {
  DEVELOPER_STATE: 'DEVELOPER',
  DEVELOPER_FINISH: 'DEVELOPER',
  DEVELOPER_STANDARD: 'DEVELOPER',
  DEVELOPERS_STATE: 'DEVELOPER',
  DEVELOPERS_FINISH: 'DEVELOPER',
  MOVE_IN_READY: 'READY',
  MOVE_IN: 'READY',
  FINISHED: 'READY',
  RENOVATION: 'TO_RENOVATION',
  TO_RENOVATE: 'TO_RENOVATION',
  NEEDS_RENOVATION: 'TO_RENOVATION',
  FOR_RENOVATION: 'TO_RENOVATION',
  VERY_GOOD: 'VERY_GOOD',
  VERYGOOD: 'VERY_GOOD',
};

const KNOWN_CONDITIONS = new Set<string>([
  'READY',
  'DEVELOPER',
  'TO_RENOVATION',
  'NEW',
  'VERY_GOOD',
  'GOOD',
  'RENOVATION',
]);

/** Normalizuje `condition` z API do kanonicznego klucza i18n. */
export function normalizeOfferCondition(raw: unknown): OfferConditionKey | null {
  const normalized = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!normalized) return null;
  if (CONDITION_ALIASES[normalized]) return CONDITION_ALIASES[normalized];
  if (KNOWN_CONDITIONS.has(normalized)) {
    return normalized === 'RENOVATION' ? 'TO_RENOVATION' : (normalized as OfferConditionKey);
  }
  return null;
}

/** Wartość do zapisu w formularzu edycji (3 segmenty). */
export function normalizeOfferConditionForEdit(
  raw: unknown,
): OfferConditionSegment | null {
  const key = normalizeOfferCondition(raw);
  if (key === 'READY' || key === 'DEVELOPER' || key === 'TO_RENOVATION') return key;
  if (key === 'NEW' || key === 'VERY_GOOD' || key === 'GOOD') return 'READY';
  return null;
}

export function formatOfferConditionLabel(
  raw: unknown,
  translate: (key: string) => string,
  options?: { empty?: string },
): string {
  const empty = options?.empty ?? translate('offer.shared.noData');
  const key = normalizeOfferCondition(raw);
  if (!key) {
    const leftover = String(raw ?? '').trim();
    return leftover ? empty : empty;
  }

  const segmentKeys: OfferConditionSegment[] = ['READY', 'DEVELOPER', 'TO_RENOVATION'];
  if (segmentKeys.includes(key as OfferConditionSegment)) {
    const segI18n = `offer.shared.conditionSegments.${key}`;
    const segLabel = translate(segI18n);
    if (segLabel !== segI18n) return segLabel;
  }

  const condI18n = `offer.shared.conditions.${key}`;
  const condLabel = translate(condI18n);
  if (condLabel !== condI18n) return condLabel;

  return empty;
}

const PROPERTY_TYPE_ALIASES: Record<string, 'FLAT' | 'HOUSE' | 'PLOT' | 'PREMISES'> = {
  APARTMENT: 'FLAT',
  FLAT: 'FLAT',
  STUDIO: 'FLAT',
  HOUSE: 'HOUSE',
  PLOT: 'PLOT',
  LAND: 'PLOT',
  PREMISES: 'PREMISES',
  COMMERCIAL: 'PREMISES',
  OFFICE: 'PREMISES',
  RETAIL: 'PREMISES',
};

export function normalizeOfferPropertyType(raw: unknown): keyof typeof PROPERTY_TYPE_ALIASES | null {
  const normalized = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!normalized) return null;
  return PROPERTY_TYPE_ALIASES[normalized] ?? null;
}

export function formatOfferPropertyTypeLabel(
  raw: unknown,
  translate: (key: string) => string,
  options?: { empty?: string },
): string {
  const empty = options?.empty ?? translate('offer.shared.emDash');
  const canon = normalizeOfferPropertyType(raw);
  if (!canon) return empty;
  const map: Record<string, string> = {
    FLAT: 'offer.shared.propertyTypes.flat',
    HOUSE: 'offer.shared.propertyTypes.house',
    PLOT: 'offer.shared.propertyTypes.plot',
    PREMISES: 'offer.shared.propertyTypes.premises',
  };
  const i18nKey = map[canon];
  if (!i18nKey) return empty;
  const label = translate(i18nKey);
  return label !== i18nKey ? label : empty;
}

export function formatOfferTransactionTypeLabel(
  raw: unknown,
  translate: (key: string) => string,
): string {
  const normalized = String(raw ?? '').trim().toUpperCase();
  if (normalized === 'RENT' || normalized === 'RENTAL' || normalized === 'LEASE') {
    return translate('offer.shared.transactionTypes.rent');
  }
  if (
    normalized === 'SALE' ||
    normalized === 'SELL' ||
    normalized === 'SOLD' ||
    normalized === 'BUY'
  ) {
    return translate('offer.shared.transactionTypes.sale');
  }
  return translate('offer.shared.emDash');
}

const HEATING_VALUE_TO_KEY: Record<string, string> = {
  '': 'offer.shared.heating.none',
  MIEJSKIE: 'offer.shared.heating.district',
  GAZOWE: 'offer.shared.heating.gas',
  ELEKTRYCZNE: 'offer.shared.heating.electric',
  'POMPA CIEPŁA': 'offer.shared.heating.heatPump',
  'POMPA CIEPLA': 'offer.shared.heating.heatPump',
  'WĘGLOWE/PELLET': 'offer.shared.heating.coalPellet',
  'WEGELOWE/PELLET': 'offer.shared.heating.coalPellet',
  INNE: 'offer.shared.heating.other',
  DISTRICT: 'offer.shared.heating.district',
  CITY: 'offer.shared.heating.district',
  CENTRAL: 'offer.shared.heating.district',
  GAS: 'offer.shared.heating.gas',
  ELECTRIC: 'offer.shared.heating.electric',
  ELECTRICAL: 'offer.shared.heating.electric',
  HEAT_PUMP: 'offer.shared.heating.heatPump',
  HEATPUMP: 'offer.shared.heating.heatPump',
  COAL: 'offer.shared.heating.coalPellet',
  PELLET: 'offer.shared.heating.coalPellet',
  COAL_PELLET: 'offer.shared.heating.coalPellet',
  OTHER: 'offer.shared.heating.other',
  NONE: 'offer.shared.heating.none',
};

export function formatOfferHeatingLabel(
  raw: unknown,
  translate: (key: string) => string,
): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const lookup = HEATING_VALUE_TO_KEY[value] ?? HEATING_VALUE_TO_KEY[value.toUpperCase()];
  if (lookup) {
    const label = translate(lookup);
    return label !== lookup ? label : translate('offer.shared.heating.other');
  }
  if (/^[A-Z0-9_]+$/.test(value)) {
    return translate('offer.shared.notProvided');
  }
  return value;
}
