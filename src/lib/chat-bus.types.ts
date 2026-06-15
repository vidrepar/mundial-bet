export type ChatEvent =
  | { kind: "refresh" }
  | { kind: "seen" }
  | { kind: "typing"; userId: string; name: string };
