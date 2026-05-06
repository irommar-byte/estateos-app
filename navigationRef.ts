import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
type PendingNavigation = { name: string; params?: any } | null;
let pendingNavigation: PendingNavigation = null;

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(CommonActions.navigate({ name, params }));
  } else {
    console.log('⚠️ NAV NOT READY - zapisuję akcję');
    pendingNavigation = { name, params };
  }
}

export function flushNavigation() {
  if (pendingNavigation && navigationRef.isReady()) {
    console.log('🚀 WYKONUJĘ OPÓŹNIONĄ NAWIGACJĘ');
    navigationRef.dispatch(CommonActions.navigate({ name: pendingNavigation.name, params: pendingNavigation.params }));
    pendingNavigation = null;
  }
}
