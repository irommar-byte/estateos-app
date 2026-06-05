import React from 'react';
import { Platform } from 'react-native';
import { NativeViewGestureHandler } from 'react-native-gesture-handler';

type Props = {
  children: React.ReactElement;
};

/** iOS: Handler musi owijać MapView bezpośrednio (bez pośredniego View). */
export default function MapGestureHost({ children }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <NativeViewGestureHandler disallowInterruption shouldActivateOnStart>
        {children}
      </NativeViewGestureHandler>
    );
  }

  return children;
}
