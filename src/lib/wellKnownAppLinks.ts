import { logEvent } from '@/lib/observability';

const DEFAULT_APPLE_TEAM_ID = 'NW3YW69KL9';
const DEFAULT_IOS_BUNDLE = 'pl.estateos.app';

export function getCanonicalAppleAppId(): string {
  const teamId = process.env.APPLE_TEAM_ID?.trim() || DEFAULT_APPLE_TEAM_ID;
  const bundleId = process.env.IOS_BUNDLE_ID?.trim() || DEFAULT_IOS_BUNDLE;
  return `${teamId}.${bundleId}`;
}

export function buildAppleAppSiteAssociation(): Record<string, unknown> {
  const appId = getCanonicalAppleAppId();

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
  const pkg = process.env.ANDROID_PACKAGE_NAME?.trim();
  const raw =
    process.env.ANDROID_SHA256_CERT_FINGERPRINT?.trim() ||
    process.env.ANDROID_SHA256_RELEASE_SIGNING_CERT?.trim();

  const fingerprints = raw
    ? raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (!pkg || fingerprints.length === 0) {
    logEvent('warn', 'assetlinks_missing_env', 'wellKnown.buildAssetLinks', {
      hasPackageName: Boolean(pkg),
      fingerprintsCount: fingerprints.length,
    });
    return [];
  }

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
