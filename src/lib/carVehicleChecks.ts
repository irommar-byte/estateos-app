import {
  CepikHistoriaPojazduError,
  queryCepikInsurance,
  queryCepikVehicle,
  type CepikVehicleQuery,
} from '@/lib/cepikHistoriaPojazduClient';

export type VehicleHistoryRequest = {
  vin: string;
  registrationNumber: string;
  firstRegistrationDate: string;
};

export type VehicleHistorySection = {
  title: string;
  rows: { label: string; value: string }[];
};

export type VehicleHistoryReport = {
  vin: string;
  registrationNumber: string;
  firstRegistrationDate: string;
  summary: string;
  sections: VehicleHistorySection[];
  checkedAt: string;
  source: 'CEPIK';
};

export type InsuranceCheckRequest = {
  registrationNumber: string;
  insuranceValidUntil?: string;
  vin?: string;
  firstRegistrationDate?: string;
  checkDate?: string;
};

export type InsuranceCheckResult = {
  hasInsurance: boolean;
  message: string;
  validUntil?: string | null;
  insurer?: string | null;
  policyNumber?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  checkedAt: string;
  source: 'CEPIK' | 'UFG' | 'CEPIK_FALLBACK';
};

const LABELS: Record<string, string> = {
  make: 'Marka',
  model: 'Model',
  type: 'Typ',
  variant: 'Wariant',
  version: 'Wersja',
  yearOfManufacture: 'Rok produkcji',
  engineCapacity: 'Pojemność silnika',
  enginePower: 'Moc silnika',
  fuelType: 'Rodzaj paliwa',
  vehicleCategory: 'Kategoria pojazdu',
  registrationStatus: 'Status rejestracji',
  registrationProvince: 'Województwo rejestracji',
  totalOwners: 'Liczba właścicieli',
  firstRegistrationDate: 'Data pierwszej rejestracji',
  odometerValue: 'Stan licznika',
  odometerUnit: 'Jednostka licznika',
  rolledBack: 'Cofnięty licznik',
  stolen: 'Kradzież',
  postAccident: 'Pojazd powypadkowy',
  odometerTampering: 'Manipulacja licznikiem',
  taxi: 'Taxi',
  insurerName: 'Ubezpieczyciel',
  insuranceCompany: 'Ubezpieczyciel',
  policyNumber: 'Numer polisy',
  insuranceValidUntil: 'Ważność OC',
  insuranceExpiryDate: 'Ważność OC',
  validOcInsurance: 'Ważne OC',
  hasCurrentOCPolicy: 'Ważne OC',
  ocValidUntil: 'Ważność OC',
  liabilityInsuranceValidUntil: 'Ważność OC',
  mandatoryInsuranceStatus: 'Status OC',
  hasValidInsurance: 'Ważne OC',
};

function normalizeVin(raw: string) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-HJ-NPR-Z0-9]/g, '');
}

function normalizePlate(raw: string) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function plateForCepik(plate: string) {
  return plate.replace(/\s+/g, '');
}

/** 17 znaków bez I/O/Q — CEPIK weryfikuje VIN po swojej stronie. */
function isValidVinFormat(vin: string) {
  const normalized = normalizeVin(vin);
  return normalized.length === 17 && !/[IOQ]/.test(normalized);
}

function hasCompleteVehicleDocs(input: {
  vin?: string;
  registrationNumber?: string;
  firstRegistrationDate?: string;
}) {
  const vin = normalizeVin(input.vin || '');
  const plate = normalizePlate(input.registrationNumber || '');
  const firstReg = parseIsoDate(String(input.firstRegistrationDate || ''));
  return isValidVinFormat(vin) && isValidPolishPlate(plate) && firstReg != null;
}

function isValidPolishPlate(plate: string) {
  const compact = plate.replace(/\s/g, '');
  return /^[A-Z]{2,3}[A-Z0-9]{4,5}$/.test(compact) || /^[A-Z]{2}[0-9]{5}$/.test(compact);
}

