import { DeviceEventEmitter } from 'react-native';

/** Wiadomość do klienta odłożona przez serwer do akceptacji agenta. */
export type QueuedOutboxSummary = {
  id: number;
  clientId: number;
  category: string;
  categoryLabel: string;
  channels: string[];
  recipient: string | null;
  subject: string | null;
};

const QUEUED = 'estateos.outbox.queued';
const OPEN = 'estateos.outbox.open';
const CHANGED = 'estateos.outbox.changed';

export function emitOutboxQueued(items: QueuedOutboxSummary[]) {
  if (items.length) DeviceEventEmitter.emit(QUEUED, items);
}

export function onOutboxQueued(listener: (items: QueuedOutboxSummary[]) => void) {
  return DeviceEventEmitter.addListener(QUEUED, listener);
}

/** Otwórz podgląd konkretnej wiadomości (np. z ekranu „Dziś”). */
export function openOutboxReview(id: number) {
  DeviceEventEmitter.emit(OPEN, id);
}

export function onOutboxOpen(listener: (id: number) => void) {
  return DeviceEventEmitter.addListener(OPEN, listener);
}

/** Wiadomość wysłana albo anulowana — ekrany mogą się odświeżyć. */
export function emitOutboxChanged(id: number, result: 'sent' | 'cancelled') {
  DeviceEventEmitter.emit(CHANGED, { id, result });
}

export function onOutboxChanged(listener: (event: { id: number; result: 'sent' | 'cancelled' }) => void) {
  return DeviceEventEmitter.addListener(CHANGED, listener);
}
