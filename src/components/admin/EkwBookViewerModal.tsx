import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildEkwAutofillScript,
  buildEkwGateWatchScript,
  buildEkwOpenBookScript,
  buildEkwSearchUrl,
  buildEkwSubmitSearchScript,
  EKW_SEARCH_URL,
  isEkwBookContentUrl,
  isEkwResultsPageUrl,
  isEkwSearchPageUrl,
  parseLandRegistryForEkw,
  resolveEkwStatusAfterMessage,
  shouldLoadEkwUrlInWebView,
} from '../../utils/ekwBrowser';

type Theme = {
  background: string;
  text: string;
  subtitle: string;
  glass: 'dark' | 'light';
};

type Props = {
  visible: boolean;
  landRegistryNumber: string | null;
  onClose: () => void;
  theme: Theme;
  /** `overlay` — warstwa wewnątrz już otwartego Modala (iOS nie pokazuje zagnieżdżonego Modala). */
  presentation?: 'modal' | 'overlay';
};

type WebViewHandle = {
  injectJavaScript: (script: string) => void;
  reload: () => void;
};

type LoadError = {
  code?: number;
  description?: string;
  domain?: string;
};

/** iPad Safari UA — Imperva mniej agresywnie niż „goły” WebView / desktop mismatch. */
const EKW_USER_AGENT =
  Platform.OS === 'ios'
    ? 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const MAX_AUTOFILL = 10;
const MAX_LOAD_RETRIES = 3;

function useEkwWebView() {
  return useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('react-native-webview') as { WebView?: React.ComponentType<Record<string, unknown>> };
      return mod.WebView ?? null;
    } catch {
      return null;
    }
  }, []);
}

function friendlyNetworkMessage(err?: LoadError | null): string {
  const code = Number(err?.code);
  if (code === -1005 || code === -1009 || code === -1001) {
    return 'Portal EKW urwał połączenie (ochrona Imperva). Zostajemy w okienku — ponawiamy ładowanie.';
  }
  return 'Nie udało się wczytać EKW w okienku. Ponów — bez wychodzenia do Safari.';
}

