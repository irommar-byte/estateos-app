const WARSZAWA_NEIGHBORHOOD_DISTRICT: Array<[string, string]> = [
  ['nowodwory', 'Białołęka'],
  ['tarchomin', 'Białołęka'],
  ['zeran', 'Białołęka'],
  ['choszczowka', 'Białołęka'],
  ['henrykow', 'Białołęka'],
  ['marymont', 'Bielany'],
  ['mlociny', 'Bielany'],
  ['wawrzyszew', 'Bielany'],
  ['chomiczowka', 'Bielany'],
  ['zacisze', 'Targówek'],
  ['brodno', 'Targówek'],
];

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function resolveWarsawDistrictFromText(district?: string | null, title?: string | null, street?: string | null): string {
  const blob = [title, street, district].filter(Boolean).join(' · ');
  const normalized = normalizeToken(blob);
  for (const [needle, mapped] of WARSZAWA_NEIGHBORHOOD_DISTRICT) {
    const re = new RegExp(`(?:^|[^a-z0-9])${needle}(?:$|[^a-z0-9])`);
    if (re.test(normalized)) return mapped;
  }
  return String(district || '').trim();
}
