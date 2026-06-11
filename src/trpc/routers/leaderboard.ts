import { computeStandings } from "@/lib/standings";
import { baseProcedure, createTRPCRouter } from "../init";

export const leaderboardRouter = createTRPCRouter({
  standings: baseProcedure.query(() => computeStandings()),
});
