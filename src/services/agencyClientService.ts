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
  linkedUserId?: number | null;
  matchCount: number;
  topMatchScore: number | null;
  sentCount?: number;
  presentationConfirmed?: boolean;
  dealClosed?: boolean;
  sellerCity: string | null;
  sellerPrice: number | null;
  buyerCity: string | null;
  buyerMaxPrice: number | null;
  updatedAt: string;
  status?: 'ACTIVE' | 'ARCHIVED' | string;
  upcomingMeetingStartsAt?: string | null;
  upcomingMeetingLocation?: string | null;
  portalUrl?: string | null;
};

export type AgencyClientMatchImportBrief = {
  badge: 'OTO' | 'OLX' | 'N-O' | null;
  source?: string | null;
  url: string | null;
  titleOriginal?: string | null;
  descriptionOriginal?: string | null;
  phone?: string | null;
  agencyName?: string | null;
  contactAddress?: string | null;
  advertiserType?: string | null;
  smartAdd?: string[];
  userNote?: string | null;
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
  importBrief?: AgencyClientMatchImportBrief | null;
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

export type AgencyClientActivity = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  offerId?: number | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  visibleToClient?: boolean;
};

export type BuyerAgentTask = {
  id: string;
  activityId: number;
  kind: 'viewing' | 'question' | 'handoff' | 'stalled';
  priority: 'high' | 'normal';
  title: string;
  body: string;
  createdAt: string;
  matchId: number | null;
  offerId: number | null;
};

export type SellerMarketingBundle = {
  estateos: {
    offerId: number;
    status: string;
    published: boolean;
    featured: boolean;
    promotedUntil: string | null;
    publicationEndsAt: string | null;
  } | null;
  activeChannels: {
    portal: string;
    externalUrl: string | null;
    status: string | null;
    renewalDueAt: string | null;
    activityId: number;
  }[];
  sellerNextStep: {
    currentStep: string;
    nextAction: string;
    clientMessage: string | null;
    dueAt: string | null;
    visibleToClient: boolean;
    updatedAt: string;
  } | null;
  pendingDecisions: {
    id: number;
    kind: string;
    title: string;
    clientMessage: string;
    status: string;
    clientResponse?: string | null;
    dueAt: string | null;
    createdAt: string;
    payload?: Record<string, unknown> | null;
  }[];
  sellerEvents?: {
    openHouse: {
      proposal: { id: number; title: string; status: string } | null;
      event: {
        id: number;
        status: string;
        startsAt: string | null;
        endsAt: string | null;
        title: string | null;
      } | null;
    };
    auction: {
      proposal: { id: number; title: string; status: string } | null;
      event: {
        id: number;
        status: string;
        startsAt: string | null;
        endsAt: string | null;
        startPrice: number;
        title: string | null;
      } | null;
    };
    stage: { id: string; label: string; kind: 'open_house' | 'auction' | null } | null;
  } | null;
  marketingTimeline: {
    id: number;
    kind: string;
    title: string | null;
    body: string | null;
    createdAt: string;
    portal: string | null;
    externalUrl: string | null;
    status: string | null;
    renewalDueAt: string | null;
    promotedUntil: string | null;
    visibleToClient: boolean;
    groupName?: string | null;
    groupUrl?: string | null;
    image?: string | null;
  }[];
  facebookGroups?: {
    key: string;
    groupName: string;
    groupUrl: string | null;
    lastPostedAt: string;
    lastPostUrl: string | null;
    postCount: number;
    lastOfferId: number | null;
  }[];
  facebookShareOffers?: {
    id: number;
    title: string;
    city: string | null;
    price: number | null;
    imageUrl: string | null;
    linkedClientId: number | null;
  }[];
};

export type ManagedOfferOption = {
  id: number;
  title: string;
  city: string | null;
  price: number | null;
  imageUrl: string | null;
  linkedClientId: number | null;
  status?: string;
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
      maxArea: boolean;
      minYear: boolean;
      minRooms: boolean;
      requireBalcony: boolean;
      requireGarden: boolean;
      requireElevator: boolean;
      requireParking: boolean;
      requireFurnished: boolean;
    };
  } | null;
  pendingCheckback?: {
    activityId: number;
    type: string;
    body: string;
    options: { id: string; label: string }[];
    createdAt: string;
  } | null;
  openHandoff?: { id: number; body: string } | null;
  buyerAgentTasks?: BuyerAgentTask[];
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
  messages?: {
    id: number;
    content: string;
    createdAt: string;
    fromAgent: boolean;
    fromMe: boolean;
    kind?: 'chat' | 'client_step' | 'agent_note' | 'checkback';
    offerTitle?: string | null;
    sentiment?: string | null;
    attachments: { url: string; name: string; mimeType: string; size: number }[];
  }[];
  activities?: AgencyClientActivity[];
  sellerMarketing?: SellerMarketingBundle | null;
  relatedProjects?: {
    selling: ClientPersonProject[];
    buying: ClientPersonProject[];
  };
  managedOffers?: ManagedOfferOption[];
};

