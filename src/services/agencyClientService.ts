import { API_URL } from '../config/network';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' };
}

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

export type AgencyClientListItem = {
  id: number;
  type: 'BUYER' | 'SELLER';
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  pesel?: string | null;
  matchCount: number;
  topMatchScore: number | null;
  sellerCity: string | null;
  sellerPrice: number | null;
  buyerCity: string | null;
  buyerMaxPrice: number | null;
  updatedAt: string;
  upcomingMeetingStartsAt?: string | null;
  upcomingMeetingLocation?: string | null;
  portalUrl?: string | null;
};

export type AgencyClientMatch = {
  id: number;
  score: number;
  notifiedAt: string | null;
  sharedAt: string | null;
  clientFeedback: string | null;
  clientFeedbackAt?: string | null;
  intelligenceSent?: boolean;
  intelligenceReason?: string | null;
  offer: {
    id: number;
    title: string;
    price: number;
    city: string;
    district?: string | null;
    area?: number | null;
    excerpt?: string | null;
    description?: string | null;
    imageUrl: string;
    imageUrls?: string[] | null;
  };
};

export type AgencyClientNextStep = {
  id: string;
  label: string;
  hint: string;
  action: string;
};

export type AgencyClientDetail = AgencyClientListItem & {
  notes: string | null;
  portalUrl: string | null;
  portalToken: string | null;
  linkedOfferId: number | null;
  linkedUserId?: number | null;
  sellerDescription: string | null;
  sellerDistrict: string | null;
  buyerFilters: Record<string, unknown> | null;
  matches: AgencyClientMatch[];
  nextStep?: AgencyClientNextStep | null;
  portalUnreadCount?: number;
  intelligence?: {
    enabled: boolean;
    intervalHours: number;
    dailyLimit: number;
    minLearns: number;
    minScore: number;
    lastSentAt: string | null;
    lockedFields?: {
      districts: boolean;
      maxPrice: boolean;
      minArea: boolean;
      minYear: boolean;
      requireBalcony: boolean;
      requireGarden: boolean;
      requireElevator: boolean;
      requireParking: boolean;
      requireFurnished: boolean;
    };
  } | null;
  meeting?: {
    startsAt: string;
    location: string | null;
    notes: string | null;
    status: 'confirmed' | 'pending';
    proposedBy: 'agent' | 'client';
    reason: string | null;
  } | null;
  presentation?: {
    startsAt: string;
    location: string | null;
    notes: string | null;
    status: 'confirmed' | 'pending';
    proposedBy: 'agent' | 'client';
    reason: string | null;
  } | null;
  messages?: Array<{
    id: number;
    content: string;
    createdAt: string;
    fromAgent: boolean;
    fromMe: boolean;
    attachments: Array<{ url: string; name: string; mimeType: string; size: number }>;
  }>;
};

export type AcquisitionFormData = {
  meeting: Record<string, string>;
  ownership: Record<string, string>;
  property: Record<string, string>;
  strategy: Record<string, string | boolean>;
  cooperation: Record<string, string | boolean>;
  documents: Record<string, boolean>;
  notes: string;
  paperContracts: Array<{ url: string; name: string; uploadedAt: string }>;
};

export type AcquisitionRecord = {
  id: number;
  status: string;
  currentStep: number;
  formData: AcquisitionFormData;
  agreementSnapshot: string | null;
  signedAt: string | null;
  signerName: string | null;
};

export async function fetchAgencyClients(token: string, type?: 'BUYER' | 'SELLER') {
  const qs = type ? `?type=${type}` : '';
  const res = await fetch(`${API_URL}/api/crm/clients${qs}`, { headers: authHeaders(token) });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się pobrać klientów.'), clients: [] as AgencyClientListItem[] };
  return { ok: true as const, clients: (json.clients || []) as AgencyClientListItem[] };
}

export async function fetchAgencyClient(token: string, id: number) {
  const res = await fetch(`${API_URL}/api/crm/clients/${id}`, { headers: authHeaders(token) });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie znaleziono klienta.') };
  return { ok: true as const, client: json.client as AgencyClientDetail };
}

