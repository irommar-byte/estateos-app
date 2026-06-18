import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  MAX_CONTACT_FILE_BYTES,
  MAX_CONTACT_THREAD_BYTES,
} from './contactAttachment';

export type ContactPendingFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

export type ContactAttachLabels = {
  title: string;
  gallery: string;
  camera: string;
  file: string;
  cancel: string;
  cameraPermission: string;
  limitTitle: string;
  fileTooLarge: string;
  threadFull: string;
  pickFailed: string;
};

function validateSize(
  size: number,
  usageBytes: number,
  limitBytes: number,
  labels: Pick<ContactAttachLabels, 'limitTitle' | 'fileTooLarge' | 'threadFull'>,
): string | null {
  if (size > MAX_CONTACT_FILE_BYTES) return labels.fileTooLarge;
  if (usageBytes + size > limitBytes) return labels.threadFull;
  return null;
}

export function createContactAttachmentPickers(
  labels: ContactAttachLabels,
  onPick: (file: ContactPendingFile) => void,
  usageBytes = 0,
  limitBytes = MAX_CONTACT_THREAD_BYTES,
) {
  const pickGallery = () => {
    void (async () => {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.92,
          allowsMultipleSelection: false,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        const size = Number(asset.fileSize || 0);
        const err = validateSize(size, usageBytes, limitBytes, labels);
        if (err) {
          Alert.alert(labels.limitTitle, err);
          return;
        }
        const name = asset.fileName || `zdjecie_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || (name.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/jpeg');
        onPick({ uri: asset.uri, name, mimeType, size });
      } catch {
        Alert.alert(labels.title, labels.pickFailed);
      }
    })();
  };

  const pickCamera = () => {
    void (async () => {
      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(labels.title, labels.cameraPermission);
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.9,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        const size = Number(asset.fileSize || 0);
        const err = validateSize(size, usageBytes, limitBytes, labels);
        if (err) {
          Alert.alert(labels.limitTitle, err);
          return;
        }
        onPick({
          uri: asset.uri,
          name: `zdjecie_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          size,
        });
      } catch {
        Alert.alert(labels.title, labels.pickFailed);
      }
    })();
  };

  const pickFile = () => {
    void (async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          type: '*/*',
          multiple: false,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const file = result.assets[0];
        const size = Number(file.size || 0);
        const err = validateSize(size, usageBytes, limitBytes, labels);
        if (err) {
          Alert.alert(labels.limitTitle, err);
          return;
        }
        onPick({
          uri: file.uri,
          name: file.name || `zalacznik_${Date.now()}`,
          mimeType: file.mimeType || 'application/octet-stream',
          size,
        });
      } catch {
        Alert.alert(labels.title, labels.pickFailed);
      }
    })();
  };

  return { pickGallery, pickCamera, pickFile };
}