function parseIsoDate(raw: string): Date | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const pl = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  if (iso) {
    const d = new Date(`${trimmed}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (pl) {
    const d = new Date(`${pl[3]}-${pl[2]}-${pl[1]}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatDateForCepik(raw: string): string {
  const parsed = parseIsoDate(raw);
  if (!parsed) {
    throw new Error('Podaj datę pierwszej rejestracji (RRRR-MM-DD lub DD.MM.RRRR).');
  }
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(raw: string) {
  const parsed = parseIsoDate(raw);
  if (!parsed) return raw;
  const d = String(parsed.getDate()).padStart(2, '0');
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${parsed.getFullYear()}`;
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map((item) => formatValue(item)).join(', ');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('value' in obj) {
      const unit = obj.unit ? ` ${obj.unit}` : '';
      const rolled = obj.rolledBack ? ' (możliwe cofnięcie licznika!)' : '';
      return `${formatValue(obj.value)}${unit}${rolled}`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function labelForKey(key: string) {
  return LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function objectToRows(obj: Record<string, unknown>, skipKeys: string[] = []) {
  return Object.entries(obj)
    .filter(([key, value]) => !skipKeys.includes(key) && value != null && value !== '')
    .map(([key, value]) => ({
      label: labelForKey(key),
      value: formatValue(value),
    }));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function buildTechnicalSections(vehicleData: Record<string, unknown> | null | undefined): VehicleHistorySection[] {
  if (!vehicleData) return [];
  const sections: VehicleHistorySection[] = [];
  const technical = asRecord(vehicleData.technicalData) || vehicleData;
  const basic = asRecord(technical.basicData) || technical;

  const basicRows = objectToRows(basic, ['odometerReadings']);
  if (basicRows.length) {
    sections.push({ title: 'Dane pojazdu (CEPIK)', rows: basicRows });
  }

  const readings = Array.isArray(basic.odometerReadings) ? basic.odometerReadings : [];
  if (readings.length) {
    sections.push({
      title: 'Odczyty licznika',
      rows: readings.slice(0, 8).map((reading, index) => {
        const row = asRecord(reading) || {};
        return {
          label: `Odczyt ${index + 1}`,
          value: formatValue(row),
        };
      }),
    });
  }

  const riskRoot = asRecord(vehicleData.carfaxData) || asRecord(technical.carfaxData);
  const risk = asRecord(riskRoot?.risk);
  if (risk) {
    sections.push({
      title: 'Analiza ryzyka',
      rows: objectToRows(risk),
    });
  }

  const insurance = extractInsuranceInfo(vehicleData);
  if (insurance.rows.length) {
    sections.push({ title: 'Ubezpieczenie OC (CEPIK/UFG)', rows: insurance.rows });
  }

  return sections;
}

function buildTimelineSection(timelineData: Record<string, unknown> | null | undefined): VehicleHistorySection | null {
  if (!timelineData) return null;
  const timeline = asRecord(timelineData.timelineData) || timelineData;
  const headerRows = objectToRows(timeline, ['events']);
  const events = Array.isArray(timeline.events) ? timeline.events : [];

  const rows = [
    ...headerRows,
    ...events.slice(0, 20).map((event, index) => {
      const row = asRecord(event) || {};
      const date = row.eventDate || row.date || row.registrationDate;
      const name = row.eventName || row.name || row.description || row.type;
      const details = [date, name].filter(Boolean).map((part) => formatValue(part)).join(' — ');
      return {
        label: `Zdarzenie ${index + 1}`,
        value: details || formatValue(row),
      };
    }),
  ];

  if (!rows.length) return null;
  return { title: 'Historia i zdarzenia', rows };
}

function readBooleanFlag(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'tak' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === 'nie' || normalized === 'no') return false;
  }
  return null;
}

function extractCepikOcFromSources(
  vehicleData: Record<string, unknown> | null | undefined,
  timelineData: Record<string, unknown> | null | undefined,
) {
  const timeline = asRecord(asRecord(timelineData)?.timelineData) || asRecord(timelineData) || {};
  const basic = asRecord(asRecord(asRecord(vehicleData)?.technicalData)?.basicData) || {};

  const validUntil = timeline.insuranceExpiryDate ?? timeline.insuranceValidUntil ?? null;
  const statusFlag =
    readBooleanFlag(timeline.validOcInsurance) ?? readBooleanFlag(basic.hasCurrentOCPolicy);

  return { validUntil, statusFlag };
}

function extractInsuranceInfo(payload: Record<string, unknown>) {
  const rows: { label: string; value: string }[] = [];
  const insurer = findNestedValue(
    payload,
    /(insurer|ubezpieczyciel|insuranceCompany|zaklad|insuranceProvider|companyName)/i,
  );
  const policy = findNestedValue(payload, /(policyNumber|numerPolisy|policyNo|numerUmowy)/i);
  const validUntil = findNestedValue(
    payload,
    /(validUntil|validTo|ocValidUntil|insuranceValidUntil|insuranceExpiryDate|koniecOchrony|endDate|expirationDate|policyEndDate|insuranceEndDate|dateTo|doDnia)/i,
  );
  const hasInsurance = findNestedValue(
    payload,
    /(hasValidInsurance|validOcInsurance|hasCurrentOCPolicy|isInsured|ocValid|ubezpieczenie|insuranceStatus|mandatoryInsurance|liabilityInsurance)/i,
  );

  if (insurer) rows.push({ label: 'Ubezpieczyciel', value: formatValue(insurer) });
  if (policy) rows.push({ label: 'Numer polisy', value: formatValue(policy) });
  if (validUntil) rows.push({ label: 'Ważność OC', value: formatDisplayDate(String(validUntil)) });
  if (hasInsurance != null && !validUntil) {
    rows.push({ label: 'Status OC', value: formatValue(hasInsurance) });
  }

  return { rows, insurer, policy, validUntil, hasInsurance };
}

function findNestedValue(node: unknown, pattern: RegExp, depth = 0): unknown {
  if (depth > 8 || node == null) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findNestedValue(item, pattern, depth + 1);
      if (found != null && found !== '') return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (pattern.test(key) && value != null && value !== '') {
      return value;
    }
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    const found = findNestedValue(value, pattern, depth + 1);
    if (found != null && found !== '') return found;
  }
  return null;
}

function buildCepikQuery(input: VehicleHistoryRequest): CepikVehicleQuery {
  const vin = normalizeVin(input.vin);
  const registrationNumber = normalizePlate(input.registrationNumber);

  if (!isValidVinFormat(vin)) {
    throw new Error('Nieprawidłowy numer VIN (wymagane 17 znaków, bez liter I, O, Q).');
  }
  if (!isValidPolishPlate(registrationNumber)) {
    throw new Error('Nieprawidłowy format numeru rejestracyjnego.');
  }

  return {
    vin,
    registrationNumber: plateForCepik(registrationNumber),
    firstRegistrationDate: formatDateForCepik(input.firstRegistrationDate),
  };
}

export async function buildVehicleHistoryReport(input: VehicleHistoryRequest): Promise<VehicleHistoryReport> {
  const query = buildCepikQuery(input);

  try {
    const { vehicleData, timelineData } = await queryCepikVehicle(query);
    const sections = buildTechnicalSections(vehicleData);
    const timelineSection = buildTimelineSection(timelineData);
    if (timelineSection) sections.push(timelineSection);

    if (!vehicleData && !timelineData) {
      throw new Error('CEPIK nie zwrócił danych historii pojazdu. Spróbuj ponownie za chwilę.');
    }

    const basic = asRecord(asRecord(vehicleData?.technicalData)?.basicData) || {};
    const make = formatValue(basic.make);
    const model = formatValue(basic.model);
    const summaryParts = [
      `Raport CEPIK Historia Pojazdu dla ${normalizePlate(input.registrationNumber)}.`,
      make !== '—' || model !== '—' ? `Pojazd: ${make} ${model}`.trim() : null,
      sections.length ? `Pobrano ${sections.length} sekcji danych rejestrowych.` : null,
    ].filter(Boolean);

    return {
      vin: query.vin,
      registrationNumber: normalizePlate(input.registrationNumber),
      firstRegistrationDate: formatDisplayDate(input.firstRegistrationDate),
      summary: summaryParts.join(' '),
      sections,
      checkedAt: new Date().toISOString(),
      source: 'CEPIK',
    };
  } catch (error) {
    if (error instanceof CepikHistoriaPojazduError) {
      throw new Error(error.message);
    }
    throw error;
  }
}

function parseInsuranceValidity(raw: unknown): Date | null {
  if (raw == null) return null;
  return parseIsoDate(String(raw));
}

function isInsuranceActive(validUntil: Date | null, checkDate: Date) {
  if (!validUntil) return null;
  return validUntil >= checkDate;
}

export async function checkVehicleInsurance(input: InsuranceCheckRequest): Promise<InsuranceCheckResult> {
  const registrationNumber = normalizePlate(input.registrationNumber);
  const vin = normalizeVin(input.vin || '');
  const checkDate = parseIsoDate(String(input.checkDate || '')) || new Date();
  checkDate.setHours(0, 0, 0, 0);
  const checkDateIso = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

  if (!isValidPolishPlate(registrationNumber)) {
    throw new Error('Podaj poprawny numer rejestracyjny (np. WW 12345).');
  }

  const docsComplete = hasCompleteVehicleDocs({
    vin,
    registrationNumber,
    firstRegistrationDate: input.firstRegistrationDate,
  });

  if (docsComplete) {
    let cepikConfirmed = false;
    try {
      const query = buildCepikQuery({
        vin,
        registrationNumber,
        firstRegistrationDate: input.firstRegistrationDate!,
      });
      const { insuranceData, vehicleData, timelineData } = await queryCepikInsurance({
        ...query,
        checkDate: checkDateIso,
      });

      cepikConfirmed = Boolean(vehicleData || timelineData || insuranceData);

      const payload = {
        ...(vehicleData || {}),
        ...(timelineData || {}),
        ...(insuranceData || {}),
      };
      const cepikOc = extractCepikOcFromSources(vehicleData, timelineData);
      const extracted = extractInsuranceInfo(payload);
      const validUntilRaw = extracted.validUntil ?? cepikOc.validUntil;
      const validUntilDate = parseInsuranceValidity(validUntilRaw);
      const activeFromDate = isInsuranceActive(validUntilDate, checkDate);
      const activeFromFlag = readBooleanFlag(extracted.hasInsurance) ?? cepikOc.statusFlag;
      const active = activeFromDate ?? activeFromFlag;

      if (active != null) {
        const validUntilDisplay = validUntilRaw ? formatDisplayDate(String(validUntilRaw)) : null;
        return {
          hasInsurance: active,
          validUntil: validUntilDisplay,
          insurer: extracted.insurer ? String(extracted.insurer) : null,
          policyNumber: extracted.policy ? String(extracted.policy) : null,
          vehicleMake: formatValue(findNestedValue(payload, /^(make|marka)$/i)) || null,
          vehicleModel: formatValue(findNestedValue(payload, /^(model)$/i)) || null,
          message: active
            ? `Pojazd ${registrationNumber} ma ważne OC${validUntilDisplay ? ` do ${validUntilDisplay}` : ' (CEPIK)'}${extracted.insurer ? ` — ${extracted.insurer}` : ''}.`
            : `Brak ważnego OC dla ${registrationNumber}${validUntilDisplay ? ` (ochrona wygasła ${validUntilDisplay})` : ' (CEPIK)'}.`,
          checkedAt: new Date().toISOString(),
          source: insuranceData ? 'UFG' : 'CEPIK',
        };
      }

      const statusText = formatValue(extracted.hasInsurance);
      if (statusText !== '—') {
        const hasInsurance = statusText.toLowerCase() === 'tak' || statusText.toLowerCase() === 'true';
        return {
          hasInsurance,
          message: hasInsurance
            ? `CEPIK: pojazd ${registrationNumber} posiada aktywne OC.`
            : `CEPIK: brak aktywnego OC dla ${registrationNumber}.`,
          checkedAt: new Date().toISOString(),
          source: insuranceData ? 'UFG' : 'CEPIK',
        };
      }

      if (vehicleData || timelineData) {
        return {
          hasInsurance: false,
          message: `Pojazd ${registrationNumber} potwierdzony w CEPIK, ale nie udało się odczytać statusu OC.`,
          checkedAt: new Date().toISOString(),
          source: 'CEPIK',
        };
      }
    } catch (error) {
      if (error instanceof CepikHistoriaPojazduError && error.code !== 'NOT_FOUND' && error.code !== 'HIPO-0002') {
        throw new Error(error.message);
      }
      if (!(error instanceof CepikHistoriaPojazduError)) {
        const message = error instanceof Error ? error.message : '';
        if (message && !message.includes('Podaj datę')) {
          throw error;
        }
      }
    }

    const validUntilRaw = String(input.insuranceValidUntil || '').trim();
    const manualValidUntil = parseIsoDate(validUntilRaw);
    if (manualValidUntil) {
      const hasInsurance = manualValidUntil >= checkDate;
      return {
        hasInsurance,
        validUntil: formatDisplayDate(validUntilRaw),
        message: hasInsurance
          ? `Na podstawie podanej daty: OC ważne do ${formatDisplayDate(validUntilRaw)}.`
          : `Na podstawie podanej daty: polisa wygasła ${formatDisplayDate(validUntilRaw)}.`,
        checkedAt: new Date().toISOString(),
        source: 'CEPIK_FALLBACK',
      };
    }

    return {
      hasInsurance: false,
      message: cepikConfirmed
        ? `Pojazd ${registrationNumber} potwierdzony w CEPIK, ale brak danych o OC w odpowiedzi.`
        : `Nie udało się zweryfikować OC w CEPIK dla ${registrationNumber}.`,
      checkedAt: new Date().toISOString(),
      source: 'CEPIK',
    };
  }

  const validUntilRaw = String(input.insuranceValidUntil || '').trim();
  const validUntil = parseIsoDate(validUntilRaw);
  if (validUntil) {
    const hasInsurance = validUntil >= checkDate;
    return {
      hasInsurance,
      validUntil: formatDisplayDate(validUntilRaw),
      message: hasInsurance
        ? `Na podstawie podanej daty: OC ważne do ${formatDisplayDate(validUntilRaw)}.`
        : `Na podstawie podanej daty: polisa wygasła ${formatDisplayDate(validUntilRaw)}.`,
      checkedAt: new Date().toISOString(),
      source: 'CEPIK_FALLBACK',
    };
  }

  throw new Error(
    'Podaj VIN (17 znaków), numer rejestracyjny i datę pierwszej rejestracji (DD.MM.RRRR), aby sprawdzić OC w CEPIK/UFG, lub uzupełnij pole ważności polisy.',
  );
}
