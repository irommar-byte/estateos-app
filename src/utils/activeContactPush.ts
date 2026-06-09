import type * as Notifications from 'expo-notifications';
import { mergePushPayload as mergeCanonicalPushPayload } from '../contracts/parityContracts';

let activeContactThreadId: number | null = null;

export function setActiveContactThread(threadId: number | null) {
  const id = threadId != null ? Number(threadId) : NaN;
  activeContactThreadId = Number.isFinite(id) && id > 0 ? id : null;
}

export function getActiveContactThreadId(): number | null {
  return activeContactThreadId;
}

function mergeData(notification: Notifications.Notification): Record<string, unknown> {
  return mergeCanonicalPushPayload({
    baseData: notification.request.content?.data,
    triggerPayload: (notification.request as any)?.trigger?.payload,
  });
}

export function extractContactThreadIdFromPush(notification: Notifications.Notification): number | null {
  const data = mergeData(notification);
  const raw = data.threadId ?? data.contactThreadId ?? data.targetId;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function contactPushThreadIdentifier(peerUserId: number | string): string {
  return `estateos-contact-peer-${peerUserId}`;
}

export function resolveContactPushThreadIdentifier(
  notification: Notifications.Notification,
): string {
  const data = mergeData(notification);
  const explicit = String(data.threadIdentifier ?? '').trim();
  if (explicit) return explicit;
  const peerUserId = data.peerUserId;
  if (peerUserId != null && String(peerUserId).trim() !== '') {
    return contactPushThreadIdentifier(peerUserId);
  }
  const threadId = extractContactThreadIdFromPush(notification);
  if (threadId != null) return `estateos-contact-thread-${threadId}`;
  return 'estateos-contact';
}

export function resolveContactPushDisplayTitle(
  notification: Notifications.Notification,
): string {
  const data = mergeData(notification);
  const peerName = String(data.peerName ?? '').trim();
  if (peerName) return peerName;
  const title = String(notification.request.content.title || '').trim();
  if (title && !/estateos.*contact/i.test(title)) return title;
  return 'Wiadomość';
}

export function resolveContactPushDisplayBody(notification: Notifications.Notification): string {
  const raw = String(notification.request.content.body || '').trim();
  if (!raw) return '';
  const title = String(notification.request.content.title || '');
  if (/estateos.*contact/i.test(title)) {
    const colonIdx = raw.indexOf(': ');
    if (colonIdx > 0) return raw.slice(colonIdx + 2).trim();
  }
  return raw;
}

export function isContactPushNotification(notification: Notifications.Notification): boolean {
  const data = mergeData(notification);
  const type = String(data.targetType ?? data.target ?? data.notificationType ?? '').toUpperCase();
  if (type.includes('CONTACT')) return true;
  const title = String(notification.request.content.title || '').toLowerCase();
  return title.includes('estateos') && title.includes('contact');
}

export function shouldSuppressContactPushForActiveChat(notification: Notifications.Notification): boolean {
  if (activeContactThreadId == null) return false;
  const pushThreadId = extractContactThreadIdFromPush(notification);
  return pushThreadId != null && pushThreadId === activeContactThreadId;
}