export type ClientPersonProject = {
  id: number;
  type: 'BUYER' | 'SELLER';
  title: string;
  subtitle: string;
  statusLabel: string;
  eventStage?: { id: string; label: string; kind: 'open_house' | 'auction' | null } | null;
  portalUnreadCount: number;
  linkedOfferId: number | null;
  matchCount: number;
  updatedAt: string;
  createdAt: string;
  coverImageUrl: string | null;
};

export type AcquisitionFormData = {
  meeting: Record<string, string>;
  ownership: Record<string, string>;
  property: Record<string, string>;
  strategy: Record<string, string | boolean>;
  cooperation: Record<string, string | boolean>;
  documents: Record<string, boolean>;
  notes: string;
  paperContracts: { url: string; name: string; uploadedAt: string }[];
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
  const clients = ((json.clients || []) as AgencyClientListItem[]).filter(
    (client) => String(client.status || 'ACTIVE').toUpperCase() !== 'ARCHIVED',
  );
  return { ok: true as const, clients };
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
      matches: (Array.isArray(json?.matches) ? json.matches : []) as {
        id: number;
        firstName: string;
        lastName: string;
        email: string | null;
        phone: string | null;
      }[],
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

export async function archiveAgencyClients(token: string, clientIds: number[]) {
  const res = await fetch(`${API_URL}/api/crm/clients`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'archive_bulk', clientIds }),
  });
  const json = await parseJson(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się zarchiwizować klientów.') };
  return {
    ok: true as const,
    archivedCount: Array.isArray(json.archivedIds) ? json.archivedIds.length : clientIds.length,
    message: String(json.message || ''),
  };
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
    linkedOfferId: json.linkedOfferId != null ? Number(json.linkedOfferId) : null,
    linkedOffer: json.linkedOffer as
      | {
          id: number;
          status?: string | null;
          officeReviewStatus?: string | null;
          title?: string | null;
          imageUrl?: string | null;
        }
      | null
      | undefined,
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
    ? (json.suggestions as {
        id: string;
        label: string;
        address: string;
        city?: string | null;
        lat?: number | null;
        lng?: number | null;
      }[])
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

export type ExternalPortalPublicationInput = {
  url: string;
  portal: string;
  status: 'active' | 'paused';
  note?: string;
  visibleToClient: boolean;
  publishedAt?: string;
  renewalDueAt?: string;
  evidenceUrl?: string;
  evidenceName?: string;
  evidenceMimeType?: string;
  groupName?: string;
};

export function addExternalPortalPublication(
  token: string,
  clientId: number,
  input: ExternalPortalPublicationInput,
) {
  return postAgencyClientAction(token, clientId, {
    action: 'add_external_portal',
    ...input,
  });
}

export function prepareFacebookGroupShare(
  token: string,
  clientId: number,
  input: {
    offerId: number;
    groupName?: string | null;
    groupUrl?: string | null;
  },
) {
  return postAgencyClientAction(token, clientId, {
    action: 'prepare_facebook_group_share',
    ...input,
  });
}

export function recordFacebookGroupPost(
  token: string,
  clientId: number,
  input: {
    offerId: number;
    groupName?: string | null;
    groupUrl?: string | null;
    postUrl?: string | null;
    confirmed?: boolean;
    visibleToClient?: boolean;
    renewalDueAt?: string;
  },
) {
  return postAgencyClientAction(token, clientId, {
    action: 'record_facebook_group_post',
    ...input,
  });
}

export function updateExternalPortalPublication(
  token: string,
  clientId: number,
  input: {
    activityId: number;
    status?: 'active' | 'paused' | 'expired';
    note?: string;
    renewalDueAt?: string;
    visibleToClient?: boolean;
  },
) {
  return postAgencyClientAction(token, clientId, {
    action: 'update_external_portal',
    ...input,
  });
}

export function removeExternalPortalPublication(
  token: string,
  clientId: number,
  activityId: number,
  note?: string,
) {
  return postAgencyClientAction(token, clientId, {
    action: 'remove_external_portal',
    activityId,
    note,
  });
}

export function setMarketingActivityVisibility(
  token: string,
  clientId: number,
  activityId: number,
  visibleToClient: boolean,
) {
  return postAgencyClientAction(token, clientId, {
    action: 'set_marketing_visibility',
    activityId,
    visibleToClient,
  });
}

export function saveSellerNextStep(
  token: string,
  clientId: number,
  input: {
    currentStep: string;
    nextAction: string;
    clientMessage?: string;
    dueAt?: string;
    visibleToClient: boolean;
  },
) {
  return postAgencyClientAction(token, clientId, {
    action: 'set_seller_next_step',
    ...input,
  });
}

export function requestSellerClientDecision(
  token: string,
  clientId: number,
  input: {
    kind: string;
    title: string;
    clientMessage: string;
    dueAt?: string;
  },
) {
  return postAgencyClientAction(token, clientId, {
    action: 'request_client_decision',
    ...input,
  });
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
