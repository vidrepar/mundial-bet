import { db } from "@/db";
import { bets, matches, user } from "@/db/schema";
import { isExactScore } from "@/lib/scoring";
import { baseProcedure, createTRPCRouter } from "../init";

export const awardsRouter = createTRPCRouter({
  list: baseProcedure.query(() => {
    const users = db.select().from(user).all();
    const allBets = db.select().from(bets).all();
    const allMatches = db.select().from(matches).all();
    const mById = new Map(allMatches.map((m) => [m.id, m]));

    /* per-player aggregates that drive the badges */
    const stats = users.map((u) => {
      const ub = allBets.filter((b) => b.userId === u.id);
      const scored = ub.filter((b) => b.points != null);
      const exact = scored.filter((b) => {
        const m = mById.get(b.matchId);
        return (
          m != null &&
          m.homeScore != null &&
          m.awayScore != null &&
          isExactScore(b.predHome, b.predAway, m.homeScore, m.awayScore)
        );
      }).length;
      const hits = scored.filter((b) => (b.points ?? 0) > 0).length;
      const avgGoals = ub.length
        ? ub.reduce((s, b) => s + b.predHome + b.predAway, 0) / ub.length
        : 0;
      const awayCalls = scored.filter((b) => {
        const m = mById.get(b.matchId);
        if (!m || m.homeScore == null || m.awayScore == null) return false;
        return b.predAway > b.predHome && m.awayScore > m.homeScore;
      }).length;

      /* longest run of consecutive scoring matches (chronological) */
      const ordered = scored
        .map((b) => ({ b, m: mById.get(b.matchId) }))
        .filter((x) => x.m)
        .sort((a, b) => a.m!.kickoffUtc.getTime() - b.m!.kickoffUtc.getTime());
      let run = 0;
      let best = 0;
      for (const x of ordered) {
        if ((x.b.points ?? 0) > 0) {
          run++;
          best = Math.max(best, run);
        } else run = 0;
      }

      return {
        name: u.name,
        image: u.image,
        total: ub.length,
        scored: scored.length,
        exact,
        hitRate: scored.length ? hits / scored.length : 0,
        avgGoals,
        awayCalls,
        streak: best,
      };
    });

    type S = (typeof stats)[number];
    const pick = (
      metric: (s: S) => number,
      minScored: number,
      format: (v: number) => string,
    ) => {
      const elig = stats.filter((s) => s.scored >= minScored);
      if (!elig.length) return null;
      const w = elig.reduce((a, b) => (metric(b) > metric(a) ? b : a));
      if (metric(w) <= 0) return null;
      return { name: w.name, image: w.image, display: format(metric(w)) };
    };

    const ironElig = stats.filter((s) => s.total > 0);
    const ironWinner = ironElig.length
      ? ironElig.reduce((a, b) => (b.total > a.total ? b : a))
      : null;

    const awards = [
      {
        key: "nostradamus",
        emoji: "🔮",
        title: "Nostradamus",
        desc: "Most exact scorelines nailed",
        winner: pick((s) => s.exact, 1, (v) => `${v} exact`),
      },
      {
        key: "sniper",
        emoji: "🎯",
        title: "The Sniper",
        desc: "Best hit-rate (min. 5 scored)",
        winner: pick(
          (s) => s.hitRate,
          5,
          (v) => `${Math.round(v * 100)}%`,
        ),
      },
      {
        key: "onfire",
        emoji: "🔥",
        title: "On Fire",
        desc: "Longest scoring streak",
        winner: pick((s) => s.streak, 1, (v) => `${v} in a row`),
      },
      {
        key: "underdog",
        emoji: "🦅",
        title: "Underdog Whisperer",
        desc: "Most correct away-win calls",
        winner: pick((s) => s.awayCalls, 1, (v) => `${v} upsets`),
      },
      {
        key: "glutton",
        emoji: "🥅",
        title: "Goal Glutton",
        desc: "Highest avg goals predicted",
        winner: pick(
          (s) => s.avgGoals,
          3,
          (v) => `${v.toFixed(1)} gpg`,
        ),
      },
      {
        key: "iron",
        emoji: "💪",
        title: "Iron Bettor",
        desc: "Most bets placed",
        winner: ironWinner
          ? {
              name: ironWinner.name,
              image: ironWinner.image,
              display: `${ironWinner.total} bets`,
            }
          : null,
      },
    ];

    return awards;
  }),
});
