import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

type CarAztecCameraScannerProps = {
  loading: boolean;
  scanned: boolean;
  onBarcode: (payload: string) => void;
  onCancel: () => void;
};

export default function CarAztecCameraScanner({
  loading,
  scanned,
  onBarcode,
  onCancel,
}: CarAztecCameraScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [requesting, setRequesting] = useState(false);

  if (!permission?.granted) {
    return (
      <View style={styles.permissionBox}>
        <Text style={styles.permissionText}>Potrzebujemy dostępu do aparatu, aby odczytać kod Aztec z dowodu.</Text>
        <Pressable
          disabled={requesting}
          onPress={() => {
            setRequesting(true);
            void requestPermission().finally(() => setRequesting(false));
          }}
          style={styles.permissionBtn}
        >
          {requesting ? (
            <ActivityIndicator color="#BAE6FD" />
          ) : (
            <Text style={styles.permissionLabel}>Zezwól na aparat</Text>
          )}
        </Pressable>
        <Pressable onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelLabel}>Anuluj</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Text style={styles.title}>Skieruj aparat na kod Aztec</Text>
      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['aztec'] }}
          onBarcodeScanned={
            scanned || loading
              ? undefined
              : ({ data }) => {
                  if (!data) return;
                  onBarcode(data);
                }
          }
        />
      </View>
      {loading ? <ActivityIndicator color="#7DD3FC" style={{ marginTop: 12 }} /> : null}
      <Pressable onPress={onCancel} style={styles.cancelBtn}>
        <Text style={styles.cancelLabel}>Anuluj skanowanie</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
  },
  cameraWrap: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  camera: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  permissionBox: {
    gap: 12,
  },
  permissionText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
  permissionBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.4)',
    backgroundColor: 'rgba(14,116,144,0.25)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  permissionLabel: {
    color: '#BAE6FD',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cancelBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
