/**
 * Mapping for user-friendly country names
 * Maps ISO 3166-1 alpha-2 country codes to user-friendly display names
 */
export const FRIENDLY_COUNTRY_NAMES: Record<string, string> = {
  KR: "South Korea",
  KP: "North Korea",
  US: "United States",
  GB: "United Kingdom",
  CN: "China",
  JP: "Japan",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  BR: "Brazil",
  IN: "India",
  RU: "Russia",
  CA: "Canada",
  AU: "Australia",
  MX: "Mexico",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  VE: "Venezuela",
  ZA: "South Africa",
  EG: "Egypt",
  NG: "Nigeria",
  KE: "Kenya",
  MA: "Morocco",
  TH: "Thailand",
  VN: "Vietnam",
  PH: "Philippines",
  ID: "Indonesia",
  MY: "Malaysia",
  SG: "Singapore",
  HK: "Hong Kong",
  TW: "Taiwan",
  TR: "Turkey",
  IL: "Israel",
  AE: "UAE",
  SA: "Saudi Arabia",
  IR: "Iran",
  IQ: "Iraq",
  SY: "Syria",
  JO: "Jordan",
  LB: "Lebanon",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IS: "Iceland",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  CZ: "Czech Republic",
  PL: "Poland",
  RO: "Romania",
  BG: "Bulgaria",
  HR: "Croatia",
  RS: "Serbia",
  BA: "Bosnia and Herzegovina",
  GR: "Greece",
  PT: "Portugal",
  IE: "Ireland",
  NZ: "New Zealand",
};

/**
 * Gets a user-friendly country name from a country code
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "KR", "US")
 * @param fallbackName - Fallback name to use if no friendly name is available
 * @returns User-friendly country name
 */
export function getFriendlyCountryName(
  countryCode: string,
  fallbackName?: string,
): string {
  const code = countryCode.toUpperCase();
  return FRIENDLY_COUNTRY_NAMES[code] || fallbackName || code;
}

/**
 * Checks if a country code has a friendly name mapping
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns True if a friendly name mapping exists
 */
export function hasFriendlyCountryName(countryCode: string): boolean {
  return countryCode.toUpperCase() in FRIENDLY_COUNTRY_NAMES;
}
