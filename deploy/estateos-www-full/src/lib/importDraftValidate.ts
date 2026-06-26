import type { OtodomImportDraft } from '@/lib/otodomImport';
import { isNonCityLabel, isStrictCity } from '@/lib/location/locationCatalog';
import { locationNamesEquivalent } from '@/lib/location/locationNameMatch';
import { resolveCityAtCoordinates } from '@/lib/offerGeolocationValidate';

export type ImportDraftIssue = {
  field: string;
  kind: 'missing' | 'invalid';
  message: string;
};

export class ImportDraftValidationError extends Error {
  readonly code = 'NEEDS_USER_INPUT';
  readonly issues: ImportDraftIssue[];

  constructor(issues: ImportDraftIssue[]) {
    super(issues.map((i) => i.message).join(' '));
    this.name = 'ImportDraftValidationError';
    this.issues = issues;
  }
}

export function collectOtodomImportDraftIssues(draft: OtodomImportDraft): ImportDraftIssue[] {
  const issues: ImportDraftIssue[] = [];

  if (draft.lat == null || draft.lng == null || !Number.isFinite(Number(draft.lat)) || !Number.isFinite(Number(draft.lng))) {
    issues.push({
      field: 'coords',
      kind: 'missing',
      message: 'Brak współrzędnych GPS — import nie ma pinezki na mapie.',
    });
  }

  if (!String(draft.title || '').trim()) {
    issues.push({ field: 'title', kind: 'missing', message: 'Brak tytułu ogłoszenia.' });
  }

  if (draft.price == null || Number(draft.price) <= 0) {
    issues.push({ field: 'price', kind: 'missing', message: 'Podaj cenę oferty.' });
  }

  if (draft.area == null || Number(draft.area) <= 0) {
    issues.push({ field: 'area', kind: 'missing', message: 'Podaj metraż (m²).' });
  }

  const city = String(draft.city || '').trim();
  const district = String(draft.district || draft.neighborhood || '').trim();
  if (city && isNonCityLabel(city)) {
    issues.push({
      field: 'city',
      kind: 'invalid',
      message: 'Nie udało się odczytać miejscowości z ogłoszenia — podaj miasto ręcznie.',
    });
  } else if (!city && !district) {
    issues.push({
      field: 'city',
      kind: 'missing',
      message: 'Podaj miejscowość (miasto lub wieś).',
    });
  }

  return issues;
}

export async function collectOtodomImportLocationIssues(draft: OtodomImportDraft): Promise<ImportDraftIssue[]> {
  const issues: ImportDraftIssue[] = [];
  const city = String(draft.city || '').trim();
  if (!city || isNonCityLabel(city)) return issues;
  if (draft.lat == null || draft.lng == null) return issues;

  const resolved = await resolveCityAtCoordinates(draft.lat, draft.lng);
  if (!resolved || locationNamesEquivalent(resolved, city)) return issues;

  if (isStrictCity(city)) return issues;

  issues.push({
    field: 'city',
    kind: 'invalid',
    message: `Pinezka na mapie wskazuje ${resolved}, a import podał ${city}. Popraw miejscowość poniżej.`,
  });
  return issues;
}

export function assertOtodomImportDraftReady(draft: OtodomImportDraft): void {
  const issues = collectOtodomImportDraftIssues(draft);
  if (issues.length > 0) {
    throw new ImportDraftValidationError(issues);
  }
}

/** Mapuje komunikat błędu tworzenia oferty na pole do uzupełnienia w aplikacji. */
export function issuesFromCreateErrorMessage(message: string): ImportDraftIssue[] {
  const text = String(message || '').trim();
  if (!text) return [];

  if (/metra/i.test(text)) {
    return [{ field: 'area', kind: 'missing', message: text }];
  }
  if (/cen/i.test(text)) {
    return [{ field: 'price', kind: 'missing', message: text }];
  }
  if (/współrzędn|gps|pinezk/i.test(text)) {
    return [{ field: 'coords', kind: 'missing', message: text }];
  }
  if (/miast|miejscow|lokalizac/i.test(text)) {
    return [{ field: 'city', kind: 'missing', message: text }];
  }
  return [{ field: 'general', kind: 'invalid', message: text }];
}
