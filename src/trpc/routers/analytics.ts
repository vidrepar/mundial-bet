import { db } from "@/db";
import { bets, matches, user } from "@/db/schema";
import { isExactScore } from "@/lib/scoring";
import { baseProcedure, createTRPCRouter } from "../init";

export const analyticsRouter = createTRPCRouter({
  summary: baseProcedure.query(() => {
    const users = db.select().from(user).all();
    const allBets = db.select().from(bets).all();
    const allMatches = db.select().from(matches).all();
    const mById = new Map(allMatches.map((m) => [m.id, m]));
    const scored = allBets.filter((b) => b.points != null);

    /* goal appetite + draw tendency per player */
    const goals = users.map((u) => {
      const ub = allBets.filter((b) => b.userId === u.id);
      const totalGoals = ub.reduce((s, b) => s + b.predHome + b.predAway, 0);
      const draws = ub.filter((b) => b.predHome === b.predAway).length;
      return {
        userId: u.id,
        name: u.name,
        image: u.image,
        bets: ub.length,
        avgGoals: ub.length
          ? Math.round((totalGoals / ub.length) * 100) / 100
          : 0,
        drawShare: ub.length ? Math.round((draws / ub.length) * 100) : 0,
      };
    });

    /* clutch — knockout points vs group-stage points */
    const clutch = users.map((u) => {
      const ub = scored.filter((b) => b.userId === u.id);
      let group = 0;
      let ko = 0;
      for (const b of ub) {
        const m = mById.get(b.matchId);
        if (!m) continue;
        if (m.stage === "group") group += b.points ?? 0;
        else ko += b.points ?? 0;
      }
      return { userId: u.id, name: u.name, group, ko };
    });

    /* hall of fame — exact-score hits */
    const bestCalls = scored
      .filter((b) => {
        const m = mById.get(b.matchId);
        return (
          m != null &&
          m.homeScore != null &&
          m.awayScore != null &&
          isExactScore(b.predHome, b.predAway, m.homeScore, m.awayScore)
        );
      })
      .map((b) => {
        const m = mById.get(b.matchId);
        const u = users.find((x) => x.id === b.userId);
        return {
          name: u?.name ?? "?",
          image: u?.image ?? null,
          line: m
            ? `${m.homeFlag} ${m.homeScore}–${m.awayScore} ${m.awayFlag}`
            : "",
          stage: m?.stageLabel ?? "",
          kickoffMs: m ? m.kickoffUtc.getTime() : 0,
        };
      })
      .sort((a, b) => b.kickoffMs - a.kickoffMs)
      .slice(0, 8);

    /* head-to-head total points across the season */
    const headToHead: Array<{
      aName: string;
      aImg: string | null;
      bName: string;
      bImg: string | null;
      aPts: number;
      bPts: number;
    }> = [];
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const a = users[i];
        const b = users[j];
        const aPts = scored
          .filter((x) => x.userId === a.id)
          .reduce((s, x) => s + (x.points ?? 0), 0);
        const bPts = scored
          .filter((x) => x.userId === b.id)
          .reduce((s, x) => s + (x.points ?? 0), 0);
        headToHead.push({
          aName: a.name,
          aImg: a.image,
          bName: b.name,
          bImg: b.image,
          aPts,
          bPts,
        });
      }
    }

    /* the group's collective favourite scoreline */
    const freq = new Map<string, number>();
    for (const b of allBets) {
      const k = `${b.predHome}–${b.predAway}`;
      freq.set(k, (freq.get(k) ?? 0) + 1);
    }
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
    const favScoreline = top ? { score: top[0], count: top[1] } : null;

    return { goals, clutch, bestCalls, headToHead, favScoreline };
  }),
});
