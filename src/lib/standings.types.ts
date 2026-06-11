export type StandingRow = {
  userId: string;
  name: string;
  image: string | null;
  points: number;
  exact: number;
  hits: number;
  scored: number;
  missed: number;
  total: number;
  hitRate: number;
  rank: number;
};
