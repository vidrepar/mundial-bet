export type EspnState = "pre" | "in" | "post";

export type EspnMatch = {
  homeCode: string;
  awayCode: string;
  homeScore: number | null;
  awayScore: number | null;
  state: EspnState;
};
