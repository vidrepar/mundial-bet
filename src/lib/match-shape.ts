import type { Bet, Match, Odds } from "@/db/schema.types";

/* turn a DB match row into a JSON-safe object the client can consume.
 * Dates become ISO strings + epoch ms; betting lock is computed here. */
export function shapeMatch(
  m: Match,
  opts: {
    myBet?: Bet | null;
    betCount?: number;
    commentCount?: number;
    odds?: Odds | null;
    nowMs?: number;
  } = {},
) {
  const nowMs = opts.nowMs ?? Date.now();
  const kickoffMs = m.kickoffUtc.getTime();
  const locked = m.finished || nowMs >= kickoffMs;
  return {
    id: m.id,
    matchNumber: m.matchNumber,
    stage: m.stage,
    stageLabel: m.stageLabel,
    groupName: m.groupName,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeFlag: m.homeFlag,
    awayFlag: m.awayFlag,
    venue: m.venue,
    kickoff: m.kickoffUtc.toISOString(),
    kickoffMs,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    finished: m.finished,
    locked,
    myBet: opts.myBet
      ? {
          predHome: opts.myBet.predHome,
          predAway: opts.myBet.predAway,
          points: opts.myBet.points,
        }
      : null,
    betCount: opts.betCount ?? 0,
    commentCount: opts.commentCount ?? 0,
    odds: opts.odds
      ? {
          provider: opts.odds.provider,
          home: opts.odds.homeDec,
          draw: opts.odds.drawDec,
          away: opts.odds.awayDec,
        }
      : null,
  };
}
