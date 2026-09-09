export function toPortalSyncStamp(value: Date | string | null | undefined): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }
  return '';
}

export function buildPortalSyncVersion(
  values: Array<Date | string | null | undefined>,
): string {
  return values.map(toPortalSyncStamp).filter(Boolean).join('|');
}
