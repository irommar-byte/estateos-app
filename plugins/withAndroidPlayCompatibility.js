const { withAndroidManifest } = require('expo/config-plugins');

/** Play Console: brak twardego portrait + resizeableActivity dla dużych ekranów (Android 16+). */
function withAndroidPlayCompatibility(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app?.activity) return cfg;

    for (const activity of app.activity) {
      const name = String(activity.$?.['android:name'] || '');
      if (
        name.endsWith('.MainActivity') ||
        name.includes('GmsBarcodeScanningDelegateActivity')
      ) {
        delete activity.$['android:screenOrientation'];
      }
    }

    app.$['android:resizeableActivity'] = 'true';
    return cfg;
  });
}

module.exports = withAndroidPlayCompatibility;
