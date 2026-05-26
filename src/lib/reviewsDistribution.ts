export type ReviewsDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

type ReviewLike = { rating?: number | null };

function reviewRating(review: unknown): number {
  const raw = (review as ReviewLike)?.rating;
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function buildReviewsDistribution(reviews: unknown[]): {
  distribution: ReviewsDistribution;
  totalReviews: number;
  averageRating: number;
} {
  const distribution: ReviewsDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const list = Array.isArray(reviews) ? reviews : [];
  let ratingSum = 0;
  for (const r of list) {
    const rating = reviewRating(r);
    ratingSum += rating;
    const stars = Math.min(5, Math.max(1, Math.round(rating)));
    if (stars >= 1 && stars <= 5) distribution[stars as 1 | 2 | 3 | 4 | 5] += 1;
  }
  const totalReviews = list.length;
  const averageRating = totalReviews > 0 ? ratingSum / totalReviews : 0;
  return { distribution, totalReviews, averageRating };
}
