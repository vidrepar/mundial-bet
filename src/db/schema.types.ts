import type { bets, matches, odds, teams, user } from "./schema";

export type User = typeof user.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Bet = typeof bets.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Odds = typeof odds.$inferSelect;
