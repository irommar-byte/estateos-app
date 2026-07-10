import type { CatalogOption } from '../services/carCatalogApi';

function parseYearRange(label: string) {
  const match = /\((\d{4})\s*-\s*(\d{4}|)\)/.exec(label);
  if (!match) return null;
  const from = Number(match[1]);
  const to = match[2] ? Number(match[2]) : null;
  if (!Number.isFinite(from)) return null;
  return { from, to: Number.isFinite(to) ? to : null };
}

export function pickGenerationForYear(
  options: CatalogOption[],
  year: string | number,
  typeCode?: string,
): CatalogOption | null {
  if (!options.length) return null;
  const numericYear = Number(year);
  if (!Number.isFinite(numericYear) || numericYear <= 0) return null;

  const code = String(typeCode || '').trim().toUpperCase();
  if (code) {
    const byCode = options.find(
      (option) =>
        option.label.toUpperCase().includes(code) ||
        option.value.toUpperCase().includes(code.replace(/[^A-Z0-9]/g, '')),
    );
    if (byCode) return byCode;
  }

  const matches = options
    .map((option) => ({ option, range: parseYearRange(option.label) }))
    .filter((entry) => entry.range && numericYear >= entry.range.from && (entry.range.to === null || numericYear <= entry.range.to));

  if (!matches.length) return null;
  if (matches.length === 1) return matches[0].option;

  return matches
    .sort((a, b) => {
      const spanA = (a.range!.to ?? 9999) - a.range!.from;
      const spanB = (b.range!.to ?? 9999) - b.range!.from;
      return spanA - spanB;
    })[0].option;
}

export function defaultDoorCountForBody(bodyType: string) {
  const normalized = bodyType.trim().toLowerCase();
  if (normalized.includes('coupe') || normalized.includes('coupé') || normalized.includes('kabrio')) return '2';
  if (normalized.includes('hatchback') || normalized.includes('kombi') || normalized.includes('suv') || normalized.includes('van')) {
    return '5';
  }
  return '4';
}

export function pickDoorCountOption(options: CatalogOption[], bodyType: string, seatCount?: string | number) {
  if (!options.length) return null;
  const preferred = defaultDoorCountForBody(bodyType);
  const seats = Number(seatCount);
  if (Number.isFinite(seats) && seats > 0 && seats <= 2) return options.find((o) => o.label === '2') || options[0];

  return (
    options.find((option) => option.label === preferred) ||
    options.find((option) => option.value === preferred) ||
    options[0]
  );
}
