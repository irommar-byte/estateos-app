import { DeviceEventEmitter } from 'react-native';

export const CRM_CLIENTS_CHANGED_EVENT = 'estateos:crm-clients-changed';

export type CrmClientsChangedDetail = {
  archivedIds?: number[];
  reason?: 'archive' | 'restore' | 'create' | 'update';
};

export function emitCrmClientsChanged(detail: CrmClientsChangedDetail = {}) {
  DeviceEventEmitter.emit(CRM_CLIENTS_CHANGED_EVENT, detail);
}

export function onCrmClientsChanged(handler: (detail: CrmClientsChangedDetail) => void) {
  return DeviceEventEmitter.addListener(CRM_CLIENTS_CHANGED_EVENT, handler);
}