export default function EkwBookViewerModal({
  visible,
  landRegistryNumber,
  onClose,
  theme,
  presentation = 'modal',
}: Props) {
  const insets = useSafeAreaInsets();
  const isDark = theme.glass === 'dark';
  const WebView = useEkwWebView();
  const webViewRef = useRef<WebViewHandle>(null);
  const autofillAttempts = useRef(0);
  const openBookAttempts = useRef(0);
  const kodVerified = useRef(false);
  const submitted = useRef(false);
  const formReady = useRef(false);
  const loadRetries = useRef(0);
  const autoRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(true);
  const [statusHint, setStatusHint] = useState('Ładowanie EKW w okienku…');
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [needsBotCheck, setNeedsBotCheck] = useState(false);
  const [kodMissing, setKodMissing] = useState(false);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [bookOpened, setBookOpened] = useState(false);
  const [webKey, setWebKey] = useState(0);

  const parts = useMemo(
    () => (landRegistryNumber ? parseLandRegistryForEkw(landRegistryNumber) : null),
    [landRegistryNumber],
  );

  const searchUri = useMemo(() => (parts ? buildEkwSearchUrl(parts) : EKW_SEARCH_URL), [parts]);

  const clearAutoRetry = useCallback(() => {
    if (autoRetryTimer.current) {
      clearTimeout(autoRetryTimer.current);
      autoRetryTimer.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    clearAutoRetry();
    autofillAttempts.current = 0;
    openBookAttempts.current = 0;
    kodVerified.current = false;
    submitted.current = false;
    formReady.current = false;
    loadRetries.current = 0;
    setLoading(true);
    setNeedsCaptcha(false);
    setNeedsBotCheck(false);
    setKodMissing(false);
    setLoadError(null);
    setBookOpened(false);
    setStatusHint('Ładowanie EKW w okienku…');
    setWebKey((k) => k + 1);
  }, [clearAutoRetry]);

  useEffect(() => () => clearAutoRetry(), [clearAutoRetry]);

  useEffect(() => {
    if (visible) resetState();
  }, [visible, landRegistryNumber, resetState]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const retryLoad = useCallback(() => {
    clearAutoRetry();
    autofillAttempts.current = 0;
    openBookAttempts.current = 0;
    kodVerified.current = false;
    submitted.current = false;
    formReady.current = false;
    setLoadError(null);
    setNeedsCaptcha(false);
    setNeedsBotCheck(false);
    setKodMissing(false);
    setBookOpened(false);
    setLoading(true);
    setStatusHint('Ponawiam EKW w okienku…');
    setWebKey((k) => k + 1);
  }, [clearAutoRetry]);

  const handleLoadFailure = useCallback(
    (err?: LoadError | null) => {
      setLoading(false);
      const code = Number(err?.code);
      const networkish = code === -1005 || code === -1009 || code === -1001 || !code;

      if (networkish && loadRetries.current < MAX_LOAD_RETRIES) {
        loadRetries.current += 1;
        setStatusHint(`Utrata połączenia — ponawiam w okienku (${loadRetries.current}/${MAX_LOAD_RETRIES})…`);
        clearAutoRetry();
        autoRetryTimer.current = setTimeout(() => retryLoad(), 900);
        return;
      }

      setLoadError(err || { description: 'Połączenie przerwane' });
      setStatusHint(friendlyNetworkMessage(err));
    },
    [clearAutoRetry, retryLoad],
  );

  const injectGateWatch = useCallback(() => {
    webViewRef.current?.injectJavaScript(buildEkwGateWatchScript());
  }, []);

  const runAutofill = useCallback(
    (submit = false) => {
      if (!parts || !webViewRef.current || loadError) return;
      if (!formReady.current) return;
      if (autofillAttempts.current >= MAX_AUTOFILL) return;
      autofillAttempts.current += 1;
      setStatusHint(
        submit
          ? 'Szukam księgi…'
          : `Uzupełniam ${parts.kodWydzialu}/${parts.nrKw}/${parts.cyfraK}…`,
      );
      webViewRef.current.injectJavaScript(
        buildEkwAutofillScript(parts, { submit: submit && kodVerified.current }),
      );
    },
    [parts, loadError],
  );

  const runSubmit = useCallback(() => {
    if (!parts || !webViewRef.current || submitted.current || loadError) return;
    if (!kodVerified.current || !formReady.current) return;
    submitted.current = true;
    setStatusHint('Szukam księgi wieczystej…');
    webViewRef.current.injectJavaScript(buildEkwSubmitSearchScript(parts));
  }, [parts, loadError]);

  const runOpenBook = useCallback(() => {
    if (!webViewRef.current || loadError) return;
    if (openBookAttempts.current >= 5) return;
    openBookAttempts.current += 1;
    setStatusHint('Otwieram treść księgi wieczystej…');
    webViewRef.current.injectJavaScript(buildEkwOpenBookScript());
  }, [loadError]);

  const handleNavigation = useCallback(
    (navState: { url?: string; loading?: boolean }) => {
      if (loadError) return;
      const url = String(navState?.url || '');
      if (!url) return;

      if (isEkwBookContentUrl(url)) {
        setBookOpened(true);
        setNeedsBotCheck(false);
        setNeedsCaptcha(false);
        setKodMissing(false);
        setStatusHint('Księga wieczysta — przewiń działy I–IV.');
        setLoading(Boolean(navState.loading));
        return;
      }

      if (isEkwResultsPageUrl(url)) {
        setNeedsBotCheck(false);
        setStatusHint('Wynik wyszukiwania — otwieram treść KW…');
        setTimeout(() => runOpenBook(), 350);
        setTimeout(() => runOpenBook(), 900);
        setTimeout(() => runOpenBook(), 1600);
        setLoading(Boolean(navState.loading));
        return;
      }

      if (isEkwSearchPageUrl(url) && !navState.loading) {
        injectGateWatch();
      }

      setLoading(Boolean(navState.loading));
    },
    [injectGateWatch, loadError, runOpenBook],
  );

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      const data = String(event.nativeEvent.data || '');
      const resolved = resolveEkwStatusAfterMessage(data, parts);
      if (resolved.kind === 'ignore') return;

      if (resolved.kind === 'challenge') {
        formReady.current = false;
        setNeedsBotCheck(true);
        setStatusHint(resolved.hint);
        setLoading(false);
        return;
      }

      if (resolved.kind === 'ready') {
        formReady.current = true;
        setNeedsBotCheck(false);
        setStatusHint(resolved.hint);
        setTimeout(() => runAutofill(false), 200);
        setTimeout(() => runAutofill(false), 700);
        setTimeout(() => runAutofill(false), 1400);
        return;
      }

      if (resolved.kind === 'captcha') {
        setNeedsCaptcha(true);
        setStatusHint(resolved.hint);
        return;
      }

      if (resolved.kind === 'ok') {
        kodVerified.current = true;
        setKodMissing(false);
        setStatusHint(resolved.hint);
        if (!needsCaptcha) {
          setTimeout(() => runSubmit(), 300);
        }
        return;
      }

      if (resolved.kind === 'kod_missing') {
        setKodMissing(true);
        setStatusHint(resolved.hint);
        if (autofillAttempts.current < MAX_AUTOFILL) {
          setTimeout(() => runAutofill(false), 500);
        }
      }
    },
    [needsCaptcha, parts, runAutofill, runSubmit],
  );

  const wrap = (inner: React.ReactNode, sheet: 'pageSheet' | 'fullScreen') => {
    if (presentation === 'overlay') {
      return (
        <View style={[StyleSheet.absoluteFillObject, styles.overlayHost]} pointerEvents="auto">
          {inner}
        </View>
      );
    }
    return (
      <Modal visible animationType="slide" presentationStyle={sheet} onRequestClose={handleClose}>
        {inner}
      </Modal>
    );
  };

  if (!visible) return null;

  if (!parts) {
    return wrap(
      (
        <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + 12, paddingHorizontal: 20 }]}>
          <Text style={[styles.title, { color: theme.text }]}>EKW</Text>
          <Text style={[styles.hint, { color: theme.subtitle }]}>
            Niepoprawny format numeru księgi. Oczekiwany wzór: WA4N/00012345/6
          </Text>
          <Pressable onPress={handleClose} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Zamknij</Text>
          </Pressable>
        </View>
      ),
      'pageSheet',
    );
  }

  if (!WebView) {
    return wrap(
      (
        <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + 12, paddingHorizontal: 20 }]}>
          <Text style={[styles.title, { color: theme.text }]}>Podgląd EKW niedostępny</Text>
          <Text style={[styles.hint, { color: theme.subtitle }]}>
            Brak modułu WebView w tej wersji aplikacji — zaktualizuj build.
          </Text>
          <Pressable onPress={handleClose} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Zamknij</Text>
          </Pressable>
        </View>
      ),
      'pageSheet',
    );
  }

  return wrap(
    (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 8,
              borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: theme.subtitle }]}>ELEKTRONICZNE KSIĘGI WIECZYSTE</Text>
            <Text style={[styles.title, { color: theme.text }]} selectable>
              {landRegistryNumber}
            </Text>
            <Text style={[styles.hint, { color: bookOpened ? '#34C759' : theme.subtitle }]} numberOfLines={3}>
              {statusHint}
            </Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeIcon} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        {needsBotCheck ? (
          <View style={[styles.captchaBanner, { backgroundColor: isDark ? 'rgba(0,122,255,0.18)' : 'rgba(0,122,255,0.1)' }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#007AFF" />
            <Text style={[styles.captchaText, { color: '#007AFF' }]}>
              Kliknij „I am human” / „Nie jestem robotem” w okienku poniżej — zaraz uzupełnimy KW i otworzymy księgę.
            </Text>
          </View>
        ) : null}

        {needsCaptcha ? (
          <View style={[styles.captchaBanner, { backgroundColor: isDark ? 'rgba(255,159,10,0.15)' : 'rgba(255,159,10,0.12)' }]}>
            <Ionicons name="keypad-outline" size={16} color="#FF9500" />
            <Text style={styles.captchaText}>
              Wpisz kod z obrazka w formularzu i naciśnij „Szukaj”.
            </Text>
          </View>
        ) : null}

        {kodMissing && !needsCaptcha && !needsBotCheck && !loadError ? (
          <View style={[styles.captchaBanner, { backgroundColor: isDark ? 'rgba(255,59,48,0.15)' : 'rgba(255,59,48,0.1)' }]}>
            <Ionicons name="alert-circle-outline" size={16} color="#FF3B30" />
            <Text style={[styles.captchaText, { color: '#FF3B30' }]}>
              Wpisz kod wydziału {parts.kodWydzialu} w pierwszym polu, potem „Wyszukaj księgę”.
            </Text>
            <Pressable onPress={() => runAutofill(false)} hitSlop={8}>
              <Text style={{ color: '#007AFF', fontWeight: '800', fontSize: 12 }}>Ponów</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.webWrap}>
          {loading && !loadError && !needsBotCheck ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : null}

          {loadError ? (
            <View style={[styles.errorPanel, { backgroundColor: isDark ? '#111' : '#F8FAFC' }]}>
              <View style={styles.errorIconWrap}>
                <Ionicons name="refresh-circle-outline" size={40} color="#007AFF" />
              </View>
              <Text style={[styles.errorTitle, { color: theme.text }]}>Połączenie z EKW przerwane</Text>
              <Text style={[styles.errorBody, { color: theme.subtitle }]}>
                {friendlyNetworkMessage(loadError)}
              </Text>
              <Pressable onPress={retryLoad} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Załaduj ponownie w okienku</Text>
              </Pressable>
            </View>
          ) : (
            <WebView
              key={webKey}
              ref={webViewRef}
              source={{ uri: searchUri }}
              style={styles.webView}
              originWhitelist={['https://*', 'http://*']}
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              cacheEnabled
              setSupportMultipleWindows={false}
              allowsBackForwardNavigationGestures
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              userAgent={EKW_USER_AGENT}
              applicationNameForUserAgent="Safari"
              onShouldStartLoadWithRequest={(request: { url?: string }) =>
                shouldLoadEkwUrlInWebView(String(request?.url || ''))
              }
              onOpenWindow={(syntheticEvent: { nativeEvent?: { targetUrl?: string } }) => {
                const target = String(syntheticEvent?.nativeEvent?.targetUrl || '');
                if (target && shouldLoadEkwUrlInWebView(target) && webViewRef.current) {
                  // target=_blank → zostań w tym samym WebView, nigdy Safari
                  webViewRef.current.injectJavaScript(
                    `window.location.href=${JSON.stringify(target)}; true;`,
                  );
                }
              }}
              onLoadStart={() => {
                setLoading(true);
                setLoadError(null);
              }}
              onLoadEnd={() => {
                setLoading(false);
                injectGateWatch();
              }}
              onNavigationStateChange={handleNavigation}
              onMessage={handleMessage}
              onContentProcessDidTerminate={() => {
                handleLoadFailure({ code: -1005, description: 'WebContent process terminated' });
              }}
              onError={(event: { nativeEvent?: LoadError }) => {
                handleLoadFailure(event?.nativeEvent || null);
              }}
              onHttpError={(event: { nativeEvent?: { statusCode?: number } }) => {
                const status = Number(event?.nativeEvent?.statusCode || 0);
                if (status >= 500 || status === 408 || status === 429) {
                  handleLoadFailure({ code: status, description: `HTTP ${status}` });
                }
              }}
              renderError={(_domain: string, code: number, description: string) => (
                <View style={[styles.errorPanel, { backgroundColor: '#F8FAFC', flex: 1 }]}>
                  <View style={styles.errorIconWrap}>
                    <Ionicons name="refresh-circle-outline" size={40} color="#007AFF" />
                  </View>
                  <Text style={styles.errorTitle}>Połączenie z EKW przerwane</Text>
                  <Text style={[styles.errorBody, { color: '#6B7280' }]}>
                    {friendlyNetworkMessage({ code, description, domain: _domain })}
                  </Text>
                  <Pressable onPress={retryLoad} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Załaduj ponownie w okienku</Text>
                  </Pressable>
                </View>
              )}
            />
          )}
        </View>
      </View>
    ),
    'fullScreen',
  );
}

const styles = StyleSheet.create({
  overlayHost: { zIndex: 80, elevation: 80 },
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  title: { fontSize: 20, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 12, fontWeight: '500', marginTop: 6, lineHeight: 17 },
  closeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120,120,128,0.16)',
  },
  captchaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  captchaText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#FF9500', lineHeight: 16 },
  webWrap: { flex: 1 },
  webView: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    zIndex: 2,
  },
  errorPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,122,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    color: '#111',
  },
  errorBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 360,
  },
  primaryBtn: {
    marginTop: 22,
    alignSelf: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
    minWidth: 220,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
