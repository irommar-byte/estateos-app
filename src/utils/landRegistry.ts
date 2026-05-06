export type LandRegistryCourtPrefix = {
  prefix: string;
  courtName: string;
};

const LAND_REGISTRY_PREFIX_DATA: LandRegistryCourtPrefix[] = [
  // Warszawa - komplet najczęściej spotykanych prefiksów (legacy + aktualne)
  { prefix: 'WA1M', courtName: 'Warszawa-Mokotów (historyczny wydział KW)' },
  { prefix: 'WA2M', courtName: 'Warszawa-Śródmieście / Mokotów (historyczny wydział KW)' },
  { prefix: 'WA3M', courtName: 'Warszawa-Wola (historyczny wydział KW)' },
  { prefix: 'WA4M', courtName: 'Warszawa-Praga / Mokotów (historyczny wydział KW)' },
  { prefix: 'WA5M', courtName: 'Warszawa (historyczny wydział KW)' },
  { prefix: 'WA6M', courtName: 'SR dla Warszawy-Mokotowa - VI Wydział Ksiąg Wieczystych' },
  { prefix: 'WA1G', courtName: 'SR dla Warszawy-Żoliborza (historyczny wydział KW)' },
  { prefix: 'WA2G', courtName: 'SR dla Warszawy-Żoliborza (historyczny wydział KW)' },
  { prefix: 'WA3G', courtName: 'SR dla Warszawy-Żoliborza (historyczny wydział KW)' },
  { prefix: 'WA4G', courtName: 'SR dla Warszawy-Żoliborza (historyczny wydział KW)' },
  { prefix: 'WA5G', courtName: 'SR dla Warszawy-Żoliborza (historyczny wydział KW)' },
  { prefix: 'WA6G', courtName: 'SR dla Warszawy-Żoliborza (historyczny wydział KW)' },
  { prefix: 'KR1P', courtName: 'SR dla Krakowa-Podgórza w Krakowie' },
  { prefix: 'KR1K', courtName: 'SR dla Krakowa-Krowodrzy w Krakowie' },
  { prefix: 'KR1C', courtName: 'SR dla Krakowa-Śródmieścia w Krakowie' },
  { prefix: 'PO1P', courtName: 'SR Poznań-Stare Miasto w Poznaniu' },
  { prefix: 'PO2P', courtName: 'SR Poznań-Nowe Miasto i Wilda w Poznaniu' },
  { prefix: 'GD1G', courtName: 'SR Gdańsk-Północ w Gdańsku' },
  { prefix: 'GD1Y', courtName: 'SR Gdańsk-Północ w Gdańsku' },
  { prefix: 'GD1W', courtName: 'SR Gdańsk-Północ w Gdańsku' },
  { prefix: 'WR1K', courtName: 'SR dla Wrocławia-Krzyków we Wrocławiu' },
  { prefix: 'WR1W', courtName: 'SR dla Wrocławia-Fabrycznej we Wrocławiu' },
  { prefix: 'WR1S', courtName: 'SR dla Wrocławia-Śródmieścia we Wrocławiu' },
  { prefix: 'LU1I', courtName: 'SR Lublin-Zachód w Lublinie' },
  { prefix: 'LU1M', courtName: 'SR Lublin-Zachód w Lublinie' },
  { prefix: 'SZ1S', courtName: 'SR Szczecin-Prawobrzeże i Zachód w Szczecinie' },
  { prefix: 'RZ1Z', courtName: 'SR w Rzeszowie' },
  { prefix: 'BI1B', courtName: 'SR w Białymstoku' },
  { prefix: 'KI1L', courtName: 'SR w Kielcach' },
  { prefix: 'LD1M', courtName: 'SR dla Łodzi-Śródmieścia w Łodzi' },
  { prefix: 'LD1P', courtName: 'SR dla Łodzi-Widzewa w Łodzi' },
];

export const LAND_REGISTRY_REGEX = /^[A-Z]{2}[0-9A-Z]{2}\/[0-9]{8}\/[0-9]$/;

export function normalizeLandRegistryNumber(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9/]/g, '')
    .replace(/\/{2,}/g, '/');
}

export function isValidLandRegistryNumber(value: string): boolean {
  const v = String(value || '').trim();
  if (!v) return true;
  return LAND_REGISTRY_REGEX.test(v);
}

export function getLandRegistryPrefixInput(value: string): string {
  const normalized = normalizeLandRegistryNumber(value);
  const token = normalized.split('/')[0] || '';
  return token.slice(0, 4);
}

export function getLandRegistryPrefixSuggestions(value: string, limit = 12): LandRegistryCourtPrefix[] {
  const token = getLandRegistryPrefixInput(value);
  if (!token) return [];
  return LAND_REGISTRY_PREFIX_DATA.filter((item) => item.prefix.startsWith(token)).slice(0, limit);
}

export function applyLandRegistryPrefix(currentValue: string, prefix: string): string {
  const normalized = normalizeLandRegistryNumber(currentValue);
  const parts = normalized.split('/');
  const afterPrefix = parts.length > 1 ? parts.slice(1).join('/') : '';
  return afterPrefix ? `${prefix}/${afterPrefix}` : `${prefix}/`;
}

export function getCourtByLandRegistryPrefix(value: string): LandRegistryCourtPrefix | null {
  const prefix = getLandRegistryPrefixInput(value);
  if (!prefix || prefix.length < 4) return null;
  return LAND_REGISTRY_PREFIX_DATA.find((item) => item.prefix === prefix) || null;
}
