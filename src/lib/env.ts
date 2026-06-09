function parseList(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function allowedEmails(): string[] {
  return parseList(process.env.ALLOWED_EMAILS);
}

export function adminEmails(): string[] {
  const explicit = parseList(process.env.ADMIN_EMAILS);
  if (explicit.length) return explicit;
  /* default: the first allowlisted email runs the pool */
  return allowedEmails().slice(0, 1);
}

export function isAllowed(email: string): boolean {
  const list = allowedEmails();
  /* empty allowlist = open (useful for first-run/local dev) */
  if (!list.length) return true;
  return list.includes(email.toLowerCase());
}

export function isAdmin(email: string): boolean {
  return adminEmails().includes(email.toLowerCase());
}
