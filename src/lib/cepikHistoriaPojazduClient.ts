const BASE_URL = 'https://moj.gov.pl';
const APP_NAME = 'HistoriaPojazdu';
const API_VERSION = '1.0.17';

export type CepikVehicleQuery = {
  registrationNumber: string;
  vin: string;
  firstRegistrationDate: string;
};

export type CepikSession = {
  cookies: Record<string, string>;
  nfWid: string;
};

export class CepikHistoriaPojazduError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CepikHistoriaPojazduError';
    this.code = code;
  }
}

function parseSetCookie(headers: Headers): Record<string, string> {
  const jar: Record<string, string> = {};
  const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  for (const raw of setCookies) {
    const [pair] = raw.split(';');
    const index = pair.indexOf('=');
    if (index > 0) {
      jar[pair.slice(0, index).trim()] = pair.slice(index + 1).trim();
    }
  }
  return jar;
}

function cookieHeader(jar: Record<string, string>) {
  return Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function mergeCookies(target: Record<string, string>, patch: Record<string, string>) {
  Object.assign(target, patch);
}

async function createSession(): Promise<CepikSession> {
  const jar: Record<string, string> = {};
  const nfWid = `${APP_NAME}:${Date.now()}`;

  const bootstrap = await fetch(`${BASE_URL}/uslugi/engine/ng/index?xFormsAppName=${APP_NAME}`, {
    headers: {
      'Accept-Language': 'pl-PL,pl;q=0.9',
      'User-Agent': 'EstateOS-Cars/1.0',
    },
  });
  mergeCookies(jar, parseSetCookie(bootstrap.headers));

  const auth = await fetch(`${BASE_URL}/uslugi/engine/ng/index?xFormsAppName=${APP_NAME}`, {
    method: 'POST',
    headers: {
      'Accept-Language': 'pl-PL,pl;q=0.9',
      'User-Agent': 'EstateOS-Cars/1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(jar),
    },
    body: `NF_WID=${encodeURIComponent(nfWid)}`,
  });
  mergeCookies(jar, parseSetCookie(auth.headers));

  if (!jar['XSRF-TOKEN']) {
    throw new CepikHistoriaPojazduError('Nie udało się nawiązać sesji z CEPIK (brak tokenu XSRF).');
  }

  return { cookies: jar, nfWid };
}

async function closeSession(session: CepikSession) {
  try {
    await fetch(`${BASE_URL}/nforms/api/${APP_NAME}/${API_VERSION}/close`, {
      headers: {
        'User-Agent': 'EstateOS-Cars/1.0',
        Nf_wid: session.nfWid,
        Cookie: cookieHeader(session.cookies),
      },
    });
  } catch {
    // Best-effort cleanup — ignore close failures.
  }
}

function apiHeaders(session: CepikSession) {
  return {
    Accept: 'application/json',
    'Accept-Language': 'pl-PL,pl;q=0.9',
    'Content-Type': 'application/json',
    'User-Agent': 'EstateOS-Cars/1.0',
    Cookie: cookieHeader(session.cookies),
    'X-Xsrf-Token': session.cookies['XSRF-TOKEN'],
    Nf_wid: session.nfWid,
  };
}

function parseCepikError(status: number, body: unknown): never {
  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const validationCode = String(payload.VALIDATION_ERROR_CODE || '');
  const validationMsg = String(payload.VALIDATION_ERROR_MSG || '');
  const genericCode = String(payload.code || payload.errorCode || '');
  const genericMsg = String(payload.message || '');

  if (validationCode === 'HIPO-0002' || status === 404) {
    throw new CepikHistoriaPojazduError(
      validationMsg || 'W bazie CEPIK nie znaleziono pojazdu o podanych danych (tablica, VIN, data pierwszej rejestracji).',
      validationCode || 'NOT_FOUND',
    );
  }

  throw new CepikHistoriaPojazduError(
    validationMsg || genericMsg || 'Błąd zapytania do CEPIK Historia Pojazdu.',
    validationCode || genericCode || String(status),
  );
}

async function postDataAction<T>(session: CepikSession, endpoint: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BASE_URL}/nforms/api/${APP_NAME}/${API_VERSION}/data/${endpoint}`, {
    method: 'POST',
    headers: apiHeaders(session),
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }

  if (!response.ok) {
    parseCepikError(response.status, json);
  }

  return json as T;
}

export async function withCepikSession<T>(fn: (session: CepikSession) => Promise<T>): Promise<T> {
  const session = await createSession();
  try {
    return await fn(session);
  } finally {
    await closeSession(session);
  }
}

export async function fetchCepikVehicleData(session: CepikSession, query: CepikVehicleQuery) {
  return postDataAction<Record<string, unknown>>(session, 'vehicle-data', {
    registrationNumber: query.registrationNumber,
    VINNumber: query.vin,
    firstRegistrationDate: query.firstRegistrationDate,
  });
}

export async function fetchCepikTimelineData(session: CepikSession, query: CepikVehicleQuery) {
  return postDataAction<Record<string, unknown>>(session, 'timeline-data', {
    registrationNumber: query.registrationNumber,
    VINNumber: query.vin,
    firstRegistrationDate: query.firstRegistrationDate,
  });
}

export async function fetchCepikInsuranceData(
  session: CepikSession,
  query: CepikVehicleQuery & { checkDate?: string },
) {
  return postDataAction<Record<string, unknown>>(session, 'insurance-data', {
    registrationNumber: query.registrationNumber,
    VINNumber: query.vin,
    firstRegistrationDate: query.firstRegistrationDate,
    verificationDate: query.checkDate,
    checkDate: query.checkDate,
  });
}

export async function queryCepikVehicle(query: CepikVehicleQuery) {
  return withCepikSession(async (session) => {
    const vehicleResult = await fetchCepikVehicleData(session, query).catch((error) => {
      if (error instanceof CepikHistoriaPojazduError) throw error;
      throw error;
    });

    const timelineData = await fetchCepikTimelineData(session, query).catch(() => null);
    const vehicleData = vehicleResult && typeof vehicleResult === 'object' ? vehicleResult : null;

    return { vehicleData, timelineData };
  });
}

export async function queryCepikInsurance(query: CepikVehicleQuery & { checkDate: string }) {
  return withCepikSession(async (session) => {
    const vehicleData = await fetchCepikVehicleData(session, query).catch(() => null);
    const timelineData = vehicleData ? await fetchCepikTimelineData(session, query).catch(() => null) : null;
    const insuranceData = await fetchCepikInsuranceData(session, query).catch(() => null);
    return { insuranceData, vehicleData, timelineData };
  });
}
