export function isSocialShareCrawler(userAgent?: string | null): boolean {
  return /facebookexternalhit|Facebot|facebookcatalog|facebookplatform|meta-externalagent|meta-externalfetcher|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|Iframely|embedly/i.test(
    String(userAgent || ''),
  );
}
