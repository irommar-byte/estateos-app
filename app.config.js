/** @type {import('expo/config').ExpoConfig} */
const { execSync } = require('child_process');
const appJson = require('./app.json');

function gitShortSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const androidGoogleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim() ||
  process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() ||
  '';

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      /** W Release bundle — sprawdzaj: npm run verify:ios-release */
      buildGitSha: gitShortSha(),
    },
    android: {
      ...appJson.expo.android,
      config: {
        googleMaps: {
          apiKey: androidGoogleMapsApiKey,
        },
      },
    },
    plugins: [...(appJson.expo.plugins || []), './plugins/withAndroidPlayCompatibility.js', './plugins/withAndroidPasskeyAssetLinks.js'],
  },
};
