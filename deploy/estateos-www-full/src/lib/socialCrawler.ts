export function isSocialShareCrawler(userAgent?: string | null): boolean {
  return /facebookexternalhit|Facebot|facebookcatalog|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|Iframely|embedly/i.test(
    String(userAgent || ''),
  );
}
