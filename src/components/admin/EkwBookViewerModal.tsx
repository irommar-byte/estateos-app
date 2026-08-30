import React, { useCallback, useMemo, useRef, useState } from 'react';
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
};

const EKW_USER_AGENT =
  Platform.OS === 'ios'
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

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

  const [loading, setLoading] = useState(true);
  const [statusHint, setStatusHint] = useState('Ładowanie EKW…');
  const [needsCaptcha, setNeedsCaptcha] = useState(false);

  const parts = useMemo(
    () => (landRegistryNumber ? parseLandRegistryForEkw(landRegistryNumber) : null),
    [landRegistryNumber],
  );

  const resetState = useCallback(() => {
    autofillAttempts.current = 0;
    openBookAttempts.current = 0;
    setLoading(true);
    setNeedsCaptcha(false);
    setStatusHint('Ładowanie EKW…');
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const runAutofill = useCallback(() => {
    if (!parts || !webViewRef.current) return;
    if (autofillAttempts.current >= 4) return;
    autofillAttempts.current += 1;
    webViewRef.current.injectJavaScript(buildEkwAutofillScript(parts));
  }, [parts]);

  const runOpenBook = useCallback(() => {
    if (!webViewRef.current) return;
    if (openBookAttempts.current >= 3) return;
    openBookAttempts.current += 1;
    webViewRef.current.injectJavaScript(buildEkwOpenBookScript());
  }, []);

  const handleNavigation = useCallback(
    (navState: { url?: string; loading?: boolean }) => {
      const url = String(navState?.url || '');
      if (!url) return;

      if (isEkwBookContentUrl(url)) {
        setStatusHint('Księga wieczysta — przewiń, aby zobaczyć działy I–IV.');
        setNeedsCaptcha(false);
        setLoading(Boolean(navState.loading));
        return;
      }

      if (isEkwResultsPageUrl(url)) {
        setStatusHint('Otwieranie treści księgi…');
        setNeedsCaptcha(false);
        setTimeout(() => runOpenBook(), 400);
        setLoading(Boolean(navState.loading));
        return;
      }

      if (isEkwSearchPageUrl(url)) {
        setStatusHint(
          needsCaptcha
            ? 'Wpisz kod z obrazka i naciśnij Szukaj — numer KW jest już uzupełniony.'
            : 'Uzupełniam numer księgi…',
        );
        if (!navState.loading) setTimeout(() => runAutofill(), 350);
      }

      setLoading(Boolean(navState.loading));
    },
    [needsCaptcha, runAutofill, runOpenBook],
  );

  const openInBrowser = useCallback(() => {
    if (!landRegistryNumber) return;
    const url = `${EKW_SEARCH_URL}?numerKsiegi=${encodeURIComponent(landRegistryNumber)}`;
    void Linking.openURL(url).catch(() => Alert.alert('Błąd', 'Nie udało się otworzyć EKW.'));
  }, [landRegistryNumber]);

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
            <Text style={[styles.hint, { color: theme.subtitle }]} numberOfLines={2}>
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

        <View style={styles.webWrap}>
          {loading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : null}
          <WebView
            ref={webViewRef}
            source={{ uri: EKW_SEARCH_URL }}
            style={styles.webView}
            originWhitelist={['https://*']}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            userAgent={EKW_USER_AGENT}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => {
              setLoading(false);
              runAutofill();
            }}
            onNavigationStateChange={handleNavigation}
            onMessage={(event: { nativeEvent: { data: string } }) => {
              if (event.nativeEvent.data === 'captcha') {
                setNeedsCaptcha(true);
                setStatusHint('Wpisz kod z obrazka i naciśnij Szukaj — numer KW jest już uzupełniony.');
              }
            }}
            onError={() => {
              setLoading(false);
              setStatusHint('Błąd ładowania EKW — sprawdź połączenie.');
            }}
          />
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
  primaryBtn: {
    marginTop: 20,
    alignSelf: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
