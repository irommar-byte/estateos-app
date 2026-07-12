import { API_URL } from '../config/network';

export type VehicleHistoryReport = {
  vin: string;
  registrationNumber: string;
  firstRegistrationDate: string;
  summary: string;
  sections: { title: string; rows: { label: string; value: string }[] }[];
  checkedAt: string;
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
  source?: 'CEPIK' | 'UFG' | 'CEPIK_FALLBACK';
};

function authHeaders(token?: string | null): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchVehicleHistoryReport(
  input: {
    vin?: string;
    registrationNumber?: string;
    firstRegistrationDate?: string;
    carId?: number;
  },
  token?: string | null,
): Promise<VehicleHistoryReport> {
  const response = await fetch(`${API_URL}/api/cars/vehicle-history`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Nie udało się pobrać historii pojazdu.');
  }
  return data.report as VehicleHistoryReport;
}

export async function checkCarInsurance(
  input: {
    registrationNumber?: string;
    insuranceValidUntil?: string;
    vin?: string;
    firstRegistrationDate?: string;
    carId?: number;
  },
  token?: string | null,
): Promise<InsuranceCheckResult> {
  const response = await fetch(`${API_URL}/api/cars/insurance-check`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Nie udało się sprawdzić ubezpieczenia.');
  }
  return {
    hasInsurance: Boolean(data.hasInsurance),
    message: String(data.message || ''),
    validUntil: data.validUntil ?? null,
    insurer: data.insurer ?? null,
    policyNumber: data.policyNumber ?? null,
    vehicleMake: data.vehicleMake ?? null,
    vehicleModel: data.vehicleModel ?? null,
    checkedAt: String(data.checkedAt || ''),
    source: data.source,
  };
}
