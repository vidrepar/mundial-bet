export type EspnState = "pre" | "in" | "post";

export type EspnMatch = {
  id: string;
  homeCode: string;
  awayCode: string;
  homeScore: number | null;
  awayScore: number | null;
  state: EspnState;
};

export type EspnOdds = {
  provider: string;
  homeDec: number;
  drawDec: number;
  awayDec: number;
};
