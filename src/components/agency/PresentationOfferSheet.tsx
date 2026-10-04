import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SITE_ORIGIN } from '../../utils/offerShareUrls';

export type PresentationOfferSheetHandle = {
  share: () => Promise<void>;
  print: () => Promise<void>;
};

type Pending = {
  purpose: 'share' | 'print';
  resolve: () => void;
  reject: (error: Error) => void;
};

function sheetUrl(offerId: number, agentId?: number | null) {
  const agent = agentId ? `&agent=${encodeURIComponent(String(agentId))}` : '';
  return `${SITE_ORIGIN}/o/${offerId}/karta?arkusz=1${agent}`;
}

const PresentationOfferSheet = forwardRef<
  PresentationOfferSheetHandle,
  { offerId: number | null; agentId?: number | null }
>(function PresentationOfferSheet({ offerId, agentId }, ref) {
  const webRef = useRef<WebView>(null);
  const pending = useRef<Pending | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<'share' | 'print' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finishPending = (err?: Error) => {
    const job = pending.current;
    pending.current = null;
    setBusy(null);
    if (!job) return;
    if (err) job.reject(err);
    else job.resolve();
  };

  const requestPdf = (purpose: 'share' | 'print') => {
    if (!offerId) return Promise.reject(new Error('Brak oferty'));
    if (!ready || !webRef.current) return Promise.reject(new Error('Ofertówka jeszcze się ładuje'));
    setError(null);
    setBusy(purpose);
    return new Promise<void>((resolve, reject) => {
      pending.current = { purpose, resolve, reject };
      webRef.current?.injectJavaScript('window.estateosExportSheet && window.estateosExportSheet(); true;');
      setTimeout(() => {
        if (pending.current?.purpose === purpose) {
          finishPending(new Error('Nie udało się przygotować ofertówki.'));
        }
      }, 25000);
    });
  };

  useImperativeHandle(ref, () => ({
    share: () => requestPdf('share'),
    print: () => requestPdf('print'),
  }));

  const onMessage = async (raw: string) => {
    let msg: { type?: string; base64?: string; filename?: string; message?: string } = {};
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      setReady(true);
      return;
    }
    if (msg.type === 'error') {
      setError(msg.message || 'Nie udało się przygotować ofertówki.');
      finishPending(new Error(msg.message || 'error'));
      return;
    }
    if (msg.type !== 'file' || !msg.base64) return;
    const job = pending.current;
    if (!job) return;
    try {
      const safeName = String(msg.filename || `estateos-oferta-${offerId}.pdf`).replace(/[^\w.\-ąćęłńóśźż]+/gi, '-');
      const path = `${FileSystem.cacheDirectory || ''}${safeName}`;
      await FileSystem.writeAsStringAsync(path, msg.base64, { encoding: FileSystem.EncodingType.Base64 });
      if (job.purpose === 'print') {
        await Print.printAsync({ uri: path });
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Ofertówka' });
      }
      finishPending();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/cancel|dismiss|abort/i.test(message)) {
        finishPending();
        return;
      }
      setError('Nie udało się otworzyć ofertówki.');
      finishPending(err instanceof Error ? err : new Error('share'));
    }
  };

  if (!offerId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Brak oferty powiązanej z tym pokazem.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        source={{ uri: sheetUrl(offerId, agentId) }}
        style={styles.web}
        originWhitelist={['https://*', 'http://*']}
        setSupportMultipleWindows={false}
        onError={() => {
          setReady(true);
          setError('Nie udało się wczytać ofertówki.');
        }}
        onLoadEnd={() => {
          setTimeout(() => setReady(true), 800);
        }}
        onMessage={(event) => void onMessage(event.nativeEvent.data)}
      />
      {!ready || busy ? (
        <View style={styles.veil} pointerEvents="none">
          <ActivityIndicator color="#fff" />
          <Text style={styles.veilText}>{busy === 'print' ? 'Przygotowuję wydruk…' : busy === 'share' ? 'Przygotowuję plik…' : 'Ofertówka'}</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

export default PresentationOfferSheet;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111113' },
  web: { flex: 1, backgroundColor: '#111113' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  veil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,17,19,0.35)',
    gap: 8,
  },
  veilText: { color: '#fff', fontWeight: '700' },
  error: { color: '#ffb4b4', textAlign: 'center', padding: 8, fontWeight: '700' },
});
