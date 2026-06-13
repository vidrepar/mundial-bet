import { TEAM_META } from "./teams";
import type { EspnMatch, EspnOdds } from "./espn.types";

/* Free, no-auth ESPN hidden scoreboard for the FIFA World Cup. */
const SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

/* Free, no-auth ESPN core API — per-event 3-way moneyline odds. */
const ODDS_BASE =
  "https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/events";

/* ESPN groups its slate by US (Eastern) calendar date; the 2026 tournament is
 * in US/CA/MX so the Eastern date is the reliable key. */
export function espnDateKey(d: Date): string {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // "2026-06-11"
  return ymd.replaceAll("-", "");
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchEspnMatches(dateKey: string): Promise<EspnMatch[]> {
  const res = await fetch(`${SCOREBOARD}?dates=${dateKey}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  const data: any = await res.json();

  const out: EspnMatch[] = [];
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0];
    const raw = comp?.status?.type?.state;
    /* narrow the string to our union at the boundary, no cast */
    const state =
      raw === "pre" || raw === "in" || raw === "post" ? raw : undefined;
    const cs: any[] = comp?.competitors ?? [];
    const home = cs.find((c) => c.homeAway === "home");
    const away = cs.find((c) => c.homeAway === "away");
    if (!home || !away || !state) continue;
    out.push({
      id: String(ev.id ?? ""),
      homeCode: String(home.team?.abbreviation ?? "").toUpperCase(),
      awayCode: String(away.team?.abbreviation ?? "").toUpperCase(),
      homeScore: num(home.score),
      awayScore: num(away.score),
      state,
    });
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* American moneyline → decimal odds (e.g. +600 → 7.0, -475 → 1.21). */
function americanToDecimal(ml: number): number {
  const dec = ml > 0 ? ml / 100 + 1 : 100 / -ml + 1;
  return Math.round(dec * 100) / 100;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/* Fetch a single event's 3-way moneyline odds from ESPN's core API. Returns
 * the first provider with all three lines, as decimal odds. */
export async function fetchEspnOdds(eventId: string): Promise<EspnOdds | null> {
  const res = await fetch(`${ODDS_BASE}/${eventId}/competitions/${eventId}/odds`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data: any = await res.json();
  for (const o of data.items ?? []) {
    const h = o?.homeTeamOdds?.moneyLine;
    const d = o?.drawOdds?.moneyLine;
    const a = o?.awayTeamOdds?.moneyLine;
    if (typeof h !== "number" || typeof d !== "number" || typeof a !== "number")
      continue;
    return {
      provider: String(o?.provider?.name ?? "ESPN"),
      homeDec: americanToDecimal(h),
      drawDec: americanToDecimal(d),
      awayDec: americanToDecimal(a),
    };
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* find the ESPN event whose unordered tri-code pair matches the given codes */
export function matchEspnByCodes(
  list: EspnMatch[],
  homeCode: string,
  awayCode: string,
): { ev: EspnMatch; swapped: boolean } | null {
  for (const ev of list) {
    if (ev.homeCode === homeCode && ev.awayCode === awayCode)
      return { ev, swapped: false };
    if (ev.homeCode === awayCode && ev.awayCode === homeCode)
      return { ev, swapped: true };
  }
  return null;
}

export function codeForTeam(name: string): string {
  return TEAM_META[name]?.code ?? name.slice(0, 3).toUpperCase();
}
