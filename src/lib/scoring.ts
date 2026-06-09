/* Toto-style scoring. Tweakable later per the user's request.
 *   3 pts → exact scoreline
 *   1 pt  → correct outcome (home win / draw / away win) but wrong score
 *   0 pts → wrong outcome
 */
export const POINTS = { EXACT: 3, OUTCOME: 1, MISS: 0 } as const;

type Outcome = "home" | "draw" | "away";

export function outcome(home: number, away: number): Outcome {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

export function scoreBet(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number,
): number {
  if (predHome === actualHome && predAway === actualAway) return POINTS.EXACT;
  if (outcome(predHome, predAway) === outcome(actualHome, actualAway))
    return POINTS.OUTCOME;
  return POINTS.MISS;
}

/* Human label for a finished bet's result — used in UI/badges. */
export function resultLabel(points: number): "exact" | "outcome" | "miss" {
  if (points >= POINTS.EXACT) return "exact";
  if (points >= POINTS.OUTCOME) return "outcome";
  return "miss";
}
