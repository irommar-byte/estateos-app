import { DeviceEventEmitter } from 'react-native';

export const DISCOVERY_UPDATED_EVENT = 'estateos:discovery-updated';

export type DiscoveryUpdatedDetail = {
  offerId?: number;
  eventType?: string;
};

/** Broadcast after taste decisions so Lustro / For You / Pulse reload. */
export function dispatchDiscoveryUpdated(detail?: DiscoveryUpdatedDetail) {
  DeviceEventEmitter.emit(DISCOVERY_UPDATED_EVENT, detail || {});
}

export function subscribeDiscoveryUpdated(handler: (detail?: DiscoveryUpdatedDetail) => void) {
  const sub = DeviceEventEmitter.addListener(DISCOVERY_UPDATED_EVENT, handler);
  return () => sub.remove();
}
