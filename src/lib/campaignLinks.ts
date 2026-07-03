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

export type CampaignAudience = 'agency' | 'private' | 'general';

const LANDING_PATH: Record<CampaignAudience, string> = {
  agency: '/dla-agencji',
  private: '/dla-prywatnych',
  general: '/start',
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

/** Gotowe linki do wklejenia w posty i reklamy. */
export const CAMPAIGN_LINK_PRESETS = {
  linkedinAgency: buildCampaignUrl('linkedin', 'agency'),
  facebookAgency: buildCampaignUrl('facebook', 'agency'),
  instagramPrivate: buildCampaignUrl('instagram', 'private'),
  googleAgency: buildCampaignUrl('google', 'agency'),
  emailGeneral: buildCampaignUrl('email', 'general', 'newsletter-01'),
  productHunt: buildCampaignUrl('producthunt', 'general', 'product-hunt'),
  pressKit: `${ESTATEOS_SITE_URL}/dla-prasy`,
  appStore: 'https://apps.apple.com/app/id6762899098',
  playStore: 'https://play.google.com/store/apps/details?id=pl.estateos.mobile',
} as const;
