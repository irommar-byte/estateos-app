import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
type PendingNavigation = { name: string; params?: any } | null;
let pendingNavigation: PendingNavigation = null;

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(CommonActions.navigate({ name, params }));
  } else {
    if (__DEV__) console.warn('[nav] not ready, deferring:', name);
    pendingNavigation = { name, params };
  }
}

export function flushNavigation() {
  if (pendingNavigation && navigationRef.isReady()) {
    if (__DEV__) console.warn('[nav] flushing deferred:', pendingNavigation.name);
    navigationRef.dispatch(CommonActions.navigate({ name: pendingNavigation.name, params: pendingNavigation.params }));
    pendingNavigation = null;
  }
}
