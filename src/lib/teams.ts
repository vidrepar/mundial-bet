/* FIFA codes + flag emojis for the 48 qualified nations (2026). */
export const TEAM_META: Record<string, { code: string; flag: string }> = {
  Mexico: { code: "MEX", flag: "🇲🇽" },
  "South Africa": { code: "RSA", flag: "🇿🇦" },
  "Korea Republic": { code: "KOR", flag: "🇰🇷" },
  Czechia: { code: "CZE", flag: "🇨🇿" },
  Canada: { code: "CAN", flag: "🇨🇦" },
  "Bosnia and Herzegovina": { code: "BIH", flag: "🇧🇦" },
  Qatar: { code: "QAT", flag: "🇶🇦" },
  Switzerland: { code: "SUI", flag: "🇨🇭" },
  Brazil: { code: "BRA", flag: "🇧🇷" },
  Haiti: { code: "HAI", flag: "🇭🇹" },
  Morocco: { code: "MAR", flag: "🇲🇦" },
  Scotland: { code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  USA: { code: "USA", flag: "🇺🇸" },
  Paraguay: { code: "PAR", flag: "🇵🇾" },
  Australia: { code: "AUS", flag: "🇦🇺" },
  Türkiye: { code: "TUR", flag: "🇹🇷" },
  Germany: { code: "GER", flag: "🇩🇪" },
  "Curaçao": { code: "CUW", flag: "🇨🇼" },
  Ecuador: { code: "ECU", flag: "🇪🇨" },
  "Côte d'Ivoire": { code: "CIV", flag: "🇨🇮" },
  Netherlands: { code: "NED", flag: "🇳🇱" },
  Japan: { code: "JPN", flag: "🇯🇵" },
  Sweden: { code: "SWE", flag: "🇸🇪" },
  Tunisia: { code: "TUN", flag: "🇹🇳" },
  Belgium: { code: "BEL", flag: "🇧🇪" },
  Egypt: { code: "EGY", flag: "🇪🇬" },
  "IR Iran": { code: "IRN", flag: "🇮🇷" },
  "New Zealand": { code: "NZL", flag: "🇳🇿" },
  Spain: { code: "ESP", flag: "🇪🇸" },
  "Cabo Verde": { code: "CPV", flag: "🇨🇻" },
  Uruguay: { code: "URU", flag: "🇺🇾" },
  "Saudi Arabia": { code: "KSA", flag: "🇸🇦" },
  France: { code: "FRA", flag: "🇫🇷" },
  Senegal: { code: "SEN", flag: "🇸🇳" },
  Norway: { code: "NOR", flag: "🇳🇴" },
  Iraq: { code: "IRQ", flag: "🇮🇶" },
  Argentina: { code: "ARG", flag: "🇦🇷" },
  Algeria: { code: "ALG", flag: "🇩🇿" },
  Austria: { code: "AUT", flag: "🇦🇹" },
  Jordan: { code: "JOR", flag: "🇯🇴" },
  Portugal: { code: "POR", flag: "🇵🇹" },
  Colombia: { code: "COL", flag: "🇨🇴" },
  Uzbekistan: { code: "UZB", flag: "🇺🇿" },
  "Congo DR": { code: "COD", flag: "🇨🇩" },
  England: { code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  Croatia: { code: "CRO", flag: "🇭🇷" },
  Ghana: { code: "GHA", flag: "🇬🇭" },
  Panama: { code: "PAN", flag: "🇵🇦" },
};

export function flagFor(name: string): string {
  return TEAM_META[name]?.flag ?? "🏳️";
}

export function codeFor(name: string): string {
  return TEAM_META[name]?.code ?? name.slice(0, 3).toUpperCase();
}
