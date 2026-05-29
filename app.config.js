/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const androidGoogleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim() ||
  process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() ||
  '';

module.exports = {
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      config: {
        googleMaps: {
          apiKey: androidGoogleMapsApiKey,
        },
      },
    },
  },
};
