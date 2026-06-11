import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bets, user } from "@/db/schema";
import { maxPoints } from "@/lib/scoring";
import { computeStandings } from "@/lib/standings";
import type {
  BuiltEmail,
  DigestComment,
  DigestMatch,
  ResultMatch,
} from "./emails.types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function first(name: string): string {
  return esc(name.split(" ")[0] || name);
}

/* deterministic pick so the same match always reads the same (no RNG) */
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

const SHELL_OPEN =
  '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial;max-width:520px;margin:0 auto;color:#0f172a">';
const SHELL_CLOSE = "</div>";

function ctaButton(label: string, href: string): string {
  return `<a href="${href}" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${label}</a>`;
}

function standingsBlock(): string {
  const rows = computeStandings();
  if (!rows.length) return "";
  const lines = rows
    .map((r) => {
      const crown = r.rank === 1 ? "👑 " : "";
      const skull = r.rank === rows.length && rows.length > 1 ? " 💀" : "";
      return `<tr>
        <td style="padding:4px 8px;color:#64748b">${r.rank}</td>
        <td style="padding:4px 8px">${crown}${esc(r.name)}${skull}</td>
        <td style="padding:4px 8px;text-align:right;font-weight:700">${r.points}</td>
        <td style="padding:4px 8px;text-align:right;color:#64748b">🎯${r.exact}</td>
      </tr>`;
    })
    .join("");
  const leader = rows[0];
  const last = rows[rows.length - 1];
  const jab =
    rows.length > 1
      ? `<p style="margin:10px 0 0;color:#64748b;font-size:13px"><b>${first(
          leader.name,
        )}</b> sits top on ${leader.points}. Somebody do a welfare check on <b>${first(
          last.name,
        )}</b> (${last.points}).</p>`
      : "";
  return `<h3 style="margin:18px 0 6px">📊 The table</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px;border:1px solid #e2e8f0;border-radius:8px">${lines}</table>${jab}`;
}

const EXACT = [
  "nailed it to the goal. insufferable.",
  "called the exact score. show-off.",
  "perfect read. nobody likes you.",
];
const HIT = [
  "right winner, wrong score — half marks.",
  "got the result, fluffed the goals.",
  "close, but no exact. classic.",
];
const MISS = [
  "whiffed completely. watched a different sport.",
  "zero points. bold strategy.",
  "catastrophic call. frame it.",
];
const NOBET = [
  "didn't even show up to bet. coward.",
  "ghosted the match entirely.",
  "too scared to pick. it shows.",
];

/* RESULT + savage standings — enqueued when ESPN flips a match to full time */
export function buildResultEmail(m: ResultMatch): BuiltEmail {
  const max = maxPoints(m.stage);
  const placed = db
    .select({
      name: user.name,
      predHome: bets.predHome,
      predAway: bets.predAway,
      points: bets.points,
    })
    .from(bets)
    .innerJoin(user, eq(bets.userId, user.id))
    .where(eq(bets.matchId, m.id))
    .all();

  const betNames = new Set(placed.map((p) => p.name));
  const allUsers = db.select({ name: user.name }).from(user).all();
  const noBet = allUsers.filter((u) => !betNames.has(u.name));

  const verdicts = placed
    .slice()
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .map((p, i) => {
      const pts = p.points ?? 0;
      let tag: string;
      if (pts >= max) tag = pick(EXACT, m.id + i);
      else if (pts > 0) tag = pick(HIT, m.id + i);
      else tag = pick(MISS, m.id + i);
      return `<li style="margin:4px 0"><b>${first(p.name)}</b> called ${
        p.predHome
      }–${p.predAway} → <b>${pts > 0 ? "+" + pts : "0"}</b> — ${tag}</li>`;
    })
    .join("");

  const ghosts = noBet
    .map(
      (u, i) =>
        `<li style="margin:4px 0;color:#b91c1c"><b>${first(
          u.name,
        )}</b> ${pick(NOBET, m.id + i)}</li>`,
    )
    .join("");

  const subject = `FT: ${m.homeTeam} ${m.homeScore}–${m.awayScore} ${m.awayTeam}`;
  const html = `${SHELL_OPEN}
    <p style="margin:0;color:#16a34a;font-weight:600;font-size:13px">FULL TIME · Mundial '26</p>
    <h1 style="margin:6px 0 2px;font-size:26px">${m.homeFlag} ${esc(
      m.homeTeam,
    )} <span style="color:#16a34a">${m.homeScore}–${m.awayScore}</span> ${esc(
      m.awayTeam,
    )} ${m.awayFlag}</h1>
    <h3 style="margin:18px 0 6px">🗣️ The verdict</h3>
    <ul style="margin:0;padding-left:18px;font-size:14px">${verdicts}${ghosts}</ul>
    ${standingsBlock()}
    <p style="margin:18px 0 0">${ctaButton("See the carnage →", `${APP_URL}/leaderboard`)}</p>
    ${SHELL_CLOSE}`;
  return { subject, html };
}

/* COMMENT DIGEST — batched chatter on a match thread */
export function buildCommentDigest(
  m: DigestMatch,
  newComments: DigestComment[],
): BuiltEmail {
  const items = newComments
    .map(
      (c) =>
        `<li style="margin:4px 0"><b>${first(c.name)}:</b> ${esc(c.body)}</li>`,
    )
    .join("");
  const n = newComments.length;
  const subject = `💬 ${n} new ${n === 1 ? "jab" : "jabs"} on ${m.homeTeam} v ${m.awayTeam}`;
  const html = `${SHELL_OPEN}
    <p style="margin:0;color:#16a34a;font-weight:600;font-size:13px">Trash talk · Mundial '26</p>
    <h2 style="margin:6px 0 2px">${m.homeFlag} ${esc(m.homeTeam)} v ${esc(
      m.awayTeam,
    )} ${m.awayFlag}</h2>
    <ul style="margin:8px 0;padding-left:18px;font-size:14px">${items}</ul>
    <p style="margin:14px 0 0">${ctaButton("Clap back →", `${APP_URL}/bet`)}</p>
    ${SHELL_CLOSE}`;
  return { subject, html };
}
