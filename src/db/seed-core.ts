import fixturesJson from "../data/fixtures.json";
import { codeFor, flagFor } from "../lib/teams";
import { db } from "./index";
import { matches, teams } from "./schema";

function stageInfo(round: number, matchNumber: number) {
  switch (round) {
    case 1:
      return { stage: "group", label: "Group Stage · MD1" };
    case 2:
      return { stage: "group", label: "Group Stage · MD2" };
    case 3:
      return { stage: "group", label: "Group Stage · MD3" };
    case 4:
      return { stage: "r32", label: "Round of 32" };
    case 5:
      return { stage: "r16", label: "Round of 16" };
    case 6:
      return { stage: "qf", label: "Quarter-final" };
    case 7:
      return { stage: "sf", label: "Semi-final" };
    default:
      return matchNumber === 104
        ? { stage: "final", label: "Final" }
        : { stage: "third", label: "Third-place play-off" };
  }
}

const TBD = "To be announced";
const norm = (name: string) => (name === TBD ? "TBD" : name);

/* idempotent — safe to run on every boot (insert-if-absent everywhere) */
export function seedDatabase() {
  /* 1. teams from group-stage rows */
  const teamGroup = new Map<string, string>();
  for (const f of fixturesJson) {
    if (!f.Group) continue;
    const g = f.Group.replace("Group ", "");
    for (const t of [f.HomeTeam, f.AwayTeam]) {
      if (t && t !== TBD) teamGroup.set(t, g);
    }
  }
  for (const [name, g] of teamGroup) {
    db.insert(teams)
      .values({ name, code: codeFor(name), flag: flagFor(name), groupName: g })
      .onConflictDoNothing()
      .run();
  }

  /* 2. all 104 matches with real UTC kickoffs */
  let inserted = 0;
  for (const f of fixturesJson) {
    const { stage, label } = stageInfo(f.RoundNumber, f.MatchNumber);
    const home = norm(f.HomeTeam);
    const away = norm(f.AwayTeam);
    const res = db
      .insert(matches)
      .values({
        matchNumber: f.MatchNumber,
        roundNumber: f.RoundNumber,
        stage,
        stageLabel: label,
        groupName: f.Group ? f.Group.replace("Group ", "") : null,
        homeTeam: home,
        awayTeam: away,
        homeFlag: flagFor(home),
        awayFlag: flagFor(away),
        venue: f.Location,
        kickoffUtc: new Date(f.DateUtc.replace(" ", "T")),
      })
      .onConflictDoNothing()
      .run();
    inserted += res.changes;
  }

  return { teams: teamGroup.size, matchesInserted: inserted };
}
