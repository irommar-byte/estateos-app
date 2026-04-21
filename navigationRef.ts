import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

let pendingNavigation = null;

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as never, params as never);
  } else {
    console.log('⚠️ NAV NOT READY - zapisuję akcję');
    pendingNavigation = { name, params };
  }
}

export function flushNavigation() {
  if (pendingNavigation && navigationRef.isReady()) {
    console.log('🚀 WYKONUJĘ OPÓŹNIONĄ NAWIGACJĘ');
    navigationRef.navigate(pendingNavigation.name as never, pendingNavigation.params as never);
    pendingNavigation = null;
  }
}
