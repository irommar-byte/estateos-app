import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getAppVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const iosBuild = Constants.expoConfig?.ios?.buildNumber;
  const androidBuild = Constants.expoConfig?.android?.versionCode;
  const build =
    Platform.OS === 'ios'
      ? iosBuild
      : Platform.OS === 'android'
        ? androidBuild != null
          ? String(androidBuild)
          : null
        : null;
  return build ? `${version} (${build})` : version;
}
