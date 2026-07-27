import { DeviceEventEmitter } from 'react-native';

export const DISCOVERY_UPDATED_EVENT = 'estateos:discovery-updated';
export const INTELLIGENCE_LEARN_EVENT = 'estateos:intelligence-learn';

export type DiscoveryUpdatedDetail = {
  offerId?: number;
  eventType?: string;
};

export type IntelligenceLearnDetail = {
  offerId?: number;
  eventType?: string;
  kind?: 'like' | 'dislike' | 'serious' | 'open' | 'other';
};

function learnKind(eventType?: string): IntelligenceLearnDetail['kind'] {
  const t = String(eventType || '').toUpperCase();
  if (t.includes('LIKE') && !t.includes('DISLIKE')) return 'like';
  if (t.includes('DISLIKE')) return 'dislike';
  if (t.includes('SERIOUS') || t.includes('PRIORITY')) return 'serious';
  if (t.includes('OPEN')) return 'open';
  return 'other';
}

/** Broadcast after taste decisions so Lustro / For You / Pulse reload. */
export function dispatchDiscoveryUpdated(detail?: DiscoveryUpdatedDetail) {
  DeviceEventEmitter.emit(DISCOVERY_UPDATED_EVENT, detail || {});
  const eventType = detail?.eventType;
  if (!eventType) return;
  const kind = learnKind(eventType);
  if (kind === 'like' || kind === 'dislike' || kind === 'serious') {
    DeviceEventEmitter.emit(INTELLIGENCE_LEARN_EVENT, {
      offerId: detail?.offerId,
      eventType,
      kind,
    } satisfies IntelligenceLearnDetail);
  }
}

export function subscribeDiscoveryUpdated(handler: (detail?: DiscoveryUpdatedDetail) => void) {
  const sub = DeviceEventEmitter.addListener(DISCOVERY_UPDATED_EVENT, handler);
  return () => sub.remove();
}

/** Water-splash cue for the Inteligence orb when the algorithm learns a taste signal. */
export function subscribeIntelligenceLearn(handler: (detail?: IntelligenceLearnDetail) => void) {
  const sub = DeviceEventEmitter.addListener(INTELLIGENCE_LEARN_EVENT, handler);
  return () => sub.remove();
}
