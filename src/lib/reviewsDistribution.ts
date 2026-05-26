export type ReviewsDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

export function buildReviewsDistribution(reviews: unknown[]): {
  distribution: ReviewsDistribution;
  totalReviews: number;
  averageRating: number;
} {
  const distribution: ReviewsDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const list = Array.isArray(reviews) ? reviews : [];
  for (const r of list) {
    const stars = Math.min(5, Math.max(1, Math.round(Number((r as { rating?: number })?.rating || 0))));
    if (stars >= 1 && stars <= 5) distribution[stars as 1 | 2 | 3 | 4 | 5] += 1;
  }
  const totalReviews = list.length;
  const averageRating =
    totalReviews > 0
      ? list.reduce((acc, r) => acc + Number((r as { rating?: number })?.rating || 0), 0) / totalReviews
      : 0;
  return { distribution, totalReviews, averageRating };
}
