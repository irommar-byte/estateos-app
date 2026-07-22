import { ESTATEOS_SITE_URL } from '@/lib/estateOsPublicFacts';

export type CampaignChannel =
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'google'
  | 'email'
  | 'press'
  | 'partner'
  | 'producthunt';

export type CampaignAudience = 'agency' | 'private' | 'general' | 'car';

const LANDING_PATH: Record<CampaignAudience, string> = {
  agency: '/dla-agencji',
  private: '/dla-prywatnych',
  general: '/start',
  car: '/cars/start',
};

export function buildCampaignUrl(
  channel: CampaignChannel,
  audience: CampaignAudience = 'general',
  campaign = 'launch-2026',
): string {
  const base = `${ESTATEOS_SITE_URL}${LANDING_PATH[audience]}`;
  const params = new URLSearchParams({
    utm_source: channel,
    utm_medium: channel === 'google' ? 'cpc' : 'social',
    utm_campaign: campaign,
    utm_content: audience,
  });
  return `${base}?${params.toString()}`;
}

export function buildCarsCampaignUrl(
  channel: CampaignChannel,
  target: 'start' | 'add' = 'add',
  campaign = 'cars-sell-2026',
): string {
  const base = `${ESTATEOS_SITE_URL}${target === 'add' ? '/cars/dodaj' : '/cars/start'}`;
  const params = new URLSearchParams({
    utm_source: channel,
    utm_medium: channel === 'google' ? 'cpc' : 'social',
    utm_campaign: campaign,
    utm_content: 'car',
  });
  return `${base}?${params.toString()}`;
}

export function buildFreeListingCampaignUrl(
  channel: CampaignChannel,
  target: 'hub' | 'home' | 'car' = 'hub',
  campaign = 'free-list-2026',
): string {
  const path =
    target === 'home'
      ? '/wystaw-nieruchomosc-za-darmo'
      : target === 'car'
        ? '/cars/start'
        : '/wystaw-za-darmo';
  const params = new URLSearchParams({
    utm_source: channel,
    utm_medium: channel === 'google' ? 'cpc' : 'social',
    utm_campaign: campaign,
    utm_content: target,
  });
  return `${ESTATEOS_SITE_URL}${path}?${params.toString()}`;
}

/** Gotowe linki do wklejenia w posty i reklamy. */
export const CAMPAIGN_LINK_PRESETS = {
  linkedinAgency: buildCampaignUrl('linkedin', 'agency'),
  facebookAgency: buildCampaignUrl('facebook', 'agency'),
  instagramPrivate: buildCampaignUrl('instagram', 'private'),
  googleAgency: buildCampaignUrl('google', 'agency'),
  emailGeneral: buildCampaignUrl('email', 'general', 'newsletter-01'),
  productHunt: buildCampaignUrl('producthunt', 'general', 'product-hunt'),
  pressKit: `${ESTATEOS_SITE_URL}/dla-prasy`,
  carsStart: `${ESTATEOS_SITE_URL}/cars/start`,
  carsAddListing: buildCarsCampaignUrl('email', 'add'),
  carsCatalog: `${ESTATEOS_SITE_URL}/cars`,
  carsAdd: `${ESTATEOS_SITE_URL}/cars/dodaj`,
  carsPressKit: `${ESTATEOS_SITE_URL}/dla-prasy/samochody`,
  carsLinkedIn: buildCarsCampaignUrl('linkedin', 'add'),
  carsFacebook: buildCarsCampaignUrl('facebook', 'add'),
  carsInstagram: buildCarsCampaignUrl('instagram', 'add'),
  carsEmail: buildCarsCampaignUrl('email', 'add'),
  freeListingHub: `${ESTATEOS_SITE_URL}/wystaw-za-darmo`,
  freeListingPress: `${ESTATEOS_SITE_URL}/dla-prasy/wystaw-za-darmo`,
  freeListingGoogle: buildFreeListingCampaignUrl('google', 'hub'),
  freeListingFacebook: buildFreeListingCampaignUrl('facebook', 'hub'),
  freeListingLinkedIn: buildFreeListingCampaignUrl('linkedin', 'hub'),
  freeListingInstagram: buildFreeListingCampaignUrl('instagram', 'hub'),
  freeHomeGoogle: buildFreeListingCampaignUrl('google', 'home'),
  freeCarGoogle: buildFreeListingCampaignUrl('google', 'car'),
  freeHomeFacebook: buildFreeListingCampaignUrl('facebook', 'home'),
  freeCarFacebook: buildFreeListingCampaignUrl('facebook', 'car'),
  appStore: 'https://apps.apple.com/app/id6762899098',
  playStore: 'https://play.google.com/store/apps/details?id=pl.estateos.mobile',
} as const;
