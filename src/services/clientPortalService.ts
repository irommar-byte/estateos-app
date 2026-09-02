import { API_URL } from '../config/network';
import { mobileFetchJson } from '../utils/mobileFetch';
import { restorePortalSessionsFromServer } from '../lib/clientPortalSession';

export type PortalOffer = {
  id: number;
  title: string;
  price?: number | string | null;
  priceCurrency?: string | null;
  city?: string | null;
  district?: string | null;
  area?: number | null;
  rooms?: number | null;
  excerpt?: string | null;
  imageUrl?: string | null;
};

export type PortalMatch = {
  id: number;
  score: number;
  notifiedAt: string | null;
  clientFeedback: string | null;
  clientFeedbackAt: string | null;
  intelligenceSent?: boolean;
  intelligenceReason?: string | null;
  clientWhy?: string | null;
  offer: PortalOffer;
};

export type PortalCheckback = {
  activityId: number;
  type?: string;
  body: string;
  options: { id: string; label: string }[];
  createdAt?: string;
} | null;

export type PortalAccountStatus = 'linked' | 'ready' | 'wrong_account' | 'anonymous';

export type PortalAccount = {
  status: PortalAccountStatus;
  linked: boolean;
  linkedToYou?: boolean;
  emailMasked: string | null;
  sessionEmailMasked?: string | null;
  activation?: PortalActivationHint | null;
};

export type PortalActivationHint =
  | {
      available: true;
      emailMasked: string | null;
      phoneSuffixRequired: boolean;
      phoneSuffixLabel: string;
    }
  | {
      available: false;
      reason: 'missing_client_email';
    };

export type PortalListing = {
  id: number;
  title: string;
  price?: number | string | null;
  priceCurrency?: string | null;
  city?: string | null;
  district?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  imageUrl?: string | null;
  featured?: boolean;
  promotedUntil?: string | null;
};

export type PortalListingProgress = {
  id: string;
  label: string;
  done: boolean;
};

export type PortalMarketingTimelineItem = {
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
  siteName?: string | null;
  visibleToClient?: boolean;
  evidenceUrl?: string | null;
  evidenceName?: string | null;
  groupName?: string | null;
  groupUrl?: string | null;
  image?: string | null;
};

export type PortalActiveChannel = {
  portal: string;
  externalUrl: string | null;
  status: string | null;
  renewalDueAt: string | null;
  activityId: number;
};

export type PortalSellerNextStep = {
  currentStep: string;
  nextAction: string;
  clientMessage: string | null;
  dueAt: string | null;
  visibleToClient: boolean;
  updatedAt: string;
};

export type PortalDecisionRequest = {
  id: number;
  kind: string;
  title: string;
  clientMessage: string;
  status: string;
  clientResponse?: string | null;
  dueAt: string | null;
  createdAt: string;
  resolvedAt?: string | null;
};

export type PortalScheduleSlot = {
  startsAt: string;
  location?: string | null;
  notes?: string | null;
  status: 'confirmed' | 'pending';
  proposedBy?: 'agent' | 'client';
  reason?: string | null;
  previousStartsAt?: string | null;
  prepLabels?: string[];
};

export type PortalJourneyStage = {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
  hint?: string;
  at?: string | null;
};

export type ClientPortalPayload = {
  clientName: string;
  type: string;
  agencyName: string;
  agentName: string;
  agentPhone?: string | null;
  agentEmail?: string | null;
  agentPhoto?: string | null;
  agentTitle?: string | null;
  intelligenceEnabled: boolean;
  pendingCheckback: PortalCheckback;
  unscoredMatchCount: number;
  canChat: boolean;
  account?: PortalAccount;
  matches: PortalMatch[];
  listing?: PortalListing | null;
  listingProgress?: PortalListingProgress[];
  listingPath?: Array<{
    id: number;
    kind: string;
    title: string | null;
    body: string | null;
    createdAt: string;
    startsAt?: string | null;
    url?: string | null;
    image?: string | null;
    siteName?: string | null;
    groupName?: string | null;
    groupUrl?: string | null;
    portal?: string | null;
    status?: string | null;
    promotedUntil?: string | null;
    renewalDueAt?: string | null;
    reportId?: number | null;
  }>;
  marketingTimeline?: PortalMarketingTimelineItem[];
  activeChannels?: PortalActiveChannel[];
  sellerNextStep?: PortalSellerNextStep | null;
  pendingDecisions?: PortalDecisionRequest[];
  meeting?: PortalScheduleSlot | null;
  presentation?: PortalScheduleSlot | null;
  journey?: PortalJourneyStage[];
  acquisition?: { status?: string | null } | null;
};

export type PortalChatMessage = {
  id: number;
  from?: 'agent' | 'client';
  content?: string;
  body?: string;
  createdAt: string;
};

function portalUrl(token: string, suffix = '') {
  return `${API_URL}/api/crm/client-portal/${encodeURIComponent(token)}${suffix}`;
}

function normalizeAuthToken(authToken?: string | null): string | null {
  if (!authToken?.trim()) return null;
  const trimmed = authToken.trim();
  return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
}

