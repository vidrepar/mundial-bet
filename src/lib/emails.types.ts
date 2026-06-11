export type BuiltEmail = { subject: string; html: string };

export type ResultMatch = {
  id: number;
  stage: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number;
  awayScore: number;
};

export type DigestComment = { name: string; body: string };

export type DigestMatch = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
};
