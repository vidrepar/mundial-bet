import { createTRPCRouter } from "../init";
import { adminRouter } from "./admin";
import { analyticsRouter } from "./analytics";
import { awardsRouter } from "./awards";
import { betsRouter } from "./bets";
import { leaderboardRouter } from "./leaderboard";
import { matchesRouter } from "./matches";
import { statsRouter } from "./stats";

export const appRouter = createTRPCRouter({
  matches: matchesRouter,
  bets: betsRouter,
  leaderboard: leaderboardRouter,
  stats: statsRouter,
  analytics: analyticsRouter,
  awards: awardsRouter,
  admin: adminRouter,
});