export function portalAuthHeaders(authToken?: string | null): Record<string, string> {
  const token = normalizeAuthToken(authToken);
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    'x-access-token': token,
    'auth-token': token,
  };
}

export async function fetchClientPortal(token: string, authToken?: string | null): Promise<ClientPortalPayload> {
  const { response, data } = await mobileFetchJson<{ success?: boolean; portal?: ClientPortalPayload; error?: string }>(
    portalUrl(token),
    { headers: portalAuthHeaders(authToken) },
  );
  if (!response.ok || !data?.portal) {
    throw new Error(data?.error || 'Nie udało się otworzyć panelu klienta.');
  }
  return data.portal;
}

async function postPortal<T = Record<string, unknown>>(
  token: string,
  body: Record<string, unknown>,
  authToken?: string | null,
): Promise<T> {
  const { response, data } = await mobileFetchJson<T & { error?: string; success?: boolean }>(portalUrl(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...portalAuthHeaders(authToken) },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error((data as { error?: string })?.error || 'Nie udało się zapisać.');
  }
  return data as T;
}

export async function submitPortalFeedback(
  token: string,
  params: { matchId: number; sentiment: 'like' | 'maybe' | 'dislike'; phrases?: string[]; note?: string },
) {
  return postPortal(token, {
    action: 'submit_feedback',
    matchId: params.matchId,
    sentiment: params.sentiment,
    phrases: params.phrases || [],
    note: params.note || '',
  });
}

export async function submitPortalCheckback(token: string, params: { activityId: number; optionId: string }) {
  return postPortal(token, {
    action: 'intelligence_checkback',
    activityId: params.activityId,
    optionId: params.optionId,
  });
}

export async function respondPortalDecision(
  token: string,
  params: { decisionId: number; response: 'approve' | 'reject' | 'comment'; comment?: string },
  authToken?: string | null,
) {
  return postPortal(
    token,
    {
      action: 'respond_decision',
      decisionId: params.decisionId,
      response: params.response,
      comment: params.comment || '',
    },
    authToken,
  );
}

export async function listPortalMessages(token: string): Promise<{ messages: PortalChatMessage[]; unreadCount: number }> {
  const data = await postPortal<{ messages?: PortalChatMessage[]; unreadCount?: number }>(token, {
    action: 'list_messages',
  });
  return { messages: data.messages || [], unreadCount: data.unreadCount || 0 };
}

export async function sendPortalMessage(token: string, content: string) {
  return postPortal(token, { action: 'send_message', content });
}

export async function confirmPortalSchedule(
  token: string,
  kind: 'meeting' | 'presentation',
  authToken?: string | null,
) {
  return postPortal(
    token,
    { action: kind === 'meeting' ? 'confirm_meeting' : 'confirm_presentation' },
    authToken,
  );
}

export async function proposePortalScheduleChange(
  token: string,
  kind: 'meeting' | 'presentation',
  params: { startsAt: string; reason: string },
  authToken?: string | null,
) {
  return postPortal(
    token,
    {
      action: kind === 'meeting' ? 'propose_meeting_change' : 'propose_presentation_change',
      startsAt: params.startsAt,
      reason: params.reason,
    },
    authToken,
  );
}

export async function markPortalMessagesRead(token: string) {
  return postPortal(token, { action: 'mark_messages_read' }).catch(() => null);
}

export async function linkPortalAccount(token: string, authToken: string) {
  const { response, data } = await mobileFetchJson<{ success?: boolean; error?: string; linkedUserId?: number }>(
    portalUrl(token, '/link-account'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...portalAuthHeaders(authToken),
      },
      body: '{}',
    },
  );
  if (!response.ok) {
    throw new Error(data?.error || 'Nie udało się powiązać konta.');
  }
  return data;
}

export async function activatePortalAccount(
  token: string,
  params: { email: string; password: string; phoneSuffix?: string },
) {
  const { response, data } = await mobileFetchJson<{
    success?: boolean;
    error?: string;
    token?: string;
    user?: Record<string, unknown>;
    created?: boolean;
    linkedUserId?: number;
  }>(portalUrl(token, '/activate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email.trim().toLowerCase(),
      password: params.password,
      phoneSuffix: params.phoneSuffix || '',
    }),
  });
  if (!response.ok || !data?.token || !data?.user) {
    throw new Error(data?.error || 'Nie udało się aktywować panelu.');
  }
  return data;
}

export async function registerPortalPushDevice(
  token: string,
  payload: { expoPushToken: string; platform: string; deviceModel: string; appVersion: string },
) {
  const { response } = await mobileFetchJson(portalUrl(token, '/device'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.ok;
}

export async function restoreLinkedClientPortals(authToken: string): Promise<string | null> {
  try {
    const { response, data } = await mobileFetchJson<{
      success?: boolean;
      portals?: { portalToken?: string; clientName?: string; agencyName?: string }[];
    }>(`${API_URL}/api/mobile/v1/client-portal/mine`, {
      headers: portalAuthHeaders(authToken),
    });
    if (!response.ok || !data?.portals?.length) return null;
    return restorePortalSessionsFromServer(data.portals);
  } catch {
    return null;
  }
}
