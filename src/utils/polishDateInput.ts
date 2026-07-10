export function formatPolishDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export function isCompletePolishDate(value: string): boolean {
  return /^\d{2}\.\d{2}\.\d{4}$/.test(value.trim());
}

/** Zapis z API (ISO lub PL) → DD.MM.RRRR do pól formularza. */
export function formatDateForForm(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) return trimmed;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return trimmed;
}
