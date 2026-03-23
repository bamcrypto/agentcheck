import { RATING_BUCKETS } from '../config/weights.js';

export type Rating = 'strong_buy' | 'buy' | 'hold' | 'overvalued' | 'avoid';

export interface RatingInfo {
  rating: Rating;
  label: string;
  description: string;
}

/**
 * Map a thesis score (0-100) to a rating bucket.
 */
export function scoreToRating(score: number): RatingInfo {
  if (score >= RATING_BUCKETS.STRONG_BUY.min) {
    return {
      rating: 'strong_buy',
      label: 'Strong Buy',
      description: RATING_BUCKETS.STRONG_BUY.description,
    };
  }
  if (score >= RATING_BUCKETS.BUY.min) {
    return {
      rating: 'buy',
      label: 'Buy',
      description: RATING_BUCKETS.BUY.description,
    };
  }
  if (score >= RATING_BUCKETS.HOLD.min) {
    return {
      rating: 'hold',
      label: 'Hold',
      description: RATING_BUCKETS.HOLD.description,
    };
  }
  if (score >= RATING_BUCKETS.OVERVALUED.min) {
    return {
      rating: 'overvalued',
      label: 'Overvalued',
      description: RATING_BUCKETS.OVERVALUED.description,
    };
  }
  return {
    rating: 'avoid',
    label: 'Avoid',
    description: RATING_BUCKETS.AVOID.description,
  };
}
