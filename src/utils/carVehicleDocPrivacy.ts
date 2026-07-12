export const VEHICLE_DOC_VISIBLE_CHARS = 2;

export function maskRestrictedVehicleValue(value: string, visibleChars = VEHICLE_DOC_VISIBLE_CHARS): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= visibleChars) return raw;
  return raw.slice(0, visibleChars) + '*'.repeat(raw.length - visibleChars);
}

function secretVariants(value: string): string[] {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const variants = new Set<string>([raw]);
  const compact = raw.replace(/\s+/g, '');
  if (compact) variants.add(compact);
  return [...variants].filter((item) => item.length > VEHICLE_DOC_VISIBLE_CHARS);
}

const SENSITIVE_ROW_LABELS = /vin|numer rejestr|rejestrac|tablic|pierwsz(a|ej) rejestrac/i;

export function maskVehicleHistoryReport<
  T extends {
    vin?: string;
    registrationNumber?: string;
    firstRegistrationDate?: string;
    summary?: string;
    sections?: { title: string; rows: { label: string; value: string }[] }[];
  },
>(report: T, secrets: { vin?: string; registrationNumber?: string; firstRegistrationDate?: string }): T {
  const maskText = (text: string) => {
    let result = String(text || '');
    for (const secret of [
      ...secretVariants(secrets.vin || ''),
      ...secretVariants(secrets.registrationNumber || ''),
      ...secretVariants(secrets.firstRegistrationDate || ''),
    ]) {
      const masked = maskRestrictedVehicleValue(secret);
      if (result.includes(secret)) result = result.split(secret).join(masked);
    }
    return result;
  };

  return {
    ...report,
    vin: maskRestrictedVehicleValue(secrets.vin || report.vin || ''),
    registrationNumber: maskRestrictedVehicleValue(secrets.registrationNumber || report.registrationNumber || ''),
    firstRegistrationDate: maskRestrictedVehicleValue(
      secrets.firstRegistrationDate || report.firstRegistrationDate || '',
    ),
    summary: report.summary ? maskText(report.summary) : report.summary,
    sections: report.sections?.map((section) => ({
      ...section,
      rows: section.rows.map((row) => ({
        ...row,
        value: SENSITIVE_ROW_LABELS.test(row.label)
          ? maskRestrictedVehicleValue(row.value)
          : maskText(row.value),
      })),
    })),
  };
}
