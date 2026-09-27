import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
  buildEkwOpenBookScript,
  buildEkwSearchUrl,
  buildEkwSubmitSearchScript,
  EKW_SEARCH_URL,
  isEkwBookContentUrl,
  isEkwResultsPageUrl,
  isEkwSearchPageUrl,
  parseLandRegistryForEkw,
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

const EKW_USER_AGENT =
  Platform.OS === 'ios'
    ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MAX_AUTOFILL = 8;
const MAX_LOAD_RETRIES = 2;

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
    return 'Połączenie z portalem EKW zostało przerwane. To częste przy serwisie Ministerstwa — spróbuj ponownie albo otwórz w Safari.';
  }
  if (code === -1200 || code === -1202) {
    return 'Problem z bezpiecznym połączeniem do EKW. Otwórz księgę w Safari.';
  }
  return 'Nie udało się wczytać portalu EKW. Sprawdź sieć albo otwórz księgę w Safari.';
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
  const loadRetries = useRef(0);
  const autoRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(true);
  const [statusHint, setStatusHint] = useState('Ładowanie EKW…');
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [kodMissing, setKodMissing] = useState(false);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  /** Po błędzie sieci ładujemy czysty formularz (bez query) — stabilniejsze na iOS. */
  const [usePlainSearch, setUsePlainSearch] = useState(false);
  const [webKey, setWebKey] = useState(0);

  const parts = useMemo(
    () => (landRegistryNumber ? parseLandRegistryForEkw(landRegistryNumber) : null),
    [landRegistryNumber],
  );

  const searchUri = useMemo(() => {
    if (!parts) return EKW_SEARCH_URL;
    if (usePlainSearch) return EKW_SEARCH_URL;
    return buildEkwSearchUrl(parts);
  }, [parts, usePlainSearch]);

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
    loadRetries.current = 0;
    setLoading(true);
    setNeedsCaptcha(false);
    setKodMissing(false);
    setLoadError(null);
    setUsePlainSearch(false);
    setStatusHint('Ładowanie EKW…');
    setWebKey((k) => k + 1);
  }, [clearAutoRetry]);

  useEffect(() => () => clearAutoRetry(), [clearAutoRetry]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const openInBrowser = useCallback(() => {
    if (!parts) return;
    const url = buildEkwSearchUrl(parts);
    void Linking.openURL(url).catch(() => Alert.alert('Błąd', 'Nie udało się otworzyć EKW.'));
  }, [parts]);

  const retryLoad = useCallback(
    (opts?: { plain?: boolean }) => {
      clearAutoRetry();
      autofillAttempts.current = 0;
      openBookAttempts.current = 0;
      kodVerified.current = false;
      submitted.current = false;
      setLoadError(null);
      setNeedsCaptcha(false);
      setKodMissing(false);
      setLoading(true);
      setStatusHint('Ponawiam połączenie z EKW…');
      if (opts?.plain) setUsePlainSearch(true);
      setWebKey((k) => k + 1);
    },
    [clearAutoRetry],
  );

  const handleLoadFailure = useCallback(
    (err?: LoadError | null) => {
      setLoading(false);
      const code = Number(err?.code);
      const networkish = code === -1005 || code === -1009 || code === -1001 || !code;

      if (networkish && loadRetries.current < MAX_LOAD_RETRIES) {
        loadRetries.current += 1;
        setStatusHint(`Utrata połączenia — ponawiam (${loadRetries.current}/${MAX_LOAD_RETRIES})…`);
        clearAutoRetry();
        autoRetryTimer.current = setTimeout(() => {
          retryLoad({ plain: loadRetries.current >= 1 });
        }, 700);
        return;
      }

      setLoadError(err || { description: 'Połączenie przerwane' });
      setStatusHint(friendlyNetworkMessage(err));
    },
    [clearAutoRetry, retryLoad],
  );

  const runAutofill = useCallback(
    (submit = false) => {
      if (!parts || !webViewRef.current || loadError) return;
      if (autofillAttempts.current >= MAX_AUTOFILL) return;
      autofillAttempts.current += 1;
      setStatusHint(
        submit
          ? 'Szukam księgi…'
          : `Uzupełniam kod wydziału ${parts.kodWydzialu}…`,
      );
      webViewRef.current.injectJavaScript(
        buildEkwAutofillScript(parts, { submit: submit && kodVerified.current }),
      );
    },
    [parts, loadError],
  );

  const runSubmit = useCallback(() => {
    if (!parts || !webViewRef.current || submitted.current || loadError) return;
    if (!kodVerified.current) return;
    submitted.current = true;
    setStatusHint('Szukam księgi…');
    webViewRef.current.injectJavaScript(buildEkwSubmitSearchScript(parts));
  }, [parts, loadError]);

  const runOpenBook = useCallback(() => {
    if (!webViewRef.current || loadError) return;
    if (openBookAttempts.current >= 3) return;
    openBookAttempts.current += 1;
    webViewRef.current.injectJavaScript(buildEkwOpenBookScript());
  }, [loadError]);

  const handleNavigation = useCallback(
    (navState: { url?: string; loading?: boolean }) => {
      if (loadError) return;
      const url = String(navState?.url || '');
      if (!url) return;

      if (isEkwBookContentUrl(url)) {
        setStatusHint('Księga wieczysta — przewiń, aby zobaczyć działy I–IV.');
        setNeedsCaptcha(false);
        setKodMissing(false);
        setLoading(Boolean(navState.loading));
        return;
      }

      if (isEkwResultsPageUrl(url)) {
        setStatusHint('Otwieranie treści księgi…');
        setNeedsCaptcha(false);
        setKodMissing(false);
        setTimeout(() => runOpenBook(), 400);
        setLoading(Boolean(navState.loading));
        return;
      }

      if (isEkwSearchPageUrl(url)) {
        if (!navState.loading) {
          setTimeout(() => runAutofill(false), 450);
          setTimeout(() => runAutofill(false), 1000);
          setTimeout(() => runAutofill(false), 1800);
        }
      }

      setLoading(Boolean(navState.loading));
    },
    [loadError, runAutofill, runOpenBook],
  );

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      const data = String(event.nativeEvent.data || '');
      if (data === 'captcha') {
        setNeedsCaptcha(true);
        setStatusHint('Wpisz kod z obrazka i naciśnij Szukaj — numer KW jest już uzupełniony.');
        return;
      }
      if (data === 'ekw:ok') {
        kodVerified.current = true;
        setKodMissing(false);
        setStatusHint(`Kod ${parts?.kodWydzialu || ''} uzupełniony.`);
        if (!needsCaptcha) {
          setTimeout(() => runSubmit(), 320);
        }
        return;
      }
      if (data === 'ekw:kod_missing') {
        setKodMissing(true);
        setStatusHint(
          `Nie udało się ustawić kodu wydziału (${parts?.kodWydzialu || '—'}). Wybierz go z listy albo wpisz ręcznie, potem Szukaj.`,
        );
        if (autofillAttempts.current < MAX_AUTOFILL) {
          setTimeout(() => runAutofill(false), 500);
        }
      }
    },
    [needsCaptcha, parts?.kodWydzialu, runAutofill, runSubmit],
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
            Brak modułu WebView w tej wersji aplikacji.
          </Text>
          <Pressable
            onPress={() => {
              openInBrowser();
              handleClose();
            }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Otwórz w Safari</Text>
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
            <Text style={[styles.hint, { color: theme.subtitle }]} numberOfLines={3}>
              {statusHint}
            </Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeIcon} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        {needsCaptcha ? (
          <View style={[styles.captchaBanner, { backgroundColor: isDark ? 'rgba(255,159,10,0.15)' : 'rgba(255,159,10,0.12)' }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#FF9500" />
            <Text style={styles.captchaText}>
              Portal EKW wymaga kodu z obrazka — wpisz go poniżej i naciśnij „Szukaj”.
            </Text>
          </View>
        ) : null}

        {kodMissing && !needsCaptcha && !loadError ? (
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
          {loading && !loadError ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : null}

          {loadError ? (
            <View style={[styles.errorPanel, { backgroundColor: isDark ? '#111' : '#F8FAFC' }]}>
              <View style={styles.errorIconWrap}>
                <Ionicons name="cloud-offline-outline" size={36} color="#007AFF" />
              </View>
              <Text style={[styles.errorTitle, { color: theme.text }]}>Nie udało się wczytać EKW</Text>
              <Text style={[styles.errorBody, { color: theme.subtitle }]}>
                {friendlyNetworkMessage(loadError)}
              </Text>
              <Pressable onPress={() => retryLoad({ plain: true })} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Spróbuj ponownie</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  openInBrowser();
                }}
                style={[styles.secondaryBtn, { borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' }]}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Otwórz w Safari</Text>
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
              cacheEnabled={false}
              setSupportMultipleWindows={false}
              allowsBackForwardNavigationGestures
              userAgent={EKW_USER_AGENT}
              onLoadStart={() => {
                setLoading(true);
                setLoadError(null);
              }}
              onLoadEnd={() => {
                setLoading(false);
                runAutofill(false);
              }}
              onNavigationStateChange={handleNavigation}
              onMessage={handleMessage}
              onError={(event: { nativeEvent?: LoadError }) => {
                handleLoadFailure(event?.nativeEvent || null);
              }}
              onHttpError={(event: { nativeEvent?: { statusCode?: number } }) => {
                const status = Number(event?.nativeEvent?.statusCode || 0);
                if (status >= 500 || status === 408 || status === 429) {
                  handleLoadFailure({
                    code: status,
                    description: `HTTP ${status}`,
                  });
                }
              }}
              renderError={(_domain: string, code: number, description: string) => (
                <View style={[styles.errorPanel, { backgroundColor: '#F8FAFC', flex: 1 }]}>
                  <View style={styles.errorIconWrap}>
                    <Ionicons name="cloud-offline-outline" size={36} color="#007AFF" />
                  </View>
                  <Text style={[styles.errorTitle, { color: '#111' }]}>Połączenie z EKW przerwane</Text>
                  <Text style={[styles.errorBody, { color: '#6B7280' }]}>
                    {friendlyNetworkMessage({ code, description, domain: _domain })}
                  </Text>
                  <Pressable onPress={() => retryLoad({ plain: true })} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Spróbuj ponownie</Text>
                  </Pressable>
                  <Pressable
                    onPress={openInBrowser}
                    style={[styles.secondaryBtn, { borderColor: 'rgba(0,0,0,0.12)' }]}
                  >
                    <Text style={[styles.secondaryBtnText, { color: '#111' }]}>Otwórz w Safari</Text>
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
    backgroundColor: 'rgba(255,255,255,0.65)',
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
    minWidth: 200,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    marginTop: 12,
    alignSelf: 'center',
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryBtnText: { fontWeight: '800', fontSize: 15 },
});
