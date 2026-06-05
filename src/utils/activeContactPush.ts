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
