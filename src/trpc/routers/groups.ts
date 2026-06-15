import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bets, matches, teams, user } from "@/db/schema";
import { baseProcedure, createTRPCRouter } from "../init";

/* everything to joke about per World Cup group: the live table, the fixtures
 * with everyone's predictions, and a per-group prediction leaderboard. */
export const groupsRouter = createTRPCRouter({
  overview: baseProcedure.query(() => {
    const now = Date.now();
    const allTeams = db.select().from(teams).all();
    const groupMatches = db
      .select()
      .from(matches)
      .where(eq(matches.stage, "group"))
      .all();
    const allBets = db.select().from(bets).all();
    const users = db.select().from(user).all();
    const uById = new Map(users.map((u) => [u.id, u]));
    const betsByMatch = new Map<number, (typeof bets.$inferSelect)[]>();
    for (const b of allBets) {
      const arr = betsByMatch.get(b.matchId) ?? [];
      arr.push(b);
      betsByMatch.set(b.matchId, arr);
    }

    const groupNames = [...new Set(allTeams.map((t) => t.groupName).filter(Boolean))].sort();

    return groupNames.map((g) => {
      const gTeams = allTeams.filter((t) => t.groupName === g);
      const flagByName = new Map(gTeams.map((t) => [t.name, t.flag]));
      const gMatches = groupMatches
        .filter((m) => m.groupName === g)
        .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime());

      /* 1. group table from finished results */
      const table = new Map(
        gTeams.map((t) => [
          t.name,
          { team: t.name, flag: t.flag, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 },
        ]),
      );
      for (const m of gMatches) {
        if (!m.finished || m.homeScore == null || m.awayScore == null) continue;
        const h = table.get(m.homeTeam);
        const a = table.get(m.awayTeam);
        if (!h || !a) continue;
        h.p++; a.p++;
        h.gf += m.homeScore; h.ga += m.awayScore;
        a.gf += m.awayScore; a.ga += m.homeScore;
        if (m.homeScore > m.awayScore) { h.w++; h.pts += 3; a.l++; }
        else if (m.homeScore < m.awayScore) { a.w++; a.pts += 3; h.l++; }
        else { h.d++; a.d++; h.pts++; a.pts++; }
      }
      const tableRows = [...table.values()]
        .map((r) => ({ ...r, gd: r.gf - r.ga }))
        .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team));

      /* 2. fixtures with everyone's picks (only revealed once locked) */
      const fixtures = gMatches.map((m) => {
        const locked = m.finished || now >= m.kickoffUtc.getTime();
        const picks = locked
          ? (betsByMatch.get(m.id) ?? []).map((b) => {
              const u = uById.get(b.userId);
              return {
                name: u?.name ?? "?",
                image: u?.image ?? null,
                predHome: b.predHome,
                predAway: b.predAway,
                points: b.points,
              };
            })
          : [];
        return {
          id: m.id,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          homeFlag: flagByName.get(m.homeTeam) ?? m.homeFlag,
          awayFlag: flagByName.get(m.awayTeam) ?? m.awayFlag,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          finished: m.finished,
          locked,
          kickoff: m.kickoffUtc.toISOString(),
          picks,
        };
      });

      /* 3. per-group prediction leaderboard */
      const gMatchIds = new Set(gMatches.map((m) => m.id));
      const ptsByUser = new Map<string, number>();
      for (const b of allBets) {
        if (!gMatchIds.has(b.matchId) || b.points == null) continue;
        ptsByUser.set(b.userId, (ptsByUser.get(b.userId) ?? 0) + b.points);
      }
      const standings = users
        .map((u) => ({ name: u.name, image: u.image, points: ptsByUser.get(u.id) ?? 0 }))
        .filter((r) => r.points !== 0)
        .sort((x, y) => y.points - x.points);

      return { name: g, table: tableRows, fixtures, standings };
    });
  }),
});