export async function createAgencyClient(
  token: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(`${API_URL}/api/crm/clients`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await parseJson(res);
  if (res.status === 409) {
    return {
      ok: false as const,
      code: 'DUPLICATE_CLIENT' as const,
      message: String(json?.error || 'Klient o tym e-mailu lub telefonie już jest w CRM.'),
      matches: (Array.isArray(json?.matches) ? json.matches : []) as Array<{
        id: number;
        firstName: string;
        lastName: string;
        email: string | null;
        phone: string | null;
      }>,
    };
  }
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się dodać klienta.') };
  return { ok: true as const, clientId: Number(json.client?.id) };
}

export async function patchAgencyClient(token: string, id: number, body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/crm/clients/${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się zapisać.') };
  return { ok: true as const };
}

export async function archiveAgencyClient(token: string, id: number) {
  const res = await fetch(`${API_URL}/api/crm/clients/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się zarchiwizować.') };
  return { ok: true as const };
}

export async function refreshClientMatches(token: string, id: number) {
  const res = await fetch(`${API_URL}/api/crm/clients/${id}`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'refresh_matches' }),
  });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się odświeżyć dopasowań.') };
  return { ok: true as const };
}

export async function proposeClientOffers(
  token: string,
  id: number,
  offerIds: number[],
  opts?: { allowResend?: boolean },
) {
  const res = await fetch(`${API_URL}/api/crm/clients/${id}`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'notify_offers',
      offerIds,
      channel: 'email',
      allowResend: Boolean(opts?.allowResend),
    }),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    const fallback = await fetch(`${API_URL}/api/crm/clients/${id}`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'notify_offer',
        offerId: offerIds[0],
        channel: 'email',
        allowResend: Boolean(opts?.allowResend),
      }),
    });
    const fallbackJson = await parseJson(fallback);
    if (!fallback.ok) return { ok: false as const, message: String(fallbackJson?.error || json?.error || 'Nie udało się zaproponować.') };
  }
  return { ok: true as const };
}

export async function fetchAcquisition(token: string, clientId: number) {
  const res = await fetch(`${API_URL}/api/crm/clients/${clientId}/acquisition`, { headers: authHeaders(token) });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się pobrać procesu.') };
  return {
    ok: true as const,
    acquisition: (json.acquisition || null) as AcquisitionRecord | null,
    defaultForm: json.defaultForm as AcquisitionFormData,
    portalUrl: json.portalUrl as string | null,
  };
}

export async function saveAcquisition(
  token: string,
  clientId: number,
  body: Record<string, unknown>,
) {
  const res = await fetch(`${API_URL}/api/crm/clients/${clientId}/acquisition`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się zapisać.') };
  return { ok: true as const, acquisition: json.acquisition as AcquisitionRecord };
}

export async function acquisitionAction(
  token: string,
  clientId: number,
  body: Record<string, unknown>,
) {
  const res = await fetch(`${API_URL}/api/crm/clients/${clientId}/acquisition`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się wykonać akcji.') };
  return {
    ok: true as const,
    acquisition: json.acquisition as AcquisitionRecord,
    emailSent: Boolean(json.emailSent),
    offerId: json.offerId != null ? Number(json.offerId) : null,
    offerError: json.offerError ? String(json.offerError) : null,
  };
}

export async function uploadAcquisitionPaper(
  token: string,
  clientId: number,
  file: { uri: string; name: string; mimeType: string },
  purpose: 'paper' | 'plan' | 'asset' = 'paper',
) {
  const payload = new FormData();
  payload.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as any);
  payload.append('purpose', purpose);
  const res = await fetch(`${API_URL}/api/crm/clients/${clientId}/acquisition/paper`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: payload,
  });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się wgrać pliku.') };
  return {
    ok: true as const,
    formData: json.formData as AcquisitionFormData,
    file: json.file as { url: string; name: string; mimeType: string } | undefined,
  };
}

export async function suggestAddresses(token: string, query: string) {
  const res = await fetch(`${API_URL}/api/location/forward?q=${encodeURIComponent(query)}`, {
    headers: authHeaders(token),
  });
  const json = await parseJson(res);
  return Array.isArray(json.suggestions)
    ? (json.suggestions as Array<{
        id: string;
        label: string;
        address: string;
        city?: string | null;
        lat?: number | null;
        lng?: number | null;
      }>)
    : [];
}

export async function linkAgencyClientOffer(token: string, clientId: number, offerId: number) {
  const res = await fetch(`${API_URL}/api/crm/clients/${clientId}`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'link_offer', offerId }),
  });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się powiązać oferty.') };
  return { ok: true as const };
}

export async function createOfferFromAcquisition(token: string, clientId: number) {
  const res = await fetch(`${API_URL}/api/crm/clients/${clientId}`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create_offer_from_acquisition' }),
  });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się utworzyć oferty.') };
  return { ok: true as const, offerId: Number(json.offerId) };
}

export async function postAgencyClientAction(token: string, clientId: number, body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/crm/clients/${clientId}`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się wykonać akcji.') };
  return { ok: true as const, message: json.message, ...json };
}

export async function uploadClientPortalAttachment(
  token: string,
  clientId: number,
  file: { uri: string; name: string; mimeType: string },
) {
  const payload = new FormData();
  payload.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as any);
  const res = await fetch(`${API_URL}/api/crm/clients/${clientId}/portal-attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: payload,
  });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się wgrać załącznika.') };
  return {
    ok: true as const,
    attachment: json.attachment as { url: string; name: string; mimeType: string; size: number },
  };
}

export async function previewPortalListing(token: string, url: string) {
  const res = await fetch(`${API_URL}/api/mobile/v1/pro/otodom-import`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim() }),
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.success) {
    return { ok: false as const, message: String(json?.message || json?.error || 'Nie udało się odczytać ogłoszenia.') };
  }
  return {
    ok: true as const,
    draft: json.draft as {
      title?: string;
      price?: number | null;
      city?: string | null;
      district?: string | null;
      lat?: number | null;
      lng?: number | null;
      area?: number | null;
      rooms?: number | null;
    },
    presentation: json.presentation as { title?: string } | undefined,
  };
}
