/* Slovenian pool scoring.
 * Three correct predictions are worth a point each:
 *   1. winner (home / draw / away)
 *   2. exact home goals  — only counts if the winner (1) is also correct
 *   3. exact away goals  — only counts if the winner (1) is also correct
 * Group stage: 1 pt each → max 3 per match.
 * Knockout (from Round of 32 on): doubled → max 6 per match.
 * No bet placed in time: −1 (group) / −2 (knockout).
 */

type Outcome = "home" | "draw" | "away";

export function outcome(home: number, away: number): Outcome {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

export function isKnockoutStage(stage: string): boolean {
  return stage !== "group";
}

export function missedPenalty(stage: string): number {
  return isKnockoutStage(stage) ? 2 : 1;
}

export function maxPoints(stage: string): number {
  return isKnockoutStage(stage) ? 6 : 3;
}

export function scoreBet(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number,
  stage: string,
): number {
  const mult = isKnockoutStage(stage) ? 2 : 1;
  /* winner wrong → nothing, even if a goal count matches */
  if (outcome(predHome, predAway) !== outcome(actualHome, actualAway)) return 0;
  let pts = 1; // winner correct
  if (predHome === actualHome) pts += 1; // exact home goals
  if (predAway === actualAway) pts += 1; // exact away goals
  return pts * mult;
}

export function isExactScore(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number,
): boolean {
  return predHome === actualHome && predAway === actualAway;
}
