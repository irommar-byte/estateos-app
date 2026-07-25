import { CommonActions, StackActions } from '@react-navigation/native';
import { navigationRef } from '../../navigationRef';

export type ContactChatParams = {
  threadId: number;
  peerUserId: number;
  peerName: string;
  peerIsOnline?: boolean;
  peerLastSeenAt?: string | null;
};

type NavigationLike = {
  dispatch: (action: ReturnType<typeof StackActions.push> | ReturnType<typeof CommonActions.navigate>) => void;
  getState?: () => ReturnType<typeof navigationRef.getRootState>;
};

function getFocusedRoute(state: ReturnType<typeof navigationRef.getRootState> | undefined) {
  if (!state?.routes?.length) return null;
  let route = state.routes[state.index ?? state.routes.length - 1];
  while (route?.state?.routes?.length) {
    const inner = route.state;
    route = inner.routes[inner.index ?? inner.routes.length - 1];
  }
  return route ?? null;
}

/** Otwiera czat — push z animacją gdy już jesteś w innym wątku ContactChat. */
export function navigateToContactChat(
  navigation: NavigationLike,
  params: ContactChatParams,
) {
  const state = navigation.getState?.() ?? (navigationRef.isReady() ? navigationRef.getRootState() : undefined);
  const focused = getFocusedRoute(state);
  const onContactChat = focused?.name === 'ContactChat';
  const sameThread = onContactChat && Number(focused?.params?.threadId) === params.threadId;

  if (sameThread) return;

  if (onContactChat) {
    navigation.dispatch(StackActions.push('ContactChat', params));
    return;
  }

  navigation.dispatch(
    CommonActions.navigate({
      name: 'ContactChat',
      params,
    }),
  );
}
