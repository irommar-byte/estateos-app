const { withAndroidManifest, withStringsXml } = require('expo/config-plugins');

const ASSET_LINKS_URL = 'https://estateos.pl/.well-known/assetlinks.json';
const ASSET_STATEMENTS_JSON = JSON.stringify([{ include: ASSET_LINKS_URL }]);

function ensureStringArray(resources) {
  if (!resources.string) {
    resources.string = [];
    return resources.string;
  }
  return Array.isArray(resources.string) ? resources.string : [resources.string];
}

/** Wymagane przez Credential Manager / Passkey na Androidzie (Digital Asset Links). */
function withAndroidPasskeyAssetLinks(config) {
  config = withStringsXml(config, (cfg) => {
    const mod = cfg.modResults;
    if (!mod.resources) mod.resources = {};
    const strings = ensureStringArray(mod.resources);
    const without = strings.filter((item) => item?.$?.name !== 'asset_statements');
    without.push({
      $: { name: 'asset_statements', translatable: 'false' },
      _: ASSET_STATEMENTS_JSON,
    });
    mod.resources.string = without;
    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) return cfg;

    if (!app['meta-data']) app['meta-data'] = [];
    const exists = app['meta-data'].some(
      (item) => item.$?.['android:name'] === 'asset_statements',
    );
    if (!exists) {
      app['meta-data'].push({
        $: {
          'android:name': 'asset_statements',
          'android:resource': '@string/asset_statements',
        },
      });
    }
    return cfg;
  });

  return config;
}

module.exports = withAndroidPasskeyAssetLinks;
