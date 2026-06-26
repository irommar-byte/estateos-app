import {
  dispatchContactUnreadRefresh,
  initContactThreadWeb,
  sendContactMessageWeb,
} from '@/lib/contactServiceWeb';
import { fetchCurrentWebUser } from '@/lib/webSessionClient';

const STORAGE_KEY = 'estateos:offer-share-intent';

export type OfferShareIntentKind = 'appointment' | 'message';

export type PendingAppointmentIntent = {
  kind: 'appointment';
  offerId: number;
  sellerId: number;
  proposedDateIso: string;
  message: string;
  shareContact: boolean;
  returnPath: string;
  publisherName?: string;
  offerTitle?: string;
};

export type PendingMessageIntent = {
  kind: 'message';
  peerUserId: number;
  peerName?: string;
  draft: string;
  returnPath: string;
  offerId?: number;
};

export type OfferShareIntent = PendingAppointmentIntent | PendingMessageIntent;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

export function saveOfferShareIntent(intent: OfferShareIntent): void {
  if (!canUseStorage()) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
}

export function loadOfferShareIntent(): OfferShareIntent | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfferShareIntent;
    if (parsed?.kind !== 'appointment' && parsed?.kind !== 'message') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfferShareIntent(): void {
  if (!canUseStorage()) return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function buildAuthHref(
  mode: 'login' | 'register',
  returnPath: string,
  intentKind: OfferShareIntentKind,
): string {
  const next = encodeURIComponent(returnPath);
  const intent = encodeURIComponent(intentKind);
  const base = mode === 'login' ? '/login' : '/rejestracja';
  return `${base}?next=${next}&intent=${intent}`;
}

async function submitAppointmentIntent(intent: PendingAppointmentIntent): Promise<string | null> {
  const res = await fetch('/api/appointments/propose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      offerId: intent.offerId,
      sellerId: intent.sellerId,
      proposedDate: intent.proposedDateIso,
      message: intent.message,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 403 && data?.errorCode === 'PHONE_VERIFICATION_REQUIRED') {
    return '/moje-konto/weryfikacja';
  }
  if (!res.ok) {
    throw new Error(String(data?.error || data?.message || 'Nie udało się wysłać prośby o wizytę.'));
  }
  const dealId = Number(data?.appointment?.dealId);
  if (Number.isFinite(dealId) && dealId > 0) {
    return `/dealroom/${dealId}`;
  }
  return intent.returnPath;
}

async function submitMessageIntent(intent: PendingMessageIntent): Promise<string> {
  const thread = await initContactThreadWeb(intent.peerUserId);
  const draft = intent.draft.trim();
  if (draft) {
    await sendContactMessageWeb(thread.id, draft);
  }
  dispatchContactUnreadRefresh();
  const name = encodeURIComponent(intent.peerName || thread.peerUserName || '');
  return `/moje-konto/wiadomosci?thread=${thread.id}&peer=${intent.peerUserId}${name ? `&name=${name}` : ''}`;
}

/**
 * Po zalogowaniu / rejestracji — wznów zapisany termin lub wiadomość.
 * Zwraca docelowy URL lub null, gdy brak oczekującej akcji.
 */
export async function resumeOfferShareIntent(): Promise<string | null> {
  const intent = loadOfferShareIntent();
  if (!intent) return null;

  const user = await fetchCurrentWebUser();
  if (!user) return null;

  try {
    if (intent.kind === 'appointment') {
      const destination = await submitAppointmentIntent(intent);
      clearOfferShareIntent();
      return destination;
    }
    const destination = await submitMessageIntent(intent);
    clearOfferShareIntent();
    return destination;
  } catch (err) {
    console.warn('[offerShareIntent] resume failed', err);
    return intent.returnPath;
  }
}

export async function resolvePostAuthDestination(
  fallbackPath: string,
  role?: string,
): Promise<string> {
  if (role === 'ADMIN') return '/centrala';
  const resumed = await resumeOfferShareIntent();
  return resumed || fallbackPath;
}
