export function formatCurrencyPLN(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : Number(String(val).replace(/\s/g, '').replace(',', '.'));
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(num) + ' zł';
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
