import { createTRPCRouter } from "../init";
import { analyticsRouter } from "./analytics";
import { awardsRouter } from "./awards";
import { betsRouter } from "./bets";
import { chatRouter } from "./chat";
import { commentsRouter } from "./comments";
import { groupsRouter } from "./groups";
import { leaderboardRouter } from "./leaderboard";
import { matchesRouter } from "./matches";
import { notesRouter } from "./notes";
import { rivalsRouter } from "./rivals";
import { statsRouter } from "./stats";

export const appRouter = createTRPCRouter({
  matches: matchesRouter,
  bets: betsRouter,
  chat: chatRouter,
  comments: commentsRouter,
  notes: notesRouter,
  rivals: rivalsRouter,
  groups: groupsRouter,
  leaderboard: leaderboardRouter,
  stats: statsRouter,
  analytics: analyticsRouter,
  awards: awardsRouter,
});
