import { createTRPCRouter } from "../init";
import { analyticsRouter } from "./analytics";
import { awardsRouter } from "./awards";
import { betsRouter } from "./bets";
import { chatRouter } from "./chat";
import { commentsRouter } from "./comments";
import { leaderboardRouter } from "./leaderboard";
import { matchesRouter } from "./matches";
import { statsRouter } from "./stats";

export const appRouter = createTRPCRouter({
  matches: matchesRouter,
  bets: betsRouter,
  chat: chatRouter,
  comments: commentsRouter,
  leaderboard: leaderboardRouter,
  stats: statsRouter,
  analytics: analyticsRouter,
  awards: awardsRouter,
});
