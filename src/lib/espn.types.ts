export type EspnState = "pre" | "in" | "post";

export type EspnMatch = {
  id: string;
  homeCode: string;
  awayCode: string;
  homeScore: number | null;
  awayScore: number | null;
  /* who advanced — true for the winning side; both false until decided. On a
   * shootout, the regulation/ET score stays level but the winner flag is set. */
  homeWinner: boolean;
  awayWinner: boolean;
  state: EspnState;
  /* short live label: "56'", "HT", "90'+5'", "FT" */
  clock: string | null;
};

export type EspnOdds = {
  provider: string;
  homeDec: number;
  drawDec: number;
  awayDec: number;
};
