import { parseAsStringLiteral, useQueryState } from "nuqs";

/* which floating panel is open, mirrored in the URL (?panel=chat|notes) so the
 * browser Back button closes it and only one can be open at a time. */
const PANELS = ["chat", "notes"] as const;

export function usePanel() {
  return useQueryState("panel", parseAsStringLiteral(PANELS));
}
