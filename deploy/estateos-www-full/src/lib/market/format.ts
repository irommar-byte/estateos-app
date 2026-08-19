export function formatPln(n: number) {
  return `${Math.round(n).toLocaleString('pl-PL')} zł`;
}

export function formatPpsm(n: number) {
  return `${Math.round(n).toLocaleString('pl-PL')} zł/m²`;
}

export function parseLooseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
