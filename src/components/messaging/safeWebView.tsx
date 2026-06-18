import React from 'react';
import { NativeModules, TurboModuleRegistry } from 'react-native';

type WebViewComponent = React.ComponentType<{
  source: { uri: string };
  style?: object;
  scrollEnabled?: boolean;
  originWhitelist?: string[];
  startInLoadingState?: boolean;
  scalesPageToFit?: boolean;
}>;

let cached: WebViewComponent | null | undefined;

function isWebViewNativeAvailable(): boolean {
  if (NativeModules.RNCWebViewModule != null) return true;
  try {
    return TurboModuleRegistry.get('RNCWebViewModule') != null;
  } catch {
    return false;
  }
}

/** Load WebView only when the native module is present in the current binary. */
export function getSafeWebView(): WebViewComponent | null {
  if (cached !== undefined) return cached;
  if (!isWebViewNativeAvailable()) {
    cached = null;
    return cached;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-webview') as { WebView?: WebViewComponent };
  cached = mod?.WebView ?? null;
  return cached;
}
