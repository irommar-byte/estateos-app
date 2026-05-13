/**
 * Universal Links (iOS) i App Links (Android) — treść z ENV, bez ręcznej edycji plików na dysku.
 */

const DEFAULT_IOS_BUNDLE = 'pl.estateos.app';
const DEFAULT_ANDROID_PKG = 'pl.estateos.app';

export function buildAppleAppSiteAssociation(): Record<string, unknown> {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const bundleId = process.env.IOS_BUNDLE_ID?.trim() || DEFAULT_IOS_BUNDLE;
  const appId = teamId
    ? `${teamId}.${bundleId}`
    : `REPLACE_APPLE_TEAM_ID.${bundleId}`;

  return {
    applinks: {
      apps: [],
      details: [
        {
          appID: appId,
          paths: ['/o/*', '/offer/*', '/oferta/*'],
        },
      ],
    },
    webcredentials: {
      apps: [appId],
    },
  };
}

export function buildAssetLinks(): unknown[] {
  const pkg =
    process.env.ANDROID_PACKAGE_NAME?.trim() || DEFAULT_ANDROID_PKG;
  const raw =
    process.env.ANDROID_SHA256_CERT_FINGERPRINT?.trim() ||
    process.env.ANDROID_SHA256_RELEASE_SIGNING_CERT?.trim();

  const fingerprints = raw
    ? raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : ['REPLACE_SHA256_RELEASE_SIGNING_CERT'];

  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: pkg,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
