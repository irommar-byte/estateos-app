export function parseGroupedNumber(val: string | number | null | undefined): number {
  const raw = String(val ?? '')
    .replace(/\u00a0/g, '')
    .replace(/\s/g, '')
    .replace(/zł/gi, '')
    .replace(',', '.');
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

export function formatCurrencyPLN(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : parseGroupedNumber(val);
  if (!Number.isFinite(num) || num === 0) return '';
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(num) + ' zł';
}

/** Formatuje kwotę podczas wpisywania: `450000` → `450 000`. */
export function formatPriceInput(val: string): string {
  const digits = String(val || '').replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(Number(digits));
}

export function formatPhoneNumber(val: string): string {
  const digits = val.replace(/\D/g, '');
  if (!digits) return val;
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('48')) {
    return `+48 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return val;
}
