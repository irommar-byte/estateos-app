import { LRUCache } from 'lru-cache';

export default function rateLimit(options: { interval: number; uniqueTokenPerInterval: number }) {
  const tokenCache = new LRUCache({
    max: options.uniqueTokenPerInterval || 500,
    ttl: options.interval || 60000,
  });

  return {
    check: (limit: number, token: string) => {
      const tokenCount = (tokenCache.get(token) as number) || 0;
      if (tokenCount === 0) {
        tokenCache.set(token, 1);
      } else {
        tokenCache.set(token, tokenCount + 1);
      }
      const isRateLimited = tokenCount + 1 > limit;
      return { isRateLimited, currentUsage: tokenCount + 1 };
    },
  };
}
