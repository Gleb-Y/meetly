/** Delta applied when attendance is confirmed by organizer (participant). */
export const KARMA_DELTA_ATTEND = 0.5;

/** Penalty when participant was marked as joined but not confirmed after finalize window. */
export const KARMA_NO_SHOW_PENALTY = 0.5;

export const KARMA_MIN_RATING = 1.0;

export const KARMA_MAX_RATING = 5.0;

export function applyKarmaDelta(rating: number, delta: number): number {
  const next = rating + delta;
  return Math.min(KARMA_MAX_RATING, Math.max(KARMA_MIN_RATING, next));
}
